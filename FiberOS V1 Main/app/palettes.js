/*
 * FiberOS — Saved palettes
 * ------------------------
 * Palettes the user builds in Palette Studio, saved locally (fiberos.palettes).
 * A palette stores the EXACT yarns (brand + colorway), the background, and the
 * rules that were active when it was made (brand filter, match source, color count)
 * so reopening it recreates the same constraints.
 *
 * Entry shape:
 *   { id, name, status, createdAt,
 *     colors: [ { source, isBg, name, brandName, yarnName, hex, weightId, href } ],
 *     rules:  { brands: [...], sourceMode, colorCount } }
 *   status: 'concept' (default) | 'ready'
 */
(function (root) {
  var KEY = 'fiberos.palettes';
  var subs = [];

  function read(){
    try { var v = JSON.parse(root.localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  var items = read();

  function persist(){
    try { root.localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    subs.forEach(function (fn){ try { fn(items); } catch (e) {} });
  }
  function makeId(){ return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var API = {
    KEY: KEY,
    list: function(){ return items.slice().sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); }); },
    count: function(){ return items.length; },
    get: function(id){ return items.find(function(p){ return p.id === id; }) || null; },
    save: function(p){
      var entry = {
        id: makeId(),
        name: (p && p.name ? String(p.name) : 'Untitled palette').trim(),
        status: (p && p.status) || 'concept',
        createdAt: Date.now(),
        colors: (p && p.colors) || [],
        rules: (p && p.rules) || {}
      };
      items.push(entry); persist(); return entry;
    },
    rename: function(id, name){ var p = API.get(id); if(p){ p.name = String(name || '').trim() || p.name; persist(); } return p; },
    setStatus: function(id, status){ var p = API.get(id); if(p){ p.status = status; persist(); } return p; },
    remove: function(id){ items = items.filter(function(p){ return p.id !== id; }); persist(); return API; },
    clear: function(){ items = []; persist(); return API; },
    exportJSON: function(){ return JSON.stringify({ app:'FiberOS', kind:'palettes', version:1, exportedAt:new Date().toISOString(), palettes: items }, null, 2); },
    // Restore palettes from a backup. merge:true keeps existing ones; otherwise replaces.
    importList: function(list, opts){
      opts = opts || {};
      if(!Array.isArray(list)) return { added: 0 };
      if(!opts.merge) items = [];
      var seen = {}; items.forEach(function(p){ seen[p.id] = 1; });
      var added = 0;
      list.forEach(function(p){
        if(!p || !Array.isArray(p.colors)) return;
        var id = p.id || makeId();
        if(seen[id]) id = makeId();
        items.push({
          id: id,
          name: (p.name ? String(p.name) : 'Untitled palette').trim(),
          status: p.status || 'concept',
          createdAt: p.createdAt || Date.now(),
          colors: p.colors,
          rules: p.rules || {}
        });
        seen[id] = 1; added++;
      });
      persist(); return { added: added };
    },
    onChange: function(fn){ if(typeof fn === 'function') subs.push(fn); return API; }
  };

  root.FiberOSPalettes = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
