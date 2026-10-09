# AI Daily Life Assistant: Stage 1 (frontend)

Run: serve the folder (`npx serve .`) and open `login.html`. Run `supabase/migrations/001_init.sql` in the Supabase SQL Editor first.
Data is stored in Supabase, protected by row-level security.

## What works
Today dashboard, Planner (day plan for today or tomorrow, quick reminders, goal breakdown, all confirm-before-save),
Overview charts, tasks (filter, search, edit, overdue flag, due, priority), reminders (in-page toast + optional browser notification), notes with
action-item extraction, goals with progress, settings, JSON export, delete all data.

## Where later stages plug in
- Stage 2 (Supabase): replace the functions in `js/store.js` (same `DB.tasks.list/add/update/remove` shape). Add auth and RLS.
- Stage 3 (AI): replace `Assistant.respond` in `js/assistant.js` with a call to a Supabase Edge Function that holds the AI key. Never put keys in browser code.
- Stage 4 (Reminders): scheduled Edge Function finds due reminders and sends email; log to `notification_logs`.

## Business assistant (OpenAI)
The Assistant page answers any question (business, writing, code, study, daily life), can search the web and shows its sources, and can see your open tasks, goals and reminders.
The OpenAI key is stored only as a Supabase secret and used by the Edge Function in `supabase/functions/assistant`. The browser never sees it.

Setup (uses the Supabase CLI via `npx supabase ...`, no install needed beyond Node.js):
1. `npx supabase login` then `npx supabase link --project-ref yoahgqalgminfzpdpepo`
2. `npx supabase secrets set OPENAI_API_KEY=sk-...` (optional: `OPENAI_MODEL=...` to pick a model; default `gpt-5.5`, falling back to `gpt-4.1` then `gpt-4o-mini` if your account lacks it)
3. `npx supabase functions deploy assistant`
4. Open the app, go to Assistant, ask a question.

Safeguards: only signed-in users can call it, 60 questions per user per hour, last 30 messages sent per request, chats saved to the `messages` table (protected by row-level security). Set a monthly spend limit in your OpenAI account.

## Version 2: no AI (history)
The AI chat was removed in v2 and has now returned as the Assistant page (above). The Planner page generates a day plan, reminders and goal steps from simple options, and the Overview page shows charts. Everything runs in the browser. The old Supabase Edge Function and its secrets are no longer used and can be deleted.
