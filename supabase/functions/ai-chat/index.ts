// Supabase Edge Function: business assistant backed by OpenAI.
// The OpenAI key lives ONLY here, as a secret. The browser never sees it.
// Deploy:  supabase functions deploy assistant
// Secrets: supabase secrets set OPENAI_API_KEY=sk-...   (optional: OPENAI_MODEL=<model your account has>)
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MAX_MSGS = 30, MAX_LEN = 6000, HOURLY_LIMIT = 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'The assistant is not set up yet (missing OPENAI_API_KEY).' }, 500);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: u, error: ue } = await sb.auth.getUser();
  if (ue || !u?.user) return json({ error: 'Please sign in again.' }, 401);

  let body: { messages?: { role: string; content: string }[]; useContext?: boolean; webSearch?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  const msgs = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MSGS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_LEN) }));
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'user') return json({ error: 'Send a question first.' }, 400);

  // Simple per-user rate limit, counted from saved user messages.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', since);
  if ((count ?? 0) >= HOURLY_LIMIT) return json({ error: 'Hourly limit reached. Please try again later.' }, 429);

  const { data: prof } = await sb.from('profiles').select('display_name,timezone').eq('id', u.user.id).maybeSingle();
  const tz = prof?.timezone || 'UTC';
  const web = body.webSearch !== false;
  let system =
    `You are a capable, knowledgeable AI assistant inside the Daily Life Assistant app. Answer any question the user asks, on any topic: ` +
    `business, writing, coding, maths, science, health, law, travel, learning, everyday life, or just conversation. ` +
    `You are especially strong on running a business (strategy, pricing, marketing, sales, operations, hiring, finance basics, emails, proposals, plans). ` +
    `Give direct, complete, accurate answers; go as deep as the question needs and no deeper. Do the work (write the email, the code, the plan) instead of only describing it. ` +
    `Format with short paragraphs and "-" bullet lists; use **bold** sparingly; no headings or tables. Put code in backticks. ` +
    (web ? `You can search the web: use it for anything current or checkable (news, prices, laws, products, people, recent events) and when you are unsure. ` : '') +
    `If you do not know or cannot verify something, say so plainly; never invent facts, numbers, quotes or sources. ` +
    `For legal, tax, medical or investment decisions, give real, useful information and note when a qualified professional should confirm it. Decline only requests that are clearly harmful. ` +
    `Today is ${new Date().toLocaleDateString('en-GB', { timeZone: tz, dateStyle: 'full' })} (time zone ${tz}).` +
    (prof?.display_name ? ` The user's name is ${prof.display_name}.` : '');

  if (body.useContext !== false) {
    const [t, g, r] = await Promise.all([
      sb.from('tasks').select('title,priority,due_at').neq('status', 'done').order('created_at', { ascending: false }).limit(15),
      sb.from('goals').select('title,progress,target_date').limit(8),
      sb.from('reminders').select('title,due_at').eq('status', 'pending').limit(8),
    ]);
    const fmt = (rows: any[] | null, f: (x: any) => string) => (rows?.length ? rows.map(f).join('; ') : 'none');
    system += `\n\nThe user's own data (use it only when relevant to the question, never recite it unprompted):\n` +
      `Open tasks: ${fmt(t.data, (x) => `${x.title} [${x.priority}${x.due_at ? ', due ' + x.due_at : ''}]`)}\n` +
      `Goals: ${fmt(g.data, (x) => `${x.title} (${x.progress}%${x.target_date ? ', target ' + x.target_date : ''})`)}\n` +
      `Pending reminders: ${fmt(r.data, (x) => `${x.title} (${x.due_at})`)}`;
  }

  // Try the configured model first, then fall back if the account does not have it.
  const models = [Deno.env.get('OPENAI_MODEL') || 'gpt-5.5', 'gpt-4.1', 'gpt-4o-mini'].filter((m, i, a) => a.indexOf(m) === i);
  let data: any = null, status = 0;
  for (const model of models) {
    const ai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: system,
        input: msgs,
        max_output_tokens: 4000,
        store: false,
        ...(web ? { tools: [{ type: 'web_search' }] } : {}),
      }),
    });
    status = ai.status;
    if (ai.ok) { data = await ai.json(); break; }
    const txt = await ai.text();
    console.error('OpenAI error', model, ai.status, txt);
    if (ai.status === 401 || ai.status === 429) break;          // key or quota problem: other models will not help
    // otherwise (model missing, tool unsupported, bad params) try the next model
  }
  if (!data) {
    return json({ error: status === 401 ? 'The OpenAI key was rejected. Check OPENAI_API_KEY.'
      : status === 429 ? 'OpenAI says the account is busy or out of credit. Check billing and limits.'
      : 'The assistant could not answer. Please try again.' }, 502);
  }

  let reply = '';
  const sources = new Map<string, string>();
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c.type !== 'output_text') continue;
      reply += c.text;
      for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) sources.set(a.url.split('?utm_')[0], a.title || a.url);
    }
  }
  reply = reply.replace(/\s*\(\[[^\]]*\]\(https?:[^)]*\)\)/g, '').trim() || 'Sorry, I could not produce an answer.';
  const src = [...sources].slice(0, 6).map(([url, title]) => ({ url, title }));

  // Save both sides of the exchange (RLS stamps user_id).
  await sb.from('messages').insert([{ role: 'user', content: last.content }, { role: 'assistant', content: reply, proposal: src.length ? { sources: src } : null }]);
  return json({ reply, sources: src });
});
