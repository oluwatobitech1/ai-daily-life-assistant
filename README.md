# AI Daily Life Assistant: Stage 1 (frontend)

Run: serve the folder (`npx serve .`) and open `login.html`. Run `supabase/migrations/001_init.sql` in the Supabase SQL Editor first.
Data is stored in Supabase, protected by row-level security.

## What works
Today dashboard, assistant with confirm-before-save cards (plan day, reminder, add task, break down goal),
tasks (filter, search, due, priority), reminders (in-page toast + optional browser notification), notes with
action-item extraction, goals with progress, settings, JSON export, delete all data.

## Where later stages plug in
- Stage 2 (Supabase): replace the functions in `js/store.js` (same `DB.tasks.list/add/update/remove` shape). Add auth and RLS.
- Stage 3 (AI): replace `Assistant.respond` in `js/assistant.js` with a call to a Supabase Edge Function that holds the AI key. Never put keys in browser code.
- Stage 4 (Reminders): scheduled Edge Function finds due reminders and sends email; log to `notification_logs`.

## Stage 3 (AI)
Run `supabase/migrations/002_ai_usage.sql`, then deploy `supabase/functions/ai-chat` with the Gemini key stored as a Supabase secret (`GEMINI_API_KEY`).
If the function is unreachable, the app falls back to the simple built-in commands. Limit: 60 AI requests per user per rolling 24 hours.

## Deploy (GitHub + Vercel)
1. Push this folder to a GitHub repository (private is fine).
2. Vercel: Add New, Project, import the repo. Framework preset "Other". Leave build command and output directory empty. Deploy.
3. Supabase, Authentication, URL Configuration: set Site URL to your Vercel URL and add it (with /app.html) to Redirect URLs.
4. Before real users sign up: turn "Confirm email" back on (Authentication, Sign In / Providers).
Never commit secret keys. Only the public Supabase URL and publishable key live in js/config.js.
