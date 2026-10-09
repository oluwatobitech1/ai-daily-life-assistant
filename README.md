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

## Version 2: no AI
The AI chat was removed. The Planner page generates a day plan, reminders and goal steps from simple options, and the Overview page shows charts. Everything runs in the browser. The old Supabase Edge Function and its secrets are no longer used and can be deleted.
