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

[{"end": 4.4, "text": "Okay, Phoebe, you look in the kitchen, I will look in the back closet.", "start": 0, "speaker": "Speaker"}, {"end": 7.1, "text": "I can save you time, ladies, I'm right here.", "start": 4.4, "speaker": "Speaker"}, {"end": 12.3, "text": "Chandler, why don't you take a walk, this doesn't concern you.", "start": 7.1, "speaker": "Speaker"}, {"end": 16.3, "text": "We are looking for our Christmas presents for Monica.", "start": 12.3, "speaker": "Speaker"}, {"end": 17, "text": "What?", "start": 16.3, "speaker": "Speaker"}, {"end": 17.8, "text": "That's terrible.", "start": 17, "speaker": "Speaker"}, {"end": 19.4, "text": "No, no, we do it every year.", "start": 17.8, "speaker": "Speaker"}, {"end": 22.2, "text": "Oh, well, that that makes it not terrible.", "start": 19.4, "speaker": "Speaker"}, {"end": 25.4, "text": "No, yeah, we never find them.", "start": 22.2, "speaker": "Speaker"}, {"end": 29.5, "text": "She's always bested us, that wily minx.", "start": 25.4, "speaker": "Speaker"}, {"end": 34.8, "text": "Don't worry, we're just going to search here for an hour and then we're going to go over to Joey's and search, okay?", "start": 29.5, "speaker": "Speaker"}, {"end": 38, "text": "No, not okay, you can't look for Monica's presents.", "start": 34.8, "speaker": "Speaker"}, {"end": 38.9, "text": "Oh no, we have to.", "start": 38, "speaker": "Speaker"}, {"end": 42.6, "text": "No, you don't have to, and you can't because I I live here too.", "start": 38.9, "speaker": "Speaker"}, {"end": 46.8, "text": "Well, then you should look with us.", "start": 42.6, "speaker": "Speaker"}, {"end": 48.3, "text": "Why?", "start": 46.8, "speaker": "Speaker"}, {"end": 51.6, "text": "Chandler, are you worried about what to get Monica for Christmas?", "start": 48.3, "speaker": "Speaker"}, {"end": 54.1, "text": "No, I have a great idea for a present for her.", "start": 51.6, "speaker": "Speaker"}, {"end": 56.8, "text": "Oh, that's it, a great idea, I guess.", "start": 54.1, "speaker": "Speaker"}, {"end": 59.6, "text": "Chandler, that's not enough.", "start": 56.8, "speaker": "Speaker"}, {"end": 105.4, "text": "I mean, what if she gets you a great present, two medium presents, and then a bunch of little presents, and you've just gotten her one great present?", "start": 59.6, "speaker": "Speaker"}, {"end": 107, "text": "I mean, that's just going to make her feel bad.", "start": 105.4, "speaker": "Speaker"}, {"end": 108.4, "text": "Why would you do that to her, Chandler?", "start": 107, "speaker": "Speaker"}, {"end": 108.8, "text": "Why?", "start": 108.4, "speaker": "Speaker"}, {"end": 109.6, "text": "Why?", "start": 108.8, "speaker": "Speaker"}, {"end": 113.3, "text": "If I helped, we could find them faster.", "start": 109.6, "speaker": "Speaker"}, {"end": 114, "text": "That's right.", "start": 113.3, "speaker": "Speaker"}, {"end": 117.5, "text": "Oh, we have a live one.", "start": 114, "speaker": "Speaker"}, {"end": 119, "text": "Oh, it's a Macy's bag.", "start": 117.5, "speaker": "Speaker"}, {"end": 119.8, "text": "Yeah.", "start": 119, "speaker": "Speaker"}, {"end": 123.3, "text": "Ooh, who's it for?", "start": 119.8, "speaker": "Speaker"}, {"end": 129.7, "text": "Dear losers, do you really think I'd hide presents under the couch?", "start": 123.3, "speaker": "Speaker"}, {"end": 134.4, "text": "Yes, Chandler, I knew they'd break you.", "start": 129.7, "speaker": "Speaker"}, {"end": 139.1, "text": "Uh-oh, she may be on to us.", "start": 134.4, "speaker": "Speaker"}, {"end": 143.4, "text": "We are so going to find them this year.", "start": 139.1, "speaker": "Speaker"}, {"end": 147.6, "text": "You know, you guys said you were going to go across the hall and look, you don't you don't do that every year, do you?", "start": 143.4, "speaker": "Speaker"}, {"end": 148.7, "text": "Yeah.", "start": 147.6, "speaker": "Speaker"}, {"end": 154.4, "text": "You don't like go into the back of my closet and look under my gym bag or anything.", "start": 148.7, "speaker": "Speaker"}, {"end": 156.3, "text": "No.", "start": 154.4, "speaker": "Speaker"}, {"end": 157.6, "text": "No, we never do that.", "start": 156.3, "speaker": "Speaker"}, {"end": 204.8, "text": "Because that's where Joey gave me some stuff to store that I've never seen before in my life.", "start": 157.6, "speaker": "Speaker"}, {"end": 208.4, "text": "I couldn't find anything in Joey.", "start": 204.8, "speaker": "Speaker"}, {"end": 208.8, "text": "I I I I.", "start": 208.4, "speaker": "Speaker"}, {"end": 211.9, "text": "Yeah, we found them, they were in the guest room closet behind some coats.", "start": 208.8, "speaker": "Speaker"}, {"end": 214.8, "text": "Yeah, and you have nothing to worry about cuz they're all crap.", "start": 211.9, "speaker": "Speaker"}, {"end": 220, "text": "Those are my gifts, I got those for you.", "start": 214.8, "speaker": "Speaker"}, {"end": 225.5, "text": "Oh, thanks, Chandler, they're great.", "start": 220, "speaker": "Speaker"}, {"end": 231.3, "text": "Well, Chandler, then what is this very weird metal AZ thing?", "start": 225.5, "speaker": "Speaker"}, {"end": 232.7, "text": "That's a book ends.", "start": 231.3, "speaker": "Speaker"}, {"end": 234.1, "text": "That's a great gift.", "start": 232.7, "speaker": "Speaker"}, {"end": 237.4, "text": "Oh, okay, I'm sorry, thank you for my ass.", "start": 234.1, "speaker": "Speaker"}, {"end": 243.5, "text": "Make sure you put all that stuff back in the closet, okay?", "start": 237.4, "speaker": "Speaker"}, {"end": 245, "text": "Yes, okay.", "start": 243.5, "speaker": "Speaker"}, {"end": 252.2, "text": "Oh, by the way, I just got to say, I think it's really nice of you that even after you've moved, you still keep storing that stuff for Joey.", "start": 245, "speaker": "Speaker"}, {"end": 256.5, "text": "Birds have a very good sense of direction.", "start": 252.2, "speaker": "Speaker"}, {"end": 259.6, "text": "And I thought maybe they could help us find where the presents are hidden.", "start": 256.5, "speaker": "Speaker"}, {"end": 303.9, "text": "Yes, if the presents are hidden south for the winter.", "start": 259.6, "speaker": "Speaker"}, {"end": 307.33932, "text": "Or we could just follow your clever jokes, any ideas?", "start": 303.9, "speaker": "Speaker"}, {"end": 307.33932, "text": "No, didn't think so.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Okay.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Come on, guys, show us where the presents are.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Well, the duck seems to think that Monica got me garbage.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "I wonder what I can get Monica that's as good as garbage.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Hmm, how about my ass?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Hey.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "This is hollow.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "What?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "This bench, it's hollow.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "I can't believe I never knew that.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Oh, good present.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Oh, no, don't look directly at them.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "What?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "All right, no, we could look at them.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Oh, this one's for me.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Oh, oh, this one's for Chandler.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Here.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "And the big one's for me.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Oh, look, they're so cute.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Okay, okay.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Wait a minute, wait a minute, we can't do this.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Why?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "I don't want to know what Monica got me, you know?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "I mean, look, I'm sure she worked really hard at getting me a present and wanting to surprise me, and you guys are going to ruin that.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Look, we have to put these back, this is not what Christmas is about.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Whatever, Linus, I'm opening mine.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Nobody is opening anything, okay?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Look.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "I don't know about you guys, but I want to see the look on Monica's face when I give her my present, and I'm sure she wants to see the look on my face when I get mine.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "So please, please, can we just can we put them back?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Will you get us better gifts?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Fine.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Hey guys.", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "You found the presents?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Chandler, you let them find the presents?", "start": 307.33932, "speaker": "Speaker"}, {"end": 307.33932, "text": "Great.", "start": 307.33932, "speaker": "Speaker"}...