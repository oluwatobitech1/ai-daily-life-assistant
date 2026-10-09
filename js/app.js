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
      '<div class="row" style="margin:.8rem 0"><a class="btn" href="#planner">Plan my day</a><a class="btn ghost" href="#reports">See my progress</a></div>' +
      '<div class="stats"><div class="stat"><b>' + open.length + '</b><span>Open tasks</span></div><div class="stat"><b>' + done.length + '</b><span>Done today</span></div><div class="stat"><b>' + (up[0] ? hm(up[0].due_at) : 'None') + '</b><span>Next reminder</span></div></div>' +
      '<section class="panel"><h2>Today\'s focus</h2>' + (focus.length ? '<ul class="list">' + focus.map(taskLi).join('') + '</ul>' : '<p class="empty">Nothing due today. Add a task or open the Planner to plan your day.</p>') + '</section>' +
      '<section class="panel"><h2>Upcoming reminders</h2>' + (up.length ? '<ul class="list">' + up.slice(0, 4).map(remLi).join('') + '</ul>' : '<p class="empty">No reminders set.</p>') + '</section>';
  }

  function whenFor(k) {
    var d = new Date();
    if (k === 'h1') d.setHours(d.getHours() + 1);
    else if (k === 't8') { d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); }
    else { d.setDate(d.getDate() + 1); d.setHours(k === 'm9' ? 9 : 14, 0, 0, 0); }
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  var preview = null;
  async function vPlanner() {
    var p = await DB.profile.get(), tasks = (await DB.tasks.list()).filter(function (t) { return t.status !== 'done'; }).sort(byDue);
    var planForm = tasks.length ? '<form data-form="plan"><div class="row"><div><label for="ps1">Start at</label><input id="ps1" type="time" value="' + esc(p.day_start) + '"></div><div><label for="pb">Block (min)</label><select id="pb"><option>30</option><option>45</option><option selected>60</option><option>90</option></select></div><div><label for="pk">Break (min)</label><select id="pk"><option>0</option><option>5</option><option selected>10</option><option>15</option></select></div></div><p class="muted" style="margin:.8rem 0 .2rem">Tasks to include</p>' +
      tasks.slice(0, 12).map(function (t, i) { return '<label class="chk"><input type="checkbox" name="pt" value="' + t.id + '"' + (i < 6 ? ' checked' : '') + '> ' + esc(t.title) + '</label>'; }).join('') + '<p></p><button class="btn">Generate plan</button></form>' : '<p class="empty">Add some tasks first, then come back to plan your day.</p>';
    return '<h1>Planner</h1><p class="muted">Choose options, generate, review, then save. Nothing is saved until you press Save.</p>' +
      '<section class="panel"><h2>Plan my day</h2>' + planForm + '<div id="prev-plan"></div></section>' +
      '<section class="panel"><h2>Quick reminder</h2><div class="chips"><button class="chip" data-act="rq" data-k="h1">In 1 hour</button><button class="chip" data-act="rq" data-k="t8">Tonight 8 PM</button><button class="chip" data-act="rq" data-k="m9">Tomorrow 9 AM</button><button class="chip" data-act="rq" data-k="m2">Tomorrow 2 PM</button></div>' +
      '<form class="row" data-form="remq"><div class="grow"><label for="rqt">Remind me to</label><input id="rqt" required maxlength="200" style="width:100%"></div><div><label for="rqw">When</label><input id="rqw" type="datetime-local" required></div><button class="btn">Save reminder</button></form></section>' +
      '<section class="panel"><h2>Break a goal into steps</h2><form class="row" data-form="goalgen"><div class="grow"><label for="gg">Goal</label><input id="gg" required maxlength="120" placeholder="e.g. open my online shop" style="width:100%"></div><div><label for="gk">Type</label><select id="gk">' + Assistant.goalTemplates.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></div><button class="btn">Generate steps</button></form><div id="prev-goal"></div></section>';
  }
  function dayKey(d) { return new Date(d).toDateString(); }
  async function vReports() {
    var tasks = await DB.tasks.list(), goals = await DB.goals.list(), rem = await DB.reminders.list();
    var open = tasks.filter(function (t) { return t.status !== 'done'; }), done = tasks.filter(function (t) { return t.status === 'done'; });
    var days = [], i;
    for (i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    var counts = days.map(function (d) { return done.filter(function (t) { return t.completed_at && dayKey(t.completed_at) === d.toDateString(); }).length; });
    var max = Math.max(1, Math.max.apply(null, counts)), weekTotal = counts.reduce(function (a, b) { return a + b; }, 0);
    var rate = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
    var bars = counts.map(function (c, n) {
      var h = Math.round(c / max * 90), x = 12 + n * 44;
      return '<rect x="' + x + '" y="' + (110 - h) + '" width="30" height="' + h + '" rx="4" style="fill:var(--accent)"></rect><text x="' + (x + 15) + '" y="' + (104 - h) + '" text-anchor="middle" font-size="11" style="fill:var(--ink)">' + (c || '') + '</text><text x="' + (x + 15) + '" y="128" text-anchor="middle" font-size="11" style="fill:var(--muted)">' + days[n].toLocaleDateString([], { weekday: 'short' }) + '</text>';
    }).join('');
    var pr = ['high', 'medium', 'low'], colors = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--accent)' };
    var prio = pr.map(function (k) {
      var c = open.filter(function (t) { return t.priority === k; }).length, w = open.length ? Math.round(c / open.length * 100) : 0;
      return '<div class="barrow"><span>' + k + '</span><div class="bar"><i style="width:' + w + '%;background:' + colors[k] + '"></i></div><b>' + c + '</b></div>';
    }).join('');
    var goalBars = goals.length ? goals.map(function (g) { return '<div class="barrow" style="grid-template-columns:1fr 2fr 44px"><span>' + esc(g.title) + '</span><div class="bar"><i style="width:' + g.progress + '%"></i></div><b>' + g.progress + '%</b></div>'; }).join('') : '<p class="empty">No goals yet. Add one on the Goals page.</p>';
    return '<h1>Overview</h1><p class="muted">Your progress at a glance.</p>' +
      '<div class="stats"><div class="stat"><b>' + open.length + '</b><span>Open tasks</span></div><div class="stat"><b>' + weekTotal + '</b><span>Done in last 7 days</span></div><div class="stat"><b>' + rate + '%</b><span>Completion rate</span></div><div class="stat"><b>' + rem.filter(function (r) { return r.status === 'pending'; }).length + '</b><span>Reminders waiting</span></div></div>' +
      '<section class="panel"><h2>Tasks completed, last 7 days</h2><svg viewBox="0 0 320 136" role="img" aria-label="Tasks completed per day over the last 7 days: ' + counts.join(', ') + '" style="width:100%;max-width:520px">' + bars + '</svg></section>' +
      '<section class="panel"><h2>Open tasks by priority</h2>' + (open.length ? prio : '<p class="empty">No open tasks.</p>') + '</section>' +
      '<section class="panel"><h2>Goal progress</h2>' + goalBars + '</section>';
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
      '<section class="panel"><h2>Your data</h2><p class="muted">Your data is stored in your account and only you can read it.</p><div class="row"><button class="btn ghost" data-act="export">Export data (JSON)</button><button class="btn danger" data-act="wipe">Delete all my data</button></div></section>';
  }

  var ROUTES = { today: ['Today', vToday], planner: ['Planner', vPlanner], reports: ['Overview', vReports], tasks: ['Tasks', vTasks], reminders: ['Reminders', vReminders], notes: ['Notes', vNotes], goals: ['Goals', vGoals], settings: ['Settings', vSettings] };
  async function render() {
    var r = (location.hash || '#today').slice(1); if (!ROUTES[r]) r = 'today';
    document.querySelectorAll('.side a.nav').forEach(function (a) { if (a.getAttribute('href') === '#' + r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = ROUTES[r][0] + ' · Daily Life Assistant';
    try {
      var html = await ROUTES[r][1](); $('#view').innerHTML = html;
    } catch (e) { console.error(e); $('#view').innerHTML = '<p>Something went wrong loading this page.</p><button class="btn" data-act="retry">Try again</button>'; }
  }

  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    var k = f.dataset.form, v = function (id) { return $('#' + id, f) ? $('#' + id, f).value.trim() : ''; };
    try {
      if (k === 'plan') {
        var ids = Array.prototype.map.call(f.querySelectorAll('input[name=pt]:checked'), function (c) { return c.value; });
        if (!ids.length) { toast('Tick at least one task'); return; }
        var chosen = (await DB.tasks.list()).filter(function (t) { return ids.indexOf(t.id) > -1; });
        var items = Assistant.planBlocks(chosen, { start: v('ps1'), block: +v('pb'), brk: +v('pk') });
        preview = { type: 'plan', items: items };
        $('#prev-plan').innerHTML = '<h3 style="margin-top:1rem">Draft plan</h3><ul class="list">' + items.map(function (i) { return '<li><div class="t"><b>' + hm(i.start) + ' to ' + hm(i.end) + '</b><br><small>' + esc(i.title) + '</small></div></li>'; }).join('') + '</ul><button class="btn" data-act="saveplan">Save plan</button>';
        return;
      }
      if (k === 'remq') { await DB.reminders.add({ title: v('rqt'), due_at: iso(v('rqw')), status: 'pending' }); toast('Reminder saved'); location.hash = '#reminders'; return; }
      if (k === 'goalgen') {
        var steps = Assistant.goalSteps(v('gk'), v('gg'));
        $('#prev-goal').innerHTML = '<h3 style="margin-top:1rem">Suggested steps</h3>' + steps.map(function (s) { return '<label class="chk"><input type="checkbox" name="gs" value="' + esc(s) + '" checked> ' + esc(s) + '</label>'; }).join('') + '<p></p><button class="btn" data-act="savegoal">Add ticked steps as tasks</button>';
        return;
      }
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
      if (a === 'retry') return render();
      if (a === 'quick') return $('#quick').showModal();
      if (a === 'del') { if (!confirm('Delete this item? This cannot be undone.')) return; await DB[b.dataset.t].remove(id); return render(); }
      if (a === 'rq') { $('#rqw').value = whenFor(b.dataset.k); return $('#rqt').focus(); }
      if (a === 'saveplan') {
        if (!preview || preview.type !== 'plan') return;
        for (var pi = 0; pi < preview.items.length; pi++) await DB.tasks.update(preview.items[pi].task_id, { scheduled_start: preview.items[pi].start, scheduled_end: preview.items[pi].end });
        preview = null; toast('Plan saved'); location.hash = '#tasks'; return;
      }
      if (a === 'savegoal') {
        var boxes = document.querySelectorAll('#prev-goal input[name=gs]:checked');
        if (!boxes.length) return toast('Tick at least one step');
        for (var gi = 0; gi < boxes.length; gi++) await DB.tasks.add({ title: boxes[gi].value, priority: 'medium', status: 'open', due_at: null });
        toast('Tasks added'); location.hash = '#tasks'; return;
      }
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
