/* Data layer, Stage 2: Supabase. Same DB.* shape as Stage 1, so the pages did not change. */
(function () {
  var sb = window.sb = supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_KEY);
  function clean(o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k] === '' ? null : o[k]; }); return r; }
  function ok(res) { if (res.error) { console.error(res.error); throw res.error; } return res.data; }
  function table(name) {
    return {
      list: async function () { return ok(await sb.from(name).select('*').order('created_at', { ascending: false })) || []; },
      add: async function (o) { return ok(await sb.from(name).insert(clean(o)).select().single()); },
      update: async function (id, p) {
        var body = clean(p); if (name !== 'profiles') body.updated_at = new Date().toISOString();
        ok(await sb.from(name).update(body).eq('id', id));
      },
      remove: async function (id) { ok(await sb.from(name).delete().eq('id', id)); }
    };
  }
  var tables = ['tasks', 'reminders', 'notes', 'goals', 'messages'];
  var defaults = function () { return { display_name: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, day_start: '08:00' }; };
  window.DB = {
    tasks: table('tasks'), reminders: table('reminders'), notes: table('notes'), goals: table('goals'), messages: table('messages'),
    profile: {
      get: async function () {
        var r = await sb.from('profiles').select('display_name,timezone,day_start').eq('id', window.USER.id).maybeSingle();
        if (r.error) { console.error(r.error); throw r.error; }
        return r.data || defaults();
      },
      set: async function (p) { ok(await sb.from('profiles').upsert(Object.assign({ id: window.USER.id }, p))); }
    },
    exportAll: async function () {
      var o = {}; for (var i = 0; i < tables.length; i++) o[tables[i]] = await this[tables[i]].list();
      o.profile = await this.profile.get(); return o;
    },
    wipe: async function () {
      for (var i = 0; i < tables.length; i++) ok(await sb.from(tables[i]).delete().eq('user_id', window.USER.id));
      ok(await sb.from('profiles').delete().eq('id', window.USER.id));
    }
  };
})();
