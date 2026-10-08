/* Guard: no session means go to login. Otherwise load the app scripts, then add a Sign out button. */
(async function () {
  var r = await sb.auth.getSession();
  if (!r.data.session) { location.replace('login.html'); return; }
  window.USER = r.data.session.user;
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') location.replace('login.html'); });
  var nav = document.querySelector('.side'), b = document.createElement('a');
  b.className = 'nav'; b.href = '#'; b.textContent = 'Sign out';
  b.addEventListener('click', async function (e) { e.preventDefault(); await sb.auth.signOut(); location.replace('login.html'); });
  nav.insertBefore(b, nav.querySelector('.btn'));
  ['js/assistant.js', 'js/app.js'].reduce(function (p, src) {
    return p.then(function () { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.body.appendChild(s); }); });
  }, Promise.resolve());
})();
