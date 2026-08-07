/*
 * FiberOS — Global yarn-brand filter (shared across the whole app)
 * ---------------------------------------------------------------
 * One source of truth for "which yarn brands can this user buy?".
 * Persisted in localStorage so Palette Studio, Tapestry Studio, and anything
 * else that matches yarn all read the same preference.
 *
 *   window.FiberOSBrands.get()            -> ["Cascade", "DROPS", ...]  (selected brands)
 *   window.FiberOSBrands.size()           -> number selected (0 = "all brands")
 *   window.FiberOSBrands.has(name)        -> is this brand explicitly selected?
 *   window.FiberOSBrands.add/remove/clear/set(...)   -> mutate + persist
 *   window.FiberOSBrands.allow(brandName) -> may we recommend this brand? (empty set = yes)
 *   window.FiberOSBrands.filter(yarns)    -> yarns from allowed brands (falls back to all
 *                                            if the filter would leave nothing to match)
 *   window.FiberOSBrands.brandsIn(yarns)  -> sorted allowed brand names present in `yarns`
 *
 * Empty selection means "no restriction" — every brand is fair game.
 */
(function (root) {
  var KEY = 'fiberos.paletteBrands';

  function read() {
    try { var v = JSON.parse(root.localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }

  var selected = new Set(read());

  function persist() {
    try { root.localStorage.setItem(KEY, JSON.stringify(Array.from(selected))); } catch (e) {}
  }

  var API = {
    KEY: KEY,
    get: function () { return Array.from(selected); },
    size: function () { return selected.size; },
    has: function (name) { return selected.has(name); },
    add: function (name) { selected.add(name); persist(); return API; },
    remove: function (name) { selected.delete(name); persist(); return API; },
    clear: function () { selected.clear(); persist(); return API; },
    set: function (arr) { selected = new Set(arr || []); persist(); return API; },
    allow: function (brandName) { return selected.size === 0 || selected.has(brandName); },
    filter: function (yarns) {
      if (!selected.size) return yarns;
      var f = yarns.filter(function (y) { return selected.has(y.brandName); });
      return f.length ? f : yarns; // never strand the user with nothing to match
    },
    brandsIn: function (yarns) {
      var seen = Object.create(null);
      yarns.forEach(function (y) { if (y.brandName && API.allow(y.brandName)) seen[y.brandName] = 1; });
      return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
    }
  };

  root.FiberOSBrands = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
