/*
 * FiberOS — Yarn weight vocabulary
 * --------------------------------
 * The master yarn database stores weight as opaque single/two-letter codes.
 * These mappings were derived by inspecting the yarn lines behind each code
 * (e.g. 'w' -> Encore Worsted / Cascade 220; 'd' -> Classic DK; 'f' -> Palette fingering).
 * One shared vocabulary so My Yarns and Palette Studio label weight the same way.
 */
(function (root) {
  var CODE_TO_NAME = {
    l:  'Lace',
    lf: 'Light fingering',
    f:  'Fingering',
    s:  'Sport',
    d:  'DK',
    w:  'Worsted',
    a:  'Aran',
    b:  'Bulky',
    sb: 'Super bulky',
    t:  'Thread'
  };
  // Canonical, user-facing weight names (for the manual "add your own" dropdown).
  var NAMES = ['Lace', 'Light fingering', 'Fingering', 'Sport', 'DK', 'Worsted', 'Aran', 'Bulky', 'Super bulky', 'Jumbo', 'Thread'];
  var NAME_SET = Object.create(null);
  NAMES.forEach(function (n) { NAME_SET[n] = 1; });

  // Sort order for grouping (fine -> heavy), unknowns last.
  var ORDER = ['Lace', 'Light fingering', 'Fingering', 'Sport', 'DK', 'Worsted', 'Aran', 'Bulky', 'Super bulky', 'Jumbo', 'Thread', 'Unspecified'];

  var API = {
    UNSPECIFIED: 'Unspecified',
    names: function () { return NAMES.slice(); },
    // Accepts a DB code ('w'), a canonical name ('Worsted'), or blank -> 'Unspecified'.
    name: function (v) {
      v = String(v == null ? '' : v).trim();
      if (!v) return 'Unspecified';
      if (CODE_TO_NAME[v]) return CODE_TO_NAME[v];
      if (CODE_TO_NAME[v.toLowerCase()]) return CODE_TO_NAME[v.toLowerCase()];
      if (NAME_SET[v]) return v;
      return 'Unspecified';
    },
    rank: function (name) { var i = ORDER.indexOf(name); return i < 0 ? ORDER.length : i; }
  };

  root.FiberOSWeights = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
