/*
 * FiberOS — Accounts + cloud sync (Supabase)
 * ------------------------------------------
 * Optional sign-in. Signed OUT, everything works exactly as before (local only).
 * Signed IN, your whole library (designs, palettes, yarns, Live Studio progress + notes)
 * syncs to your private row in Supabase and follows you to any device.
 *
 * Whole-library, last-write-wins sync (per the product decision). On sign-in we MERGE the
 * cloud library with whatever is on this device (union by id, keeping the newer of any
 * duplicate) so nothing is ever lost, then keep the merged library pushed up as you work.
 *
 * The publishable key below is meant to be public; all real security is the row-level
 * security policy in the database (a person can only read/write their own row).
 */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://bwthyiponwwznvhnygxo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_M6GbiyU1zjJQVpW_HSKe2Q_naa3smw0';
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  var sb = null, user = null, synced = false, lastHash = null, statusEl = null;

  // ---- local library helpers ----
  var K_DESIGNS = 'fiberos_v1_projects', K_PAL = 'fiberos.palettes', K_YARN = 'fiberos.myYarns';
  function lget(k, f) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? f : v; } catch (e) { return f; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function collectLive() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); if (key && key.indexOf('fiberos.live.') === 0) o[key] = localStorage.getItem(key); } return o; }
  function applyLive(obj) { if (!obj) return; Object.keys(obj).forEach(function (k) { try { localStorage.setItem(k, obj[k]); } catch (e) {} }); }
  function localLibrary() { return { designs: lget(K_DESIGNS, []), palettes: lget(K_PAL, []), yarns: lget(K_YARN, []), live: collectLive() }; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function libHash(lib) { return hashStr(JSON.stringify([lib.designs, lib.palettes, lib.yarns, lib.live])); }

  // ---- merge (union by id; keep the newer of duplicates) ----
  function mergeById(localArr, cloudArr) {
    localArr = Array.isArray(localArr) ? localArr : []; cloudArr = Array.isArray(cloudArr) ? cloudArr : [];
    var map = {}, order = [];
    function stamp(it) { return Date.parse(it && (it.updatedAt || it.createdAt)) || 0; }
    function add(arr) {
      arr.forEach(function (it) {
        if (!it) return;
        var id = String(it.id != null ? it.id : JSON.stringify(it));
        if (!(id in map)) { map[id] = it; order.push(id); }
        else if (stamp(it) >= stamp(map[id])) { map[id] = it; }
      });
    }
    add(cloudArr); add(localArr);
    return order.map(function (id) { return map[id]; });
  }
  function rowOf(val) { if (val == null) return 1; try { var v = JSON.parse(val); if (v && typeof v === 'object' && v.row) return v.row | 0; if (typeof v === 'number') return v | 0; } catch (e) {} var n = parseInt(val, 10); return isNaN(n) ? 1 : n; }
  function mergeLive(localLive, cloudLive) {
    localLive = localLive || {}; cloudLive = cloudLive || {};
    var out = {}, keys = {};
    Object.keys(cloudLive).forEach(function (k) { keys[k] = 1; });
    Object.keys(localLive).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var l = localLive[k], c = cloudLive[k];
      if (l == null) { out[k] = c; return; }
      if (c == null) { out[k] = l; return; }
      if (/\.notes$/.test(k)) { out[k] = (String(l).length >= String(c).length) ? l : c; }   // keep the fuller note
      else { out[k] = rowOf(l) >= rowOf(c) ? l : c; }                                          // keep the further-along progress
    });
    return out;
  }

  // ---- sync ----
  function pullMergeAndReload() {
    status('Syncing your library…');
    sb.from('user_data').select('designs,palettes,yarns,live').eq('user_id', user.id).maybeSingle()
      .then(function (res) {
        var cloud = res && res.data, local = localLibrary(), merged;
        if (!cloud) merged = local;
        else merged = {
          designs: mergeById(local.designs, cloud.designs),
          palettes: mergeById(local.palettes, cloud.palettes),
          yarns: mergeById(local.yarns, cloud.yarns),
          live: mergeLive(local.live, cloud.live)
        };
        lset(K_DESIGNS, merged.designs); lset(K_PAL, merged.palettes); lset(K_YARN, merged.yarns); applyLive(merged.live);
        lastHash = libHash(merged);
        return sb.from('user_data').upsert({ user_id: user.id, designs: merged.designs, palettes: merged.palettes, yarns: merged.yarns, live: merged.live, updated_at: new Date().toISOString() });
      })
      .then(function () { status(''); location.reload(); })
      .catch(function () { status('Could not sync right now. Your work is safe on this device.'); });
  }
  function maybePush(force) {
    if (!user || !sb) return;
    var lib = localLibrary(), h = libHash(lib);
    if (!force && h === lastHash) return;
    lastHash = h;
    sb.from('user_data').upsert({ user_id: user.id, designs: lib.designs, palettes: lib.palettes, yarns: lib.yarns, live: lib.live, updated_at: new Date().toISOString() }).then(function () {}, function () {});
  }

  // ---- UI ----
  function el(tag, attrs, css) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (css) e.style.cssText = css; return e; }
  var btn, modal;
  function injectUI() {
    var host = document.querySelector('.top-actions') || document.querySelector('.topin');
    if (!host) return;
    btn = el('button', { id: 'fosAuthBtn', type: 'button' }, 'border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);color:#fff;border-radius:12px;padding:9px 14px;font-weight:800;cursor:pointer;font:inherit;font-size:.95rem');
    // On light shared-header pages the header is light; use themed colors there.
    if (document.querySelector('.topin') && !document.querySelector('.top-actions')) {
      btn.style.cssText = 'border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:9px 14px;font-weight:800;cursor:pointer;font:inherit;font-size:.95rem';
    }
    btn.textContent = 'Sign in';
    btn.onclick = openModal;
    host.appendChild(btn);
    buildModal();
  }
  function buildModal() {
    modal = el('div', { id: 'fosAuthModal' }, 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:99999;padding:20px');
    var panel = el('div', null, 'background:#fbf9f3;color:#20301f;border-radius:18px;max-width:420px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.45);overflow:hidden;font-family:inherit');
    if (document.documentElement.getAttribute('data-theme') === 'dark') panel.style.cssText += ';background:#241d17;color:#f2ebe0';
    panel.innerHTML =
      '<div style="padding:18px 20px;border-bottom:1px solid rgba(0,0,0,.12);display:flex;justify-content:space-between;align-items:center">' +
        '<strong style="font-size:1.15rem" id="fosTitle">Sign in to FiberOS</strong>' +
        '<button id="fosClose" style="border:none;background:transparent;font-size:1.4rem;cursor:pointer;color:inherit;line-height:1">×</button></div>' +
      '<div style="padding:18px 20px" id="fosBody"></div>';
    modal.appendChild(panel);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.body.appendChild(modal);
    panel.querySelector('#fosClose').onclick = closeModal;
  }
  function renderModalBody() {
    var body = modal.querySelector('#fosBody'), title = modal.querySelector('#fosTitle');
    if (user) {
      title.textContent = 'Your account';
      body.innerHTML =
        '<p style="margin:0 0 14px">Signed in as <strong>' + esc(user.email || 'your account') + '</strong>. Your library syncs automatically across your devices.</p>' +
        '<button id="fosSignOut" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.15);background:#eee;color:#222;font-weight:800;cursor:pointer">Sign out</button>' +
        '<div id="fosStatus" style="margin-top:10px;min-height:18px;color:#666;font-size:.9rem"></div>';
      body.querySelector('#fosSignOut').onclick = function () { sb.auth.signOut(); closeModal(); };
    } else {
      title.textContent = 'Sign in to FiberOS';
      body.innerHTML =
        '<p style="margin:0 0 14px;color:#555">Free, and optional. Sign in to sync your designs, palettes, and yarn across devices. No password needed.</p>' +
        '<label style="font-weight:700;font-size:.9rem">Email</label>' +
        '<input id="fosEmail" type="email" placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid rgba(0,0,0,.2);border-radius:10px;margin:6px 0 12px;font:inherit">' +
        '<button id="fosMagic" style="width:100%;padding:12px;border-radius:12px;border:none;background:#2f8a5b;color:#fff;font-weight:800;cursor:pointer">Email me a sign-in link</button>' +
        '<div style="text-align:center;color:#999;margin:12px 0;font-size:.85rem">or</div>' +
        '<button id="fosGoogle" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.2);background:#fff;color:#222;font-weight:800;cursor:pointer">Continue with Google</button>' +
        '<div id="fosStatus" style="margin-top:12px;min-height:18px;color:#666;font-size:.9rem"></div>';
      statusEl = body.querySelector('#fosStatus');
      body.querySelector('#fosMagic').onclick = function () {
        var email = (body.querySelector('#fosEmail').value || '').trim();
        if (!email) { status('Enter your email first.'); return; }
        status('Sending your link…');
        sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } })
          .then(function (r) { status(r.error ? (r.error.message || 'Could not send the link.') : 'Check your email for the sign-in link.'); });
      };
      body.querySelector('#fosGoogle').onclick = function () {
        status('Opening Google…');
        sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
          .then(function (r) { if (r && r.error) status(r.error.message || 'Google sign-in is not enabled yet.'); });
      };
    }
    statusEl = body.querySelector('#fosStatus');
  }
  function openModal() { renderModalBody(); modal.style.display = 'flex'; }
  function closeModal() { if (modal) modal.style.display = 'none'; }
  function status(msg) { if (statusEl) statusEl.textContent = msg || ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function renderUI() {
    if (!btn) return;
    btn.textContent = user ? (shortEmail(user.email)) : 'Sign in';
    if (modal && modal.style.display === 'flex') renderModalBody();
  }
  function shortEmail(e) { e = e || 'Account'; return e.length > 20 ? e.slice(0, 18) + '…' : e; }

  // ---- boot ----
  function setUser(u, justSignedIn) {
    user = u; renderUI();
    if (u && justSignedIn && !synced) { synced = true; pullMergeAndReload(); }
    if (!u) { synced = false; lastHash = null; }
  }
  function boot() {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    } catch (e) { return; }
    injectUI();
    sb.auth.getSession().then(function (res) { var s = res && res.data && res.data.session; setUser(s ? s.user : null, false); });
    sb.auth.onAuthStateChange(function (event, session) { setUser(session ? session.user : null, event === 'SIGNED_IN'); });
    setInterval(function () { maybePush(false); }, 4000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) maybePush(true); });
    window.addEventListener('pagehide', function () { maybePush(true); });
    window.FiberOSAuth = { user: function () { return user; }, signOut: function () { sb.auth.signOut(); }, open: openModal };
  }
  function loadSDK() {
    if (window.supabase && window.supabase.createClient) { boot(); return; }
    var s = document.createElement('script'); s.src = CDN;
    s.onload = boot; s.onerror = function () { /* offline / blocked: app still works locally */ };
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSDK); else loadSDK();
})();
