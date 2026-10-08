/* Stage 1 assistant: a rule-based stand-in. Stage 3 replaces respond() with a call to a server-side AI function.
   It only PROPOSES changes. Nothing is saved until the user confirms. */
(function () {
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function parseWhen(text) {
    var t = text.toLowerCase(), d = new Date(), hasDay = false;
    if (/\btomorrow\b/.test(t)) { d.setDate(d.getDate() + 1); hasDay = true; }
    else if (/\btoday\b|\btonight\b/.test(t)) { hasDay = true; }
    else { DAYS.forEach(function (n, i) { if (new RegExp('\\b' + n + '\\b').test(t)) { var diff = (i - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); hasDay = true; } }); }
    var m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || t.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
    if (!m) return { hasDay: hasDay, date: null };
    var h = +m[1], min = +(m[2] || 0), ap = m[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    d.setHours(h, min, 0, 0);
    return { hasDay: hasDay, date: d };
  }
  function clean(s) {
    return s.replace(/\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, '')
      .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/ig, '').replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/ig, '')
      .replace(/\s+/g, ' ').replace(/^(to|that)\s+/i, '').trim();
  }
  var P = { high: 0, medium: 1, low: 2 };
  window.Assistant = {
    suggestions: ['Plan my day', 'Remind me to call the client tomorrow at 2 PM', 'Add task: pay electricity bill', 'Break down: prepare a client proposal'],
    respond: async function (text, ctx) {
      try {
        var hist = (ctx.messages || []).slice(0, -1).map(function (m) { return { role: m.role, content: m.content }; });
        var r = await window.sb.functions.invoke('ai-chat', { body: { text: text, history: hist } });
        if (r.error) {
          var st = r.error.context && r.error.context.status;
          if (st === 429) return { content: 'You have reached today\'s AI limit. Try again tomorrow, or use the simple commands: Plan my day, Remind me to …, Add task: …' };
          throw r.error;
        }
        if (r.data && r.data.content) return { content: r.data.content, proposal: r.data.proposal || undefined };
        throw new Error('empty');
      } catch (e) { console.warn('AI unavailable, using local fallback', e); return this.localRespond(text, ctx); }
    },
    localRespond: async function (text, ctx) {
      var m;
      if ((m = text.match(/remind me (.+)/i))) {
        var w = parseWhen(m[1]), title = clean(m[1]);
        if (!title) return { content: 'What should I remind you about?' };
        if (!w.date) return { content: 'What time should I remind you' + (w.hasDay ? '' : ' and on which day') + '? For example: "' + text.replace(/\.$/, '') + ' at 2 PM".' };
        if (!w.hasDay && w.date < new Date()) w.date.setDate(w.date.getDate() + 1);
        return { content: 'Here is the reminder I understood. Check it, then save.', proposal: { type: 'reminder', title: title, due_at: w.date.toISOString() } };
      }
      if (/plan (my )?(day|today)/i.test(text)) {
        var open = ctx.tasks.filter(function (t) { return t.status !== 'done'; })
          .sort(function (a, b) { return (P[a.priority] - P[b.priority]) || String(a.due_at || 'z').localeCompare(String(b.due_at || 'z')); }).slice(0, 6);
        if (!open.length) return { content: 'You have no open tasks yet. Add a few on the Tasks page, or tell me what you need to do today.' };
        var st = (ctx.profile.day_start || '08:00').split(':'), t0 = new Date(); t0.setHours(+st[0], +st[1], 0, 0);
        if (t0 < new Date()) { t0 = new Date(); t0.setMinutes(Math.ceil(t0.getMinutes() / 15) * 15, 0, 0); }
        var items = open.map(function (t) { var s = new Date(t0), e = new Date(t0.getTime() + 3600000); t0 = new Date(e.getTime() + 600000); return { task_id: t.id, title: t.title, start: s.toISOString(), end: e.toISOString() }; });
        return { content: 'Here is a draft plan with one-hour blocks, highest priority first. Save it to schedule these tasks, or dismiss it.', proposal: { type: 'plan', items: items } };
      }
      if ((m = text.match(/^(?:add|create)\s+(?:a\s+)?task\s*:?\s*(.+)/i))) {
        return { content: 'Add this task?', proposal: { type: 'tasks', items: [{ title: m[1].trim(), priority: 'medium' }] } };
      }
      if ((m = text.match(/break (?:down|up)\s*:?\s*(.+)/i))) {
        var g = m[1].trim();
        return { content: 'A first pass at steps for "' + g + '". Save the ones you want.', proposal: { type: 'tasks', items: ['Define what finished looks like for ' + g, 'List what you need and who to ask', 'Do the first rough version', 'Review and fix the weak parts', 'Finish and send or submit'].map(function (s) { return { title: s, priority: 'medium' }; }) } };
      }
      return { content: 'I\'m a demo assistant for now, so I handle a few requests. Try "Plan my day", "Remind me to … tomorrow at 2 PM", "Add task: …" or "Break down: …". The full AI assistant is temporarily unavailable.' };
    },
    extractActions: function (body) {
      return body.split(/\n+/).map(function (l) { return l.trim(); })
        .filter(function (l) { return /^([-*•]|\d+[.)]|\[ \]|todo|action)/i.test(l); })
        .map(function (l) { return l.replace(/^([-*•]|\d+[.)]|\[ \]|todo:?|action:?)\s*/i, '').trim(); }).filter(Boolean).slice(0, 10);
    }
  };
})();
