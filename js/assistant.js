/* Helpers for the Planner. No AI, no network calls: everything runs in the browser.
   The generators only PROPOSE. Nothing is saved until the user presses Save. */
(function () {
  var P = { high: 0, medium: 1, low: 2 };
  var TEMPLATES = {
    Project: ['Write down what "done" looks like for {g}', 'List what you need and who to ask', 'Break {g} into 3 small parts', 'Finish the first part', 'Review progress and fix gaps', 'Finish and share {g}'],
    Event: ['Set the date and budget for {g}', 'Make the guest or attendee list', 'Book the venue and key suppliers', 'Send invitations or announcements', 'Confirm everything 2 days before', 'Run {g} and thank everyone'],
    Study: ['List the topics for {g}', 'Gather notes and materials', 'Study the hardest topic first', 'Practise with past questions', 'Review weak areas', 'Do a final revision for {g}'],
    Launch: ['Define who {g} is for', 'Prepare the product or service details', 'Set the price and how people will pay', 'Prepare photos and the announcement', 'Tell 10 people and ask for feedback', 'Launch {g} and track the first results']
  };
  window.Assistant = {
    goalTemplates: Object.keys(TEMPLATES),
    goalSteps: function (kind, goal) { return (TEMPLATES[kind] || TEMPLATES.Project).map(function (s) { return s.replace(/\{g\}/g, goal); }); },
    planBlocks: function (tasks, o) {
      var st = (o.start || '08:00').split(':'), t0 = new Date(); t0.setHours(+st[0], +st[1], 0, 0);
      if (t0 < new Date()) { t0 = new Date(); t0.setMinutes(Math.ceil(t0.getMinutes() / 15) * 15, 0, 0); }
      return tasks.slice().sort(function (a, b) { return (P[a.priority] - P[b.priority]) || String(a.due_at || 'z').localeCompare(String(b.due_at || 'z')); })
        .map(function (t) {
          var s = new Date(t0), e = new Date(t0.getTime() + o.block * 60000); t0 = new Date(e.getTime() + o.brk * 60000);
          return { task_id: t.id, title: t.title, start: s.toISOString(), end: e.toISOString() };
        });
    },
    extractActions: function (body) {
      return body.split(/\n+/).map(function (l) { return l.trim(); })
        .filter(function (l) { return /^([-*•]|\d+[.)]|\[ \]|todo|action)/i.test(l); })
        .map(function (l) { return l.replace(/^([-*•]|\d+[.)]|\[ \]|todo:?|action:?)\s*/i, '').trim(); }).filter(Boolean).slice(0, 10);
    }
  };
})();
