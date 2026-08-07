/*
 * FiberOS — Personal yarn stash ("My Yarns")
 * ------------------------------------------
 * The yarn the user actually owns or wants to buy. Kept DELIBERATELY SEPARATE
 * from the 14k-colorway master database (fiberos.myYarns in localStorage) so the
 * master list never gets bloated or polluted with typos.
 *
 * Each entry: { id, name, brandName, yarnName, hex, weightId, source, addedAt }
 *   - source: 'db'   (copied from a master colorway, trusted hex/brand/line)
 *             'manual'(typed by the user: name + color minimum)
 *
 *   window.FiberOSMyYarns.list()            -> array (newest first)
 *   window.FiberOSMyYarns.count()           -> number
 *   window.FiberOSMyYarns.add(yarn)         -> added entry (dedupes on brand+name+hex)
 *   window.FiberOSMyYarns.remove(id)        -> removes, persists
 *   window.FiberOSMyYarns.clear()
 *   window.FiberOSMyYarns.has(yarn)         -> already in stash?
 *   window.FiberOSMyYarns.brandsIn()        -> sorted unique brand names owned
 *   window.FiberOSMyYarns.exportJSON()      -> string for download/backup
 *   window.FiberOSMyYarns.importJSON(str,{merge}) -> {added, skipped}
 *   window.FiberOSMyYarns.onChange(fn)      -> subscribe (fires after any mutation)
 */
(function (root) {
  var KEY = 'fiberos.myYarns';
  var subs = [];

  function read() {
    try { var v = JSON.parse(root.localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  var items = read();

  function persist() {
    try { root.localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    subs.forEach(function (fn) { try { fn(items); } catch (e) {} });
  }

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function keyOf(y) { return norm(y.brandName) + '|' + norm(y.name) + '|' + norm(y.hex); }

  function makeId() { return 'y' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var API = {
    KEY: KEY,
    list: function () { return items.slice().sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); }); },
    count: function () { return items.length; },
    has: function (y) { var k = keyOf(y); return items.some(function (it) { return keyOf(it) === k; }); },
    add: function (y) {
      if (!y || !y.hex || !y.name) return null;
      if (API.has(y)) return null;
      var entry = {
        id: makeId(),
        name: String(y.name).trim(),
        brandName: String(y.brandName || 'My yarn').trim(),
        yarnName: String(y.yarnName || '').trim(),
        hex: String(y.hex).trim().toUpperCase(),
        weightId: y.weightId || y.yarnWeightId || '',
        source: y.source || (y.brandName ? 'db' : 'manual'),
        addedAt: Date.now()
      };
      items.push(entry); persist(); return entry;
    },
    remove: function (id) { items = items.filter(function (it) { return it.id !== id; }); persist(); return API; },
    clear: function () { items = []; persist(); return API; },
    brandsIn: function () {
      var seen = Object.create(null);
      items.forEach(function (it) { if (it.brandName) seen[it.brandName] = 1; });
      return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
    },
    exportJSON: function () {
      return JSON.stringify({ app: 'FiberOS', kind: 'my-yarns', version: 1, exportedAt: new Date().toISOString(), yarns: items }, null, 2);
    },
    importJSON: function (str, opts) {
      opts = opts || {};
      var parsed;
      try { parsed = JSON.parse(str); } catch (e) { throw new Error('That file is not valid JSON.'); }
      var incoming = Array.isArray(parsed) ? parsed : (parsed && parsed.yarns);
      if (!Array.isArray(incoming)) throw new Error('No yarns found in that file.');
      if (!opts.merge) items = [];
      var added = 0, skipped = 0;
      incoming.forEach(function (y) {
        if (!y || !y.hex || !y.name) { skipped++; return; }
        if (API.has(y)) { skipped++; return; }
        items.push({
          id: makeId(),
          name: String(y.name).trim(),
          brandName: String(y.brandName || 'My yarn').trim(),
          yarnName: String(y.yarnName || '').trim(),
          hex: String(y.hex).trim().toUpperCase(),
          weightId: y.weightId || y.yarnWeightId || '',
          source: y.source || 'manual',
          addedAt: y.addedAt || Date.now()
        });
        added++;
      });
      persist(); return { added: added, skipped: skipped };
    },
    onChange: function (fn) { if (typeof fn === 'function') subs.push(fn); return API; }
  };

  root.FiberOSMyYarns = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
