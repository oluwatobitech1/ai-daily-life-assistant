(function () {
  'use strict';
  var $ = function (s, e) { return (e || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) { return iso ? new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''; }
  function hm(iso) { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }
  function toast(m) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('#live').appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function iso(v) { return v ? new Date(v).toISOString() : null; }
  var byDue = function (a, b) { return String(a.due_at || 'z').localeCompare(String(b.due_at || 'z')); };

  function taskLi(t) {
    return '<li class="' + (t.status === 'done' ? 'done' : '') + '"><input type="checkbox" data-act="toggle" data-id="' + t.id + '" aria-label="Mark done: ' + esc(t.title) + '"' + (t.status === 'done' ? ' checked' : '') + '>' +
      '<div class="t"><b>' + esc(t.title) + '</b><br><small>' + (t.scheduled_start ? 'Planned ' + hm(t.scheduled_start) + ' to ' + hm(t.scheduled_end) : t.due_at ? 'Due ' + fmt(t.due_at) : 'No due date') + '</small></div>' +
      '<span class="tag ' + esc(t.priority) + '">' + esc(t.priority) + '</span><button class="btn danger sm" data-act="del" data-t="tasks" data-id="' + t.id + '" aria-label="Delete task ' + esc(t.title) + '">Delete</button></li>';
  }
  function remLi(r) {
    return '<li class="' + (r.status === 'sent' ? 'done' : '') + '"><div class="t"><b>' + esc(r.title) + '</b><br><small>' + fmt(r.due_at) + (r.status === 'sent' ? ' (delivered)' : '') + '</small></div>' +
      '<button class="btn danger sm" data-act="del" data-t="reminders" data-id="' + r.id + '" aria-label="Delete reminder ' + esc(r.title) + '">Delete</button></li>';
  }

  async function vToday() {
    var p = await DB.profile.get(), tasks = await DB.tasks.list(), rem = await DB.reminders.list();
    var h = new Date().getHours(), g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var open = tasks.filter(function (t) { return t.status !== 'done'; });
    var done = tasks.filter(function (t) { return t.completed_at && isToday(t.completed_at); });
    var focus = open.filter(function (t) { return !t.due_at || isToday(t.due_at) || new Date(t.due_at) < new Date(); }).sort(byDue).slice(0, 6);
    var up = rem.filter(function (r) { return r.status === 'pending'; }).sort(byDue);
    return '<h1>' + g + (p.display_name ? ', ' + esc(p.display_name) : '') + '</h1><p class="muted">' + new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
      '<form class="row" data-form="ask"><label class="sr" for="ask">Ask your assistant</label><input id="ask" class="grow" placeholder="Ask your assistant, e.g. Plan my day" required maxlength="500"><button class="btn">Ask</button></form>' +
      '<div class="chips">' + Assistant.suggestions.slice(0, 3).map(function (s) { return '<button class="chip" data-act="chip" data-text="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div class="stats"><div class="stat"><b>' + open.length + '</b><span>Open tasks</span></div><div class="stat"><b>' + done.length + '</b><span>Done today</span></div><div class="stat"><b>' + (up[0] ? hm(up[0].due_at) : 'None') + '</b><span>Next reminder</span></div></div>' +
      '<section class="panel"><h2>Today\'s focus</h2>' + (focus.length ? '<ul class="list">' + focus.map(taskLi).join('') + '</ul>' : '<p class="empty">Nothing due today. Add a task or ask the assistant to plan your day.</p>') + '</section>' +
      '<section class="panel"><h2>Upcoming reminders</h2>' + (up.length ? '<ul class="list">' + up.slice(0, 4).map(remLi).join('') + '</ul>' : '<p class="empty">No reminders set.</p>') + '</section>';
  }

  function propHtml(m) {
    var p = m.proposal; if (!p) return '';
    if (m.state === 'saved') return '<div class="proposal">Saved.</div>';
    if (m.state === 'dismissed') return '<div class="proposal muted">Dismissed. Nothing was saved.</div>';
    var body = p.type === 'reminder' ? '<b>' + esc(p.title) + '</b><br>' + fmt(p.due_at) :
      p.type === 'plan' ? '<ul>' + p.items.map(function (i) { return '<li>' + hm(i.start) + ' to ' + hm(i.end) + ': ' + esc(i.title) + '</li>'; }).join('') + '</ul>' :
        '<ul>' + p.items.map(function (i) { return '<li>' + esc(i.title) + '</li>'; }).join('') + '</ul>';
    return '<div class="proposal">' + body + '<div class="row"><button class="btn sm" data-act="psave" data-id="' + m.id + '">Save</button><button class="btn ghost sm" data-act="pdismiss" data-id="' + m.id + '">Dismiss</button></div></div>';
  }
  async function vAssistant() {
    var msgs = (await DB.messages.list()).slice().reverse();
    return '<h1>Assistant</h1><p class="muted">The assistant suggests. Nothing is saved until you press Save.</p>' +
      '<div class="chips">' + Assistant.suggestions.map(function (s) { return '<button class="chip" data-act="chip" data-text="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div class="chat" role="log" aria-live="polite">' + (msgs.length ? msgs.map(function (m) { return '<div class="msg ' + m.role + '">' + esc(m.content) + propHtml(m) + '</div>'; }).join('') : '<p class="empty">No messages yet. Pick a suggestion or type below.</p>') + '</div>' +
      '<form class="row" data-form="chat"><label class="sr" for="chatin">Message</label><input id="chatin" class="grow" required maxlength="500" placeholder="Type a request"><button class="btn">Send</button><button type="button" class="btn ghost" data-act="clearchat">Clear chat</button></form>';
  }

  async function vTasks() {
    var f = sessionStorage.getItem('tf') || 'open', q = (sessionStorage.getItem('tq') || '').toLowerCase();
    var tasks = (await DB.tasks.list()).filter(function (t) { return (f === 'all' || (f === 'done') === (t.status === 'done')) && t.title.toLowerCase().indexOf(q) > -1; }).sort(byDue);
    return '<h1>Tasks</h1><form class="panel row" data-form="task"><div class="grow"><label for="tt">Task</label><input id="tt" required maxlength="200" style="width:100%"></div><div><label for="tp">Priority</label><select id="tp"><option>medium</option><option>high</option><option>low</option></select></div><div><label for="td">Due</label><input id="td" type="datetime-local"></div><button class="btn">Add task</button></form>' +
      '<div class="row" style="margin-bottom:.8rem"><label class="sr" for="tfs">Filter</label><select id="tfs" data-act="tfilter"><option value="open"' + (f === 'open' ? ' selected' : '') + '>Open</option><option value="done"' + (f === 'done' ? ' selected' : '') + '>Done</option><option value="all"' + (f === 'all' ? ' selected' : '') + '>All</option></select><label class="sr" for="tqs">Search</label><input id="tqs" type="search" placeholder="Search tasks" value="' + esc(q) + '" data-act="tsearch"></div>' +
      '<section class="panel">' + (tasks.length ? '<ul class="list">' + tasks.map(taskLi).join('') + '</ul>' : '<p class="empty">No tasks here. Add one above.</p>') + '</section>';
  }
  async function vReminders() {
    var r = (await DB.reminders.list()).sort(byDue), up = r.filter(function (x) { return x.status === 'pending'; }), past = r.filter(function (x) { return x.status !== 'pending'; });
    var perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return '<h1>Reminders</h1><form class="panel row" data-form="reminder"><div class="grow"><label for="rt">Remind me to</label><input id="rt" required maxlength="200" style="width:100%"></div><div><label for="rd">When</label><input id="rd" type="datetime-local" required></div><button class="btn">Add reminder</button></form>' +
      (perm === 'default' ? '<p><button class="btn ghost sm" data-act="notif">Allow browser notifications</button> <span class="muted">Reminders only fire while this page is open in this stage.</span></p>' : '') +
      '<section class="panel"><h2>Upcoming</h2>' + (up.length ? '<ul class="list">' + up.map(remLi).join('') + '</ul>' : '<p class="empty">No upcoming reminders.</p>') + '</section>' +
      '<section class="panel"><h2>Past</h2>' + (past.length ? '<ul class="list">' + past.map(remLi).join('') + '</ul>' : '<p class="empty">Delivered reminders appear here.</p>') + '</section>';
  }
  async function vNotes() {
    var n = await DB.notes.list();
    return '<h1>Notes</h1><form class="panel" data-form="note"><label for="nt">Title</label><input id="nt" required maxlength="120" style="width:100%"><label for="nb">Note</label><textarea id="nb" maxlength="5000" placeholder="Start action items with - or todo:"></textarea><p></p><button class="btn">Save note</button></form>' +
      (n.length ? n.map(function (x) { return '<section class="panel"><h2>' + esc(x.title) + '</h2><p style="white-space:pre-wrap">' + esc(x.body) + '</p><div class="row"><button class="btn ghost sm" data-act="extract" data-id="' + x.id + '">Find action items</button><button class="btn danger sm" data-act="del" data-t="notes" data-id="' + x.id + '">Delete</button></div><div id="sug-' + x.id + '"></div></section>'; }).join('') : '<p class="empty">No notes yet. Capture an idea above.</p>');
  }
  async function vGoals() {
    var g = await DB.goals.list();
    return '<h1>Goals</h1><form class="panel row" data-form="goal"><div class="grow"><label for="gt">Goal</label><input id="gt" required maxlength="160" style="width:100%"></div><div><label for="gd">Target date</label><input id="gd" type="date"></div><button class="btn">Add goal</button></form>' +
      (g.length ? g.map(function (x) { return '<section class="panel"><h2>' + esc(x.title) + '</h2><p class="muted">' + (x.target_date ? 'Target ' + esc(x.target_date) : 'No target date') + '</p><label for="g' + x.id + '">Progress: ' + x.progress + '%</label><input id="g' + x.id + '" type="range" min="0" max="100" step="5" value="' + x.progress + '" data-act="gprog" data-id="' + x.id + '"> <button class="btn danger sm" data-act="del" data-t="goals" data-id="' + x.id + '">Delete</button></section>'; }).join('') : '<p class="empty">No goals yet. Add one you want to move this month.</p>');
  }
  async function vSettings() {
    var p = await DB.profile.get(), zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [p.timezone]);
    return '<h1>Settings</h1><form class="panel" data-form="profile"><label for="pn">Your name</label><input id="pn" maxlength="60" value="' + esc(p.display_name) + '"><label for="pz">Time zone</label><select id="pz">' + zones.map(function (z) { return '<option' + (z === p.timezone ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select><label for="ps">Start of day</label><input id="ps" type="time" value="' + esc(p.day_start) + '"><p></p><button class="btn">Save settings</button></form>' +
      '<section class="panel"><h2>Your data</h2><p class="muted">Your data is stored in your account and only you can read it. When you use the assistant, your message and open task titles are sent to the Google Gemini API to write the reply.</p><div class="row"><button class="btn ghost" data-act="export">Export data (JSON)</button><button class="btn danger" data-act="wipe">Delete all my data</button></div></section>';
  }

  var ROUTES = { today: ['Today', vToday], assistant: ['Assistant', vAssistant], tasks: ['Tasks', vTasks], reminders: ['Reminders', vReminders], notes: ['Notes', vNotes], goals: ['Goals', vGoals], settings: ['Settings', vSettings] };
  async function render() {
    var r = (location.hash || '#today').slice(1); if (!ROUTES[r]) r = 'today';
    document.querySelectorAll('.side a.nav').forEach(function (a) { if (a.getAttribute('href') === '#' + r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = ROUTES[r][0] + ' · Daily Life Assistant';
    try {
      var html = await ROUTES[r][1](); $('#view').innerHTML = html;
      if (r === 'assistant') { var pre = sessionStorage.getItem('ask'); if (pre) { sessionStorage.removeItem('ask'); send(pre); } else window.scrollTo(0, document.body.scrollHeight); }
    } catch (e) { console.error(e); $('#view').innerHTML = '<p>Something went wrong loading this page.</p><button class="btn" data-act="retry">Try again</button>'; }
  }
  async function send(text) {
    text = text.trim(); if (!text) return;
    await DB.messages.add({ role: 'user', content: text });
    var ctx = { tasks: await DB.tasks.list(), profile: await DB.profile.get(), messages: (await DB.messages.list()).slice(0, 7).reverse() }, res;
    try { res = await Assistant.respond(text, ctx); } catch (e) { res = { content: 'I could not process that. Please try again.' }; }
    await DB.messages.add({ role: 'assistant', content: res.content, proposal: res.proposal || null, state: res.proposal ? 'pending' : null });
    if (location.hash !== '#assistant') location.hash = '#assistant'; else render();
  }
  async function applyProposal(m) {
    var p = m.proposal;
    if (p.type === 'reminder') await DB.reminders.add({ title: p.title, due_at: p.due_at, status: 'pending' });
    else if (p.type === 'tasks') for (var i = 0; i < p.items.length; i++) await DB.tasks.add({ title: p.items[i].title, priority: p.items[i].priority, status: 'open', due_at: null });
    else if (p.type === 'plan') for (var j = 0; j < p.items.length; j++) await DB.tasks.update(p.items[j].task_id, { scheduled_start: p.items[j].start, scheduled_end: p.items[j].end });
  }

  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    var k = f.dataset.form, v = function (id) { return $('#' + id, f) ? $('#' + id, f).value.trim() : ''; };
    try {
      if (k === 'ask') { sessionStorage.setItem('ask', v('ask')); location.hash = '#assistant'; return; }
      if (k === 'chat') { var t = v('chatin'); f.reset(); return send(t); }
      if (k === 'task') { await DB.tasks.add({ title: v('tt'), priority: v('tp'), status: 'open', due_at: iso(v('td')) }); toast('Task added'); }
      if (k === 'reminder') { await DB.reminders.add({ title: v('rt'), due_at: iso(v('rd')), status: 'pending' }); toast('Reminder saved'); }
      if (k === 'note') { await DB.notes.add({ title: v('nt'), body: v('nb') }); toast('Note saved'); }
      if (k === 'goal') { await DB.goals.add({ title: v('gt'), target_date: v('gd'), progress: 0 }); toast('Goal added'); }
      if (k === 'profile') { await DB.profile.set({ display_name: v('pn'), timezone: v('pz'), day_start: v('ps') || '08:00' }); toast('Settings saved'); }
      if (k === 'quick') {
        var ty = v('qk'), ti = v('qt'), wh = iso(v('qw'));
        if (ty === 'task') await DB.tasks.add({ title: ti, priority: 'medium', status: 'open', due_at: wh });
        else if (ty === 'note') await DB.notes.add({ title: ti, body: '' });
        else { if (!wh) { toast('Choose a time for the reminder'); return; } await DB.reminders.add({ title: ti, due_at: wh, status: 'pending' }); }
        $('#quick').close(); f.reset(); toast('Saved');
      }
      render();
    } catch (err) { console.error(err); toast('Could not save. Please try again.'); }
  });
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
    var a = b.dataset.act, id = b.dataset.id;
    try {
      if (a === 'chip') return send(b.dataset.text);
      if (a === 'retry') return render();
      if (a === 'quick') return $('#quick').showModal();
      if (a === 'del') { if (!confirm('Delete this item? This cannot be undone.')) return; await DB[b.dataset.t].remove(id); return render(); }
      if (a === 'psave' || a === 'pdismiss') {
        var m = (await DB.messages.list()).filter(function (x) { return x.id === id; })[0]; if (!m) return;
        if (a === 'psave') { await applyProposal(m); await DB.messages.update(id, { state: 'saved' }); toast('Saved'); } else await DB.messages.update(id, { state: 'dismissed' });
        return render();
      }
      if (a === 'clearchat') { if (!confirm('Clear the whole conversation?')) return; var all = await DB.messages.list(); for (var i = 0; i < all.length; i++) await DB.messages.remove(all[i].id); return render(); }
      if (a === 'extract') {
        var n = (await DB.notes.list()).filter(function (x) { return x.id === id; })[0], s = Assistant.extractActions(n.body), box = $('#sug-' + id);
        box.innerHTML = s.length ? '<ul class="list">' + s.map(function (x) { return '<li><span class="t">' + esc(x) + '</span><button class="btn sm" data-act="addsug" data-text="' + esc(x) + '">Add as task</button></li>'; }).join('') + '</ul>' : '<p class="empty">No action items found. Start lines with - or todo:</p>';
        return;
      }
      if (a === 'addsug') { await DB.tasks.add({ title: b.dataset.text, priority: 'medium', status: 'open', due_at: null }); b.closest('li').remove(); return toast('Task added'); }
      if (a === 'notif') { await Notification.requestPermission(); return render(); }
      if (a === 'export') { var blob = new Blob([JSON.stringify(await DB.exportAll(), null, 2)], { type: 'application/json' }), l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'daily-life-assistant-export.json'; l.click(); return; }
      if (a === 'wipe') { if (confirm('Delete all tasks, notes, reminders, goals and chats from this browser?')) { await DB.wipe(); toast('All data deleted'); render(); } }
    } catch (err) { console.error(err); toast('That did not work. Please try again.'); }
  });
  document.addEventListener('change', async function (e) {
    var t = e.target, a = t.dataset && t.dataset.act; if (!a) return;
    if (a === 'toggle') { await DB.tasks.update(t.dataset.id, { status: t.checked ? 'done' : 'open', completed_at: t.checked ? new Date().toISOString() : null }); render(); }
    if (a === 'tfilter') { sessionStorage.setItem('tf', t.value); render(); }
    if (a === 'gprog') { await DB.goals.update(t.dataset.id, { progress: +t.value }); render(); }
  });
  var tmr; document.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.act === 'tsearch') { var v = e.target.value; clearTimeout(tmr); tmr = setTimeout(function () { sessionStorage.setItem('tq', v); render().then(function () { var i = $('#tqs'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }); }, 250); } });

  async function checkReminders() {
    try {
      var due = (await DB.reminders.list()).filter(function (r) { return r.status === 'pending' && new Date(r.due_at) <= new Date(); });
      for (var i = 0; i < due.length; i++) {
        await DB.reminders.update(due[i].id, { status: 'sent', sent_at: new Date().toISOString() });
        toast('Reminder: ' + due[i].title);
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Reminder', { body: due[i].title });
      }
      if (due.length && /#(today|reminders)?$/.test(location.hash || '#')) render();
    } catch (e) { console.error(e); }
  }
  window.addEventListener('hashchange', render);
  render(); checkReminders(); setInterval(checkReminders, 20000);
})();
