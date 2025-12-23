import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, ChevronRight, ChevronLeft, 
  Upload, Youtube, FileText, History, Settings, 
  Repeat, Mic, Volume2, User, LogOut, Loader2, Sparkles, X, Database, Save
} from 'lucide-react';

/* =============================================================================
  INSTRUCTIONS FOR PRODUCTION (LOCAL DEVELOPMENT):
  1. Install dependencies: npm install @supabase/supabase-js
  2. Uncomment the 'Real Supabase Client' section below.
  3. Comment out or remove the 'Mock Supabase Client' section.
  4. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
  =============================================================================
*/

// --- 1. REAL SUPABASE CLIENT (Uncomment for Production) ---
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


// Toggle this variable to swtich between Real and Mock in your local setup
// In Canvas, we MUST use mockSupabase because we can't install libraries.
const supabase = mockSupabase; 


// --- HELPER: Gemini / Edge Function Wrapper ---
const generateTranscript = async (sourceType, sourceUrl, contextText) => {
  /* In Production, this calls the Supabase Edge Function 'generate-transcript'.
     The Edge function holds the GEMINI_API_KEY securely.
  */
  try {
    const { data, error } = await supabase.functions.invoke('generate-transcript', {
      body: { sourceType, sourceUrl, contextText }
    });

    if (error) throw error;
    return data.transcript;
  } catch (err) {
    console.error("Edge Function Error:", err);
    // Fallback for demo if Edge Function fails/doesn't exist
    return [
      { text: "Error connecting to AI service.", start: 0, end: 2, speaker: "System" },
      { text: "Please check your Supabase Edge Function deployment.", start: 2, end: 5, speaker: "System" }
    ];
  }
};


// --- COMPONENTS ---

const Spinner = () => <Loader2 className="animate-spin w-5 h-5" />;

const LoginModal = ({ isOpen, onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // In a real app, you'd handle password or magic link here
    await onLogin(email);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Welcome back</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex justify-center"
          >
            {loading ? <Spinner /> : "Sign In / Sign Up"}
          </button>
        </form>
        <button onClick={onClose} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-800">
          Cancel
        </button>
      </div>
    </div>
  );
};

const SmartPlayer = ({ 
  source, 
  isPlaying, 
  setIsPlaying, 
  seekTime, 
  onTimeUpdate,
  loopRange 
}) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [youtubeReady, setYoutubeReady] = useState(false);

  // Native Video Handling
  useEffect(() => {
    if (source?.type === 'file' && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - seekTime) > 0.5) {
        videoRef.current.currentTime = seekTime;
      }
      if (isPlaying) videoRef.current.play().catch(() => setIsPlaying(false));
      else videoRef.current.pause();
    }
  }, [seekTime, isPlaying, source]);

  // YouTube Handling
  useEffect(() => {
    if (source?.type === 'youtube') {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = () => setYoutubeReady(true);
      } else {
        setYoutubeReady(true);
      }
    }
  }, [source]);

  useEffect(() => {
    if (youtubeReady && source?.type === 'youtube' && !playerRef.current) {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: source.url,
        playerVars: { 'playsinline': 1, 'controls': 0, 'rel': 0 }, // Hide controls for custom UI
        events: {
          'onStateChange': (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
            if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
          }
        }
      });
    } else if (playerRef.current && source?.type === 'youtube' && source.url !== playerRef.current.getVideoData()?.video_id) {
       // Handle video ID change if player already exists
       playerRef.current.loadVideoById(source.url);
    }
  }, [youtubeReady, source]);

  // YouTube Seek & Play
  useEffect(() => {
    if (source?.type === 'youtube' && playerRef.current?.seekTo) {
      // Seek
      const current = playerRef.current.getCurrentTime();
      if (Math.abs(current - seekTime) > 0.5) {
        playerRef.current.seekTo(seekTime, true);
      }
      // Play/Pause
      const state = playerRef.current.getPlayerState();
      if (isPlaying && state !== 1) playerRef.current.playVideo();
      if (!isPlaying && state === 1) playerRef.current.pauseVideo();
    }
  }, [seekTime, isPlaying]);

  // Sync Loop
  useEffect(() => {
    let interval;
    const sync = () => {
      let time = 0;
      if (source?.type === 'file' && videoRef.current) {
        time = videoRef.current.currentTime;
      } else if (source?.type === 'youtube' && playerRef.current?.getCurrentTime) {
        time = playerRef.current.getCurrentTime();
      }
      onTimeUpdate(time);
    };

    if (isPlaying) {
      interval = setInterval(sync, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, source]);

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg group">
      {source?.type === 'file' ? (
        <video 
          ref={videoRef} 
          src={source.url} 
          className="w-full h-full object-contain"
          onEnded={() => setIsPlaying(false)}
        />
      ) : source?.type === 'youtube' ? (
        <div id="youtube-player" className="w-full h-full pointer-events-none" /> 
        /* pointer-events-none forces use of our custom controls */
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">
          <div className="text-center">
            <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No Media Loaded</p>
          </div>
        </div>
      )}

      {/* Loop Overlay */}
      {loopRange && (
        <div className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg animate-pulse z-10">
          <Repeat className="w-3 h-3" /> LOOPING
        </div>
      )}
    </div>
  );
};


// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Media State
  const [source, setSource] = useState(null); // { type, url, title, originalUrl }
  const [transcript, setTranscript] = useState([]);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTrigger, setSeekTrigger] = useState(0); // Trigger to force player seek
  const [loopRange, setLoopRange] = useState(null); // { start, end }
  
  // Data / UI State
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contextPrompt, setContextPrompt] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  // Refs for auto-scroll
  const activeSegmentRef = useRef(null);

  // 1. Auth Init
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // 2. Load History
  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setHistory(data);
  };

  // 3. Login Handlers
  const handleLogin = async (email) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: 'dummy-password' });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setHistory([]);
  };

  // 4. Media Handlers
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // In a real app, you would upload this file to Supabase Storage here
    // const { data } = await supabase.storage.from('media').upload(...)
    
    const url = URL.createObjectURL(file);
    setSource({ type: 'file', url, title: file.name, originalUrl: null });
    setTranscript([]);
    setIsPlaying(false);
  };

  const handleYoutubeLoad = (e) => {
    e.preventDefault();
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : null;

    if (id) {
      setSource({ type: 'youtube', url: id, title: `YouTube Video ${id}`, originalUrl: inputUrl });
      setTranscript([]);
      setIsPlaying(false);
    } else {
      alert("Invalid YouTube URL");
    }
  };

  // 5. AI Generation Handler
  const handleGenerate = async () => {
    if (!source) return;
    setIsProcessing(true);
    
    // Call our Edge Function Wrapper
    const result = await generateTranscript(source.type, source.originalUrl, contextPrompt || source.title);
    
    setTranscript(result);
    setIsProcessing(false);
    
    // Auto-save if logged in
    if (user) {
      await supabase.from('transcripts').insert([{
        user_id: user.id,
        title: source.title,
        source_type: source.type,
        source_url: source.originalUrl || 'Local File',
        content: result // Storing JSON directly in JSONB column
      }]);
      fetchHistory();
    }
  };

  const loadSession = (item) => {
    setTranscript(item.content);
    
    if (item.source_type === 'youtube') {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = item.source_url.match(regExp);
      const id = (match && match[2].length === 11) ? match[2] : null;
      setSource({ type: 'youtube', url: id, title: item.title, originalUrl: item.source_url });
    } else {
      // For local files, we can't restore the blob URL on refresh in a real app without re-downloading from Storage
      // For this demo, we just set the title
      setSource({ type: 'file', url: null, title: item.title });
      alert("Please re-upload the local file for this session.");
    }
  };

  // 6. Time Update & Loop Logic
  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
    
    // Loop Check
    if (loopRange && isPlaying) {
      if (time >= loopRange.end) {
        setSeekTrigger(loopRange.start);
      }
    }
  };

  // 7. Active Transcript Segment
  const activeIndex = transcript.findIndex(s => currentTime >= s.start && currentTime < s.end);

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);


  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLogin} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Volume2 className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            LingoMate <span className="text-xs text-gray-400 font-normal ml-1">Supabase Edition</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
             <div className="flex items-center gap-3 bg-gray-100 pl-3 pr-2 py-1.5 rounded-full">
               <span className="text-sm font-medium text-gray-600">{user.email}</span>
               <button onClick={handleLogout} className="bg-white p-1.5 rounded-full shadow-sm hover:text-red-600 transition-colors">
                 <LogOut className="w-4 h-4" />
               </button>
             </div>
          ) : (
            <button 
              onClick={() => setIsLoginOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              <User className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar (History) */}
        <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}>
           <div className="p-4 border-b border-gray-100 flex justify-between items-center">
             <h2 className="font-semibold text-gray-700 flex items-center gap-2">
               <History className="w-4 h-4" /> Library
             </h2>
           </div>
           <div className="flex-1 overflow-y-auto p-3 space-y-2">
             {!user && (
               <div className="text-center p-6 text-gray-400 text-sm">
                 Sign in to save your progress.
               </div>
             )}
             {user && history.map(item => (
               <div 
                  key={item.id} 
                  onClick={() => loadSession(item)}
                  className="p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-all group"
               >
                 <h3 className="font-medium text-gray-800 text-sm truncate">{item.title}</h3>
                 <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                      {item.source_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                 </div>
               </div>
             ))}
           </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col md:flex-row min-w-0">
          
          {/* LEFT: Player & Controls */}
          <div className="flex-[3] flex flex-col bg-gray-50 border-r border-gray-200 overflow-y-auto">
            
            {/* Toggle Sidebar Button (Mobile/Desktop) */}
            <div className="p-2">
               <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500">
                 {sidebarOpen ? <ChevronLeft className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
               </button>
            </div>

            <div className="px-6 pb-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
              
              {/* Media Input (If no source) */}
              {!source && (
                <div className="grid md:grid-cols-2 gap-6 mt-10">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Upload File</h3>
                    <p className="text-gray-500 text-sm mb-6">MP4 or MP3 files supported.</p>
                    <label className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium cursor-pointer hover:bg-indigo-700 transition-transform active:scale-95">
                      Select File
                      <input type="file" className="hidden" accept="video/*,audio/*" onChange={handleFileUpload} />
                    </label>
                  </div>

                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                      <Youtube className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">YouTube Link</h3>
                    <p className="text-gray-500 text-sm mb-6">Paste a direct video URL.</p>
                    <form onSubmit={handleYoutubeLoad} className="w-full flex gap-2">
                      <input 
                        className="flex-1 px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-red-200 outline-none"
                        placeholder="https://youtube.com/watch?v=..."
                        value={inputUrl}
                        onChange={e => setInputUrl(e.target.value)}
                      />
                      <button type="submit" className="bg-gray-900 text-white px-4 rounded-xl font-medium">
                        Go
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Player UI */}
              {source && (
                <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-xl truncate">{source.title}</h2>
                    <button onClick={() => setSource(null)} className="text-sm text-red-500 hover:underline">
                      Close
                    </button>
                  </div>

                  <SmartPlayer 
                    source={source}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    seekTime={seekTrigger}
                    onTimeUpdate={handleTimeUpdate}
                    loopRange={loopRange}
                  />

                  {/* Controls Bar */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <button onClick={() => setSeekTrigger(c => Math.max(0, currentTime - 5))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="w-12 h-12 flex items-center justify-center bg-gray-900 text-white rounded-full hover:scale-105 transition-transform"
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                        </button>
                        <button onClick={() => setSeekTrigger(c => currentTime + 5)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                          <RotateCcw className="w-5 h-5 scale-x-[-1]" />
                        </button>
                     </div>

                     <div className="flex items-center gap-2">
                       {loopRange ? (
                         <button onClick={() => setLoopRange(null)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
                           <X className="w-4 h-4" /> Clear Loop
                         </button>
                       ) : (
                         <span className="text-xs text-gray-400">Click text to loop</span>
                       )}
                     </div>
                  </div>

                  {/* Generation Box */}
                  {transcript.length === 0 && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-6 rounded-2xl flex flex-col items-center text-center">
                       <Sparkles className="w-8 h-8 text-indigo-500 mb-3" />
                       <h3 className="font-semibold text-gray-800">Generate Transcript</h3>
                       <p className="text-sm text-gray-500 mb-4 max-w-md">
                         Use Gemini AI to generate a precise, timestamped script for this media.
                       </p>
                       <div className="flex gap-2 w-full max-w-md">
                         <input 
                           placeholder="Optional context (e.g. 'Ordering coffee')" 
                           className="flex-1 px-4 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                           value={contextPrompt}
                           onChange={e => setContextPrompt(e.target.value)}
                         />
                         <button 
                           onClick={handleGenerate}
                           disabled={isProcessing}
                           className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
                         >
                           {isProcessing ? <Loader2 className="animate-spin w-4 h-4"/> : "Generate"}
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Transcript (40%) */}
          <div className="flex-[2] bg-white flex flex-col border-l border-gray-200 h-full overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <FileText className="w-4 h-4 text-gray-500" /> Transcript
               </h3>
               {transcript.length > 0 && (
                 <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                   {transcript.length} lines
                 </span>
               )}
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <p className="text-sm">No transcript generated yet.</p>
                  </div>
                ) : (
                  transcript.map((line, idx) => {
                    const isActive = idx === activeIndex;
                    const isLooping = loopRange?.start === line.start;

                    return (
                      <div 
                        key={idx}
                        ref={isActive ? activeSegmentRef : null}
                        onClick={() => {
                          setSeekTrigger(line.start);
                          setIsPlaying(true);
                        }}
                        className={`
                          p-4 rounded-xl cursor-pointer transition-all duration-200 border-l-4 group
                          ${isActive 
                            ? 'bg-indigo-50 border-indigo-500 shadow-sm' 
                            : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
                          }
                        `}
                      >
                         <div className="flex justify-between items-center mb-1">
                           <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                             {line.speaker || 'Speaker'} • {line.start.toFixed(1)}s
                           </span>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setLoopRange(isLooping ? null : { start: line.start, end: line.end });
                             }}
                             className={`p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isLooping ? 'bg-indigo-600 text-white opacity-100' : 'bg-gray-200 hover:bg-gray-300'}`}
                             title="Loop this sentence"
                           >
                             <Repeat className="w-3 h-3" />
                           </button>
                         </div>
                         <p className={`text-base leading-relaxed ${isActive ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                           {line.text}
                         </p>
                      </div>
                    );
                  })
                )}
             </div>
          </div>

        </main>
      </div>
    </div>
  );
}