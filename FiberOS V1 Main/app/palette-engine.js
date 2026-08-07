/*
 * FiberOS — Palette Engine (Palette Studio)
 * -----------------------------------------
 * Pure, reusable palette logic:
 *   - extract a dominant palette from image pixels (k-means, most-covered first)
 *   - generate color-harmony schemes from a seed color
 *   - curated "mood" palettes
 *   - mark one color as the Background (the biggest yarn commitment)
 *   - hex / rgb / hsl helpers
 *
 * Works in the browser (window.FiberOSPalette) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FiberOSPalette = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- color conversions ----------------------------------------------------
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function hexToHsl(hex) { var c = hexToRgb(hex); return rgbToHsl(c[0], c[1], c[2]); }
  function hslToHex(h, s, l) { var c = hslToRgb(h, s, l); return rgbToHex(c[0], c[1], c[2]); }
  function luminance(hex) { var c = hexToRgb(hex); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function distance(a, b) { var x = hexToRgb(a), y = hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }

  // ---- palette from image pixels (k-means) ----------------------------------
  // pixels: flat [r,g,b,r,g,b,...] or [[r,g,b],...]. Returns [{hex, weight}] most-covered first.
  function extractFromPixels(pixels, k) {
    k = clamp(k || 5, 2, 8);
    var pts = normalizePixels(pixels);
    if (!pts.length) return [];
    // seed with farthest-point sampling for spread
    var seeds = [pts[Math.floor(pts.length / 2)].slice()];
    while (seeds.length < k) {
      var best = pts[0], bestD = -1;
      for (var i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 900))) {
        var p = pts[i];
        var near = Infinity;
        for (var s = 0; s < seeds.length; s++) { var d = sq(p, seeds[s]); if (d < near) near = d; }
        if (near > bestD) { bestD = near; best = p; }
      }
      seeds.push(best.slice());
    }
    var centers = seeds, counts = new Array(k).fill(0);
    for (var iter = 0; iter < 8; iter++) {
      var sums = centers.map(function () { return [0, 0, 0, 0]; });
      for (var j = 0; j < pts.length; j++) {
        var idx = nearest(pts[j], centers);
        sums[idx][0] += pts[j][0]; sums[idx][1] += pts[j][1]; sums[idx][2] += pts[j][2]; sums[idx][3]++;
      }
      centers = centers.map(function (c, ci) { return sums[ci][3] ? [sums[ci][0] / sums[ci][3], sums[ci][1] / sums[ci][3], sums[ci][2] / sums[ci][3]] : c; });
      counts = sums.map(function (x) { return x[3]; });
    }
    var total = counts.reduce(function (a, b) { return a + b; }, 0) || 1;
    return centers
      .map(function (c, i) { return { hex: rgbToHex(c[0], c[1], c[2]), weight: counts[i] / total }; })
      .filter(function (e) { return e.weight > 0; })
      .sort(function (a, b) { return b.weight - a.weight; });
  }
  function extractFromImageData(imgData, k) {
    var d = imgData.data, step = 4 * Math.max(1, Math.floor((imgData.width * imgData.height) / 6000));
    var pts = [];
    for (var i = 0; i < d.length; i += step) {
      if (d[i + 3] < 128) continue; // skip transparent
      pts.push([d[i], d[i + 1], d[i + 2]]);
    }
    return extractFromPixels(pts, k);
  }
  function normalizePixels(pixels) {
    if (!pixels || !pixels.length) return [];
    if (Array.isArray(pixels[0])) return pixels;
    var out = [];
    for (var i = 0; i + 2 < pixels.length; i += 3) out.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
    return out;
  }
  function sq(a, b) { var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr + dg * dg + db * db; }
  function nearest(p, centers) { var best = 0, bd = Infinity; for (var i = 0; i < centers.length; i++) { var d = sq(p, centers[i]); if (d < bd) { bd = d; best = i; } } return best; }

  // ---- harmony from a seed --------------------------------------------------
  var HARMONY = {
    complementary: [0, 180],
    analogous: [0, 30, -30, 60],
    triadic: [0, 120, 240],
    split: [0, 150, 210],
    tetradic: [0, 90, 180, 270]
  };
  // Returns `count` hexes built from the seed's hue rotations, with gentle
  // lightness variation to fill out the palette.
  function harmony(seedHex, type, count) {
    count = clamp(count || 5, 2, 8);
    var hsl = hexToHsl(seedHex);
    var offsets = HARMONY[type] || HARMONY.analogous;
    var out = [];
    for (var i = 0; i < count; i++) {
      var off = offsets[i % offsets.length];
      var wrap = Math.floor(i / offsets.length);
      var s = clamp(hsl[1] - wrap * 8, 25, 95);
      var l = clamp(hsl[2] + (wrap % 2 === 0 ? 0 : (wrap * -10)) + (i === 0 ? 0 : (off === 0 ? -12 : 0)), 18, 88);
      out.push(hslToHex(hsl[0] + off, s, l));
    }
    return dedupe(out);
  }

  // ---- curated moods --------------------------------------------------------
  var MOODS = {
    autumn:  ['#7C3A1D', '#C46A2B', '#E0A45B', '#8A8B4A', '#3E2A1E', '#F1E3C6'],
    nursery: ['#F6C9C9', '#F7E4B7', '#BFD8C6', '#A9C7E0', '#EFE9E1', '#8A7E74'],
    coastal: ['#1F4E5F', '#2E8B8B', '#7FC1BE', '#E4D8B4', '#EDE7D9', '#123040'],
    forest:  ['#20482F', '#2F6F48', '#6E9B5A', '#B7C79A', '#EAE6D3', '#3A2E22'],
    berry:   ['#5B2A4A', '#9B3B6A', '#C86B93', '#E4A9C0', '#F1E4EA', '#2E1B29'],
    sunset:  ['#3B2A55', '#7A3B7A', '#C4557B', '#E9895C', '#F4C56B', '#F7E9C9'],
    mono_blue: ['#0E2233', '#1E425F', '#3A6E92', '#7FA6C4', '#C4D8E6', '#EFF4F8'],
    earthy:  ['#4A3B2A', '#7A5B3A', '#A98B5C', '#C9B48C', '#8A9A6B', '#E9E2D0']
  };
  function moodNames() { return Object.keys(MOODS); }
  function mood(name, count) {
    var base = MOODS[name] || MOODS.autumn;
    var out = base.slice(0, clamp(count || 5, 2, base.length));
    return out.slice();
  }

  function dedupe(hexes) {
    var out = [];
    hexes.forEach(function (h) { var up = String(h).toUpperCase(); if (!out.some(function (o) { return distance(o, up) < 10; })) out.push(up); });
    return out;
  }

  // ---- background call-out ---------------------------------------------------
  // Given a palette (array of hex, or {hex,weight}), returns
  // { colors:[hex...], backgroundIndex }. For image palettes the background is the
  // most-covered color; otherwise the lightest (the common tapestry background).
  function withBackground(palette, opts) {
    opts = opts || {};
    var entries = palette.map(function (p) { return typeof p === 'string' ? { hex: p.toUpperCase(), weight: null } : { hex: String(p.hex).toUpperCase(), weight: p.weight }; });
    var bgIndex;
    if (opts.byWeight && entries.some(function (e) { return e.weight != null; })) {
      bgIndex = entries.reduce(function (best, e, i, arr) { return e.weight > arr[best].weight ? i : best; }, 0);
    } else {
      bgIndex = entries.reduce(function (best, e, i, arr) { return luminance(e.hex) > luminance(arr[best].hex) ? i : best; }, 0);
    }
    return { colors: entries.map(function (e) { return e.hex; }), backgroundIndex: bgIndex, weights: entries.map(function (e) { return e.weight; }) };
  }

  return {
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, hexToHsl: hexToHsl, hslToHex: hslToHex,
    luminance: luminance, distance: distance,
    extractFromPixels: extractFromPixels, extractFromImageData: extractFromImageData,
    harmony: harmony, harmonyTypes: Object.keys(HARMONY),
    moods: MOODS, moodNames: moodNames, mood: mood,
    withBackground: withBackground, dedupe: dedupe
  };
});
