Product Plan: English Listening Trainer (Static MVP + Supabase)

1. Executive Summary

This web application is a language learning tool designed to bridge the gap between passive listening and active comprehension. By leveraging the Gemini 2.5 Flash API for multimodal processing, we will generate precise, timestamped transcripts from user-uploaded audio/video or direct YouTube URLs. This allows users to navigate media sentence-by-sentence, enabling "Shadowing" (repeating after the speaker) and precise replay.

Architecture Change: This version transitions from Firebase to Supabase for backend services (Auth, Database) and uses GitHub Pages for hosting. The app remains a static frontend (SPA) but gains the relational data power of PostgreSQL.

2. Core Features & User Flow

2.1. Media Ingestion

File Upload: Users upload a video (.mp4) or audio file (.mp3, .wav) directly in the browser.

Storage: Uploaded files are automatically saved to Supabase Storage bucket for persistence.

URL Input:

YouTube: Paste a direct YouTube link (Native Gemini support).

Direct Media: .mp4 or .mp3 links.

Optional Input: Users can upload an existing transcript (.txt) if they want to align specific text, otherwise, the system generates it.

Processing State: A progress indicator while the content is analyzed by Gemini 2.5.

2.2. The "Smart Player" (The Core Experience)

Hybrid Player:

Automatically switches between a standard HTML5 video player (for file uploads) and a YouTube Embed (via react-player or IFrame API) for online links.

Active Transcript: The current sentence being spoken is highlighted in real-time.

Click-to-Seek: Clicking any sentence in the transcript immediately jumps the video to that timestamp, regardless of the source.

Sentence Controls:

Loop: Button to repeat the current sentence indefinitely.

Next/Prev: Hardware buttons (arrow keys) to jump to the next/previous sentence.

3. Technical Architecture

3.1. Tech Stack

Frontend: React (Vite) + Tailwind CSS.

Library: react-player (Supports YouTube, Facebook, Twitch, and direct file paths).

Backend: Supabase (Backend-as-a-Service).

Auth: Supabase Auth (Email/Password, Social Login).

Database: Supabase PostgreSQL (Relational DB for structured data).

Storage: Supabase Storage (Buckets for user media).

Security: Supabase Edge Functions (Deno) to securely proxy Gemini API calls.

Hosting: GitHub Pages (Free static hosting).

AI Engine: Google Gemini 2.5 Flash Preview.

Capabilities: Native support for video files and direct YouTube URLs. Superior speed and context window.

3.2. Data Structure (Supabase Schema)

We will use relational tables instead of NoSQL documents:

Table: users (Managed by Supabase Auth)

id (UUID, Primary Key)

email

role ('learner' | 'teacher')

Table: transcripts

id (UUID, PK)

user_id (FK -> users.id)

title (Text)

source_type ('youtube' | 'file')

source_url (Text - Public URL from Supabase Storage or YouTube)

duration (Float)

created_at (Timestamp)

Table: segments

id (UUID, PK)

transcript_id (FK -> transcripts.id)

text (Text)

start_time (Float)

end_time (Float)

speaker (Text)

4. Implementation Strategy: The Gemini Integration

4.1. Secure API Key Handling (Crucial Change)

Since we are hosting on GitHub Pages (public static files), we cannot store the GEMINI_API_KEY in the frontend code.

Strategy: Supabase Edge Function Proxy

Client: React App uploads media to Supabase Storage -> gets public URL.

Client: Sends the public URL to Supabase Edge Function.

Edge Function:

Verifies the user's Supabase Auth token.

Retrieves the hidden GEMINI_API_KEY from Supabase Secrets.

Calls Google Gemini 2.5 API securely.

Returns the JSON transcript to the client.

System Prompt (Backend Side):

"You are a professional transcriber tool. I will provide a video file or URL. Your task is to transcribe it into English and provide precise timestamps for the start and end of every sentence. Output STRICT JSON format only. The schema must be an array of objects: { text: string, start: number (seconds), end: number (seconds) }."

5. UI/UX "Smart Player" Logic

5.1. Syncing Logic (Frontend)

The challenge with YouTube is that the IFrame API is asynchronous.

Universal Seek Function:

const seekTo = (seconds) => {
  // react-player handles the abstraction for us mostly,
  // but we need to ensure the internal player is ready.
  playerRef.current.seekTo(seconds, 'seconds');
};



Tracking Time:

File: Standard onTimeUpdate event.

YouTube: The IFrame API doesn't fire updates frequently enough for sentence-level precision. We will need a setInterval running every 100ms while playing to query player.getCurrentTime() for smoother highlighting.

6. Development Phases

Phase 1: The MVP (2 Weeks)

[ ] Basic React setup with react-player.

[ ] Setup Supabase Project (Database + Auth + Storage).

[ ] Deploy "Proxy" Edge Function for Gemini 2.5.

[ ] Integration of Gemini API via Edge Function.

[ ] Displaying the JSON result as a clickable list.

[ ] Deploy to GitHub Pages.

Phase 2: Persistence & Polish (2 Weeks)

[ ] User Accounts (Supabase Auth) - Save my lessons.

[ ] Database Integration - Store transcript rows linked to User ID.

[ ] "History" feature: Query transcripts table for past sessions.

[ ] "Edit Mode": Allow users to update segments rows.

Phase 3: Advanced Learning

[ ] Vocabulary Extraction: Ask Gemini to pull out "C1 level words".

[ ] Shadowing Recorder: Compare user voice to original audio.

Please add a record function allow users to record and listen the that record. The record can be saved with maximum 30 records.

Transcript goes wrong on the sentence 0:58 - 1:47. This sentence actually stops on 1:08. All timestamps after it are wrong. Please fix.

Timestamp goes wrong on the sentence 0:58 - 1:47. This sentence actually stops on 1:09, so the next sentence should start on 1:09. Please fix the timestamps of all following sentences.

           if (fileObject) {
                const filePart = await fileToGenerativePart(fileObject);
                parts = [filePart, { text: `Act as an elite speech-to-text engine. Transcribe this audio faithfully. 
                Requirements:
                1. Split into clear, logical sentences.
                2. Precise timestamps: Match speech boundaries exactly. 
                3. Strictly contiguous: Segment N end must equal Segment N+1 start.
                4. Duration: ${totalDuration.toFixed(2)}s. First segment starts at 0.00. Last segment ends at ${totalDuration.toFixed(2)}.
                Output JSON: Array<{ text: string, start: number, end: number, speaker: string }>.` }];
            }

Please fix the timestamps:
- align the timestamps with the audio. They're currently not aligned. For example the sentence 0:58-1:44 actually stops at 1:07. This error makes all following timestamps wrong.
- The timestamps exceeds the audio time.

Can we try this approach: The start time starts with the first letter of a sentence, and the end time is 1 or 2 millisecond of the start time of the next sentence?


Features including UI, user auth were not retained. Please only aligned the Transcript Generation strictly with the logic from your success example (App.jsx). Other parts (such as UI, user auth, etc) should stay with the previous html version as attached.

It looks great!

I tested three sample audios and spot a problem: Gemini make a mistake for the timestamp around 0:57 - 1:47. This time span can cover multiple sentences but Gemini marked this timestamp on one sentence.

Can we improve the prompt so that Gemini could avoid this mistake?

Please make this update based on the attached html file.
Based on your feedback and the screenshots (which show single segments spanning ~50 seconds), the issue is that the AI model is getting "lazy" and grouping multiple sentences into a single block instead of splitting them.
To fix this, we need to harden the prompt to strictly forbid "Paragraph-Level" timestamps and enforce "Sentence-Level" granularity.

The Fix: Prompt Engineering
I have updated the processTranscription function with a much stricter prompt:

"One Sentence Per Object" Rule: Explicitly forbids merging sentences.
"Split on Punctuation" Rule: Forces a split at every ., ?, or !.
"No Lazy Grouping": Tells the AI that long segments (>15s) are considered errors.
I also kept the Gemini 2.5 model and the Zipper/Chain logic (Start = Prev End) because those are working well for the alignment itself.