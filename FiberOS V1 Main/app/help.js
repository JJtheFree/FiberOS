/*
 * FiberOS — Per-page Help
 * -----------------------
 * A small, self-contained help modal. Each page calls FiberOSHelp.init({...}) with
 * its own title, intro, and a list of sections describing that page's controls.
 * Any element with id="helpBtn" or class "js-help" opens it; if none exists on the
 * page, a floating "Help" button is created. Themed with the app's CSS variables so
 * it stays readable in light and dark mode (no glare, FL-41 friendly).
 */
(function (root) {
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }

  function ensureStyles(){
    if (document.getElementById('fiberos-help-style')) return;
    var css = ''
      + '.fh-overlay{position:fixed;inset:0;background:rgba(20,12,22,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px}'
      + '.fh-overlay.show{display:flex}'
      + '.fh-panel{background:var(--surface,#1e1620);color:var(--ink,#f3eef5);border:1px solid var(--line,#3a2b3d);border-radius:18px;max-width:640px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.45)}'
      + '.fh-head{position:sticky;top:0;background:var(--surface,#1e1620);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 22px 12px;border-bottom:1px solid var(--line,#3a2b3d)}'
      + '.fh-head h2{margin:0;font-size:1.25rem}'
      + '.fh-head .fh-intro{color:var(--muted,#b9a9bd);font-size:.9rem;margin-top:4px}'
      + '.fh-close{flex:none;border:1px solid var(--line,#3a2b3d);background:var(--surface2,#2b2030);color:var(--ink,#f3eef5);border-radius:10px;width:34px;height:34px;font-size:1.1rem;cursor:pointer;line-height:1}'
      + '.fh-body{padding:8px 22px 22px}'
      + '.fh-sec{padding:14px 0;border-bottom:1px solid var(--line,#3a2b3d)}'
      + '.fh-sec:last-child{border-bottom:none}'
      + '.fh-sec h3{margin:0 0 4px;font-size:1rem}'
      + '.fh-sec p{margin:0;color:var(--muted,#cbbccd);font-size:.92rem;line-height:1.5}'
      + '.fh-fab{position:fixed;right:16px;bottom:16px;z-index:9998;border:1px solid var(--line,#3a2b3d);background:var(--aub,#7c3a71);color:#fff;border-radius:999px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.25)}';
    var st = document.createElement('style'); st.id = 'fiberos-help-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  var overlay = null, cfg = null;

  function build(){
    ensureStyles();
    overlay = document.createElement('div');
    overlay.className = 'fh-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="fh-panel">'
      + '<div class="fh-head"><div><h2>' + esc(cfg.title || 'Help') + '</h2>'
      + (cfg.intro ? '<div class="fh-intro">' + esc(cfg.intro) + '</div>' : '')
      + '</div><button class="fh-close" aria-label="Close help">×</button></div>'
      + '<div class="fh-body">'
      + (cfg.sections || []).map(function(s){
          return '<div class="fh-sec"><h3>' + esc(s.h) + '</h3><p>' + esc(s.p) + '</p></div>';
        }).join('')
      + '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
    overlay.querySelector('.fh-close').addEventListener('click', close);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
  }

  function open(){ if (!overlay) build(); overlay.classList.add('show'); }
  function close(){ if (overlay) overlay.classList.remove('show'); }

  var API = {
    init: function (config){
      cfg = config || {};
      var wired = false;
      // Wire any explicit help triggers on the page.
      document.querySelectorAll('#helpBtn, .js-help').forEach(function (btn){
        btn.addEventListener('click', function (e){ e.preventDefault(); open(); });
        wired = true;
      });
      // Otherwise, drop in a floating Help button.
      if (!wired){
        var fab = document.createElement('button');
        fab.className = 'fh-fab'; fab.type = 'button'; fab.textContent = 'Help';
        fab.addEventListener('click', open);
        (document.body || document.documentElement).appendChild(fab);
      }
      return API;
    },
    open: open,
    close: close
  };

  root.FiberOSHelp = API;
})(typeof window !== 'undefined' ? window : this);
