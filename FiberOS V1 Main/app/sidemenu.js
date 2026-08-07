/*
 * FiberOS — floating side menu
 * Uses the cozy 3-tile art (landing/sidemenu-panel.png) as a fixed left-edge menu:
 *   top tile    -> Tapestry Studio
 *   middle tile -> Palette Studio
 *   bottom tile -> My Studio
 * Each tile is a clickable hotspot with a hover label. Collapses to a small tab on
 * narrow screens so it never covers content.
 */
(function () {
  if (document.querySelector('.fx-sidemenu')) return;

  var items = [
    { href: 'studio.html',        label: 'Tapestry Studio', top: 2,  height: 33 },
    { href: 'palette-studio.html',label: 'Palette Studio',  top: 37, height: 30 },
    { href: 'my-studio.html',     label: 'My Studio',       top: 68, height: 30 }
  ];

  var css = ''
    + '.fx-sidemenu{position:fixed;left:14px;top:50%;transform:translateY(-50%);z-index:60}'
    + '.fx-sidemenu-inner{position:relative;width:104px;transition:width .18s ease}'
    + '.fx-sidemenu-img{width:100%;height:auto;display:block;filter:drop-shadow(0 14px 34px rgba(0,0,0,.45))}'
    + '.fx-sidemenu-hot{position:absolute;left:6%;width:88%;display:block;text-decoration:none;border-radius:16px;transition:transform .15s ease}'
    + '.fx-sidemenu-hot:hover{transform:scale(1.06)}'
    + '.fx-sidemenu-hot:focus-visible{outline:3px solid var(--aub,#86b394);outline-offset:3px}'
    + '.fx-sidemenu-label{position:absolute;left:112%;top:50%;transform:translateY(-50%);white-space:nowrap;'
    + 'background:var(--surface2,#243026);color:var(--ink,#eef3ea);border:1px solid var(--line,#33422f);'
    + 'border-radius:12px;padding:8px 14px;font-weight:800;font-size:.9rem;opacity:0;pointer-events:none;'
    + 'transition:opacity .15s ease;box-shadow:0 10px 24px rgba(0,0,0,.35)}'
    + '.fx-sidemenu-hot:hover .fx-sidemenu-label,.fx-sidemenu-hot:focus-visible .fx-sidemenu-label{opacity:1}'
    + '.fx-sidemenu-toggle{display:none}'
    + '.fx-sidemenu.is-compact .fx-sidemenu-toggle{display:flex;align-items:center;justify-content:center;position:absolute;left:0;top:50%;transform:translateY(-50%);'
    + '  width:62px;height:82px;border:1px solid var(--line,#33422f);background:var(--surface2,#243026);color:var(--ink,#eef3ea);'
    + '  border-radius:16px;cursor:pointer;font-size:2.1rem;line-height:1;box-shadow:0 8px 20px rgba(0,0,0,.4)}'
    + '.fx-sidemenu.is-compact.collapsed .fx-sidemenu-inner{width:0;overflow:hidden}'
    + '.fx-sidemenu.is-compact:not(.collapsed) .fx-sidemenu-toggle{left:112px}'
    + '@media(max-width:1180px){'
    + '  .fx-sidemenu{left:10px}'
    + '  .fx-sidemenu.collapsed .fx-sidemenu-inner{width:0;overflow:hidden}'
    + '  .fx-sidemenu-toggle{display:flex;align-items:center;justify-content:center;position:absolute;left:0;top:50%;transform:translateY(-50%);'
    + '    width:40px;height:56px;border:1px solid var(--line,#33422f);background:var(--surface2,#243026);color:var(--ink,#eef3ea);'
    + '    border-radius:12px;cursor:pointer;font-size:1.2rem;box-shadow:0 8px 20px rgba(0,0,0,.35)}'
    + '  .fx-sidemenu:not(.collapsed) .fx-sidemenu-toggle{left:112px}'
    + '}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var wrap = document.createElement('div');
  wrap.className = 'fx-sidemenu collapsed';
  wrap.innerHTML =
    '<button class="fx-sidemenu-toggle" aria-label="Menu">☰</button>' +
    '<div class="fx-sidemenu-inner">' +
      '<img src="landing/sidemenu-panel.png" alt="" class="fx-sidemenu-img" draggable="false">' +
      items.map(function (it) {
        return '<a class="fx-sidemenu-hot" href="' + it.href + '" style="top:' + it.top + '%;height:' + it.height + '%" aria-label="' + it.label + '">' +
               '<span class="fx-sidemenu-label">' + it.label + '</span></a>';
      }).join('') +
    '</div>';
  document.body.appendChild(wrap);

  var toggle = wrap.querySelector('.fx-sidemenu-toggle');
  // Pages with their own left/right work panels (the studios) opt into "compact":
  // the menu stays a small tab and only opens when asked, so it never covers tools.
  var compact = document.body.getAttribute('data-sidemenu') === 'compact';
  if (compact) wrap.classList.add('is-compact');
  // On wide screens it's open by default, unless the page is compact; the toggle
  // always works to open/close it.
  function syncWide(){
    if (compact) { wrap.classList.add('collapsed'); return; }
    if (window.innerWidth > 1180) wrap.classList.remove('collapsed'); else wrap.classList.add('collapsed');
  }
  syncWide();
  if (!compact) window.addEventListener('resize', syncWide);
  toggle.addEventListener('click', function () { wrap.classList.toggle('collapsed'); });
})();
