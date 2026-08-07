/*
 * FiberOS — Unified Project Schema (v1)
 * -------------------------------------
 * One versioned shape for a project, used everywhere: Library, Studio, Editor, Packet.
 * The goal is that a project created here survives the full round trip with nothing dropped.
 *
 * This module works in the browser (attaches window.FiberOSSchema) AND in Node (module.exports),
 * so the same code the app uses is the code the tests exercise.
 *
 * schemaVersion 1. Bump the version and add a migration step in project-migrate.js if this changes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FiberOSSchema = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;

  // Symbol set for chart colors (matches the suite's existing set). Kept local so this
  // module has no dependency on shared.js.
  var SYMBOLS = ['●', '▲', '■', '◆', '✚', '✦', '○', '△',
    '□', '◇', '✕', '✱', '⬟', '⬢', '▰', '▱', '☰',
    '≋', '⌁', '⊙'];

  var WHITE_HEXES = { '#FFFFFF': 1, '#FFF': 1 };

  function genId(prefix) {
    return (prefix || 'proj') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  }

  function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function num(v, fallback) {
    var n = typeof v === 'string' ? parseFloat(v) : v;
    return (typeof n === 'number' && !isNaN(n)) ? n : fallback;
  }

  function str(v, fallback) {
    return (typeof v === 'string' && v.length) ? v : (fallback || '');
  }

  function bool(v, fallback) {
    return typeof v === 'boolean' ? v : !!fallback;
  }

  function nowISO() { return new Date().toISOString(); }

  function toISO(v) {
    if (!v) return nowISO();
    var d = new Date(v);
    return isNaN(d.getTime()) ? nowISO() : d.toISOString();
  }

  function normHex(h) {
    if (typeof h !== 'string') return '#000000';
    var s = h.trim();
    if (s[0] !== '#') s = '#' + s;
    return s.toUpperCase();
  }

  function isWhite(hex) { return !!WHITE_HEXES[normHex(hex)]; }

  // Count how many cells use each color, most-used first. Used when a legacy project
  // has a grid but no palette to lean on.
  function colorCountsFromGrid(grid) {
    var counts = {};
    (grid || []).forEach(function (row) {
      (row || []).forEach(function (cell) {
        var hex = normHex(cell);
        counts[hex] = (counts[hex] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map(function (hex) { return { hex: hex, count: counts[hex] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function gridDims(grid) {
    var rows = Array.isArray(grid) ? grid.length : 0;
    var stitches = rows && Array.isArray(grid[0]) ? grid[0].length : 0;
    return { rows: rows, stitches: stitches };
  }

  // ---- Section defaults -------------------------------------------------------

  function defaultSource(over) {
    over = over || {};
    return {
      fileName: str(over.fileName, ''),
      imageUrl: str(over.imageUrl, ''),
      imageBlobId: str(over.imageBlobId, ''),
      crop: {
        zoom: num(over.crop && over.crop.zoom, 1),
        x: num(over.crop && over.crop.x, 0),
        y: num(over.crop && over.crop.y, 0)
      },
      adjustments: {
        brightness: num(over.adjustments && over.adjustments.brightness, 100),
        contrast: num(over.adjustments && over.adjustments.contrast, 100),
        simplify: num(over.adjustments && over.adjustments.simplify, 20),
        backgroundRemoval: bool(over.adjustments && over.adjustments.backgroundRemoval, false),
        backgroundTolerance: num(over.adjustments && over.adjustments.backgroundTolerance, 38)
      }
    };
  }

  var VALID_MODES = { 'logo': 1, 'clip-art': 1, 'photo': 1, 'pixel-art': 1 };
  var VALID_DETAIL = { 'chunky': 1, 'balanced': 1, 'detailed': 1 };
  var VALID_EDGE = { 'smooth': 1, 'balanced': 1, 'sharp': 1 };

  function defaultConversion(over) {
    over = over || {};
    return {
      mode: VALID_MODES[over.mode] ? over.mode : 'clip-art',
      stitches: num(over.stitches, 36),
      rows: num(over.rows, 28),
      requestedColorCount: num(over.requestedColorCount, 4),
      detailLevel: VALID_DETAIL[over.detailLevel] ? over.detailLevel : 'balanced',
      edgeStyle: VALID_EDGE[over.edgeStyle] ? over.edgeStyle : 'balanced',
      removeIsolated: bool(over.removeIsolated, true),
      mergeTinyRegions: bool(over.mergeTinyRegions, true),
      dither: bool(over.dither, false)
    };
  }

  var VALID_ROWDIR = { 'odd-rtl': 1, 'odd-ltr': 1 };
  var VALID_FOUNDATION = { 'foundation': 1, 'row1': 1 };

  function defaultChart(over) {
    over = over || {};
    var gl = over.gridLines || {};
    return {
      grid: Array.isArray(over.grid) ? over.grid : [],
      rowDirection: VALID_ROWDIR[over.rowDirection] ? over.rowDirection : 'odd-rtl',
      foundationChainMode: VALID_FOUNDATION[over.foundationChainMode] ? over.foundationChainMode : 'foundation',
      gridLines: {
        visible: bool(gl.visible, true),
        color: str(gl.color, 'auto'),
        opacity: num(gl.opacity, 1),
        majorEvery: num(gl.majorEvery, 10)
      }
    };
  }

  var VALID_THEME = { 'minimal': 1, 'modern': 1, 'dark': 1, 'printer': 1 };
  var VALID_ORIENT = { 'portrait': 1, 'landscape': 1 };
  var VALID_LAYOUT = { 'fit': 1, 'easy': 1, 'pocket': 1, 'custom': 1 };
  var VALID_DISPLAY = { 'color': 1, 'symbol': 1, 'both': 1 };
  var VALID_LEGEND = { 'top': 1, 'bottom': 1 };
  var VALID_INSTR = { 'symbol': 1, 'color': 1, 'yarn': 1, 'symbol-color': 1, 'symbol-yarn': 1, 'all': 1 };

  function defaultPacket(over) {
    over = over || {};
    return {
      finishedWidth: str(over.finishedWidth, ''),
      finishedHeight: str(over.finishedHeight, ''),
      gaugeStitches: num(over.gaugeStitches, null),
      gaugeRows: num(over.gaugeRows, null),
      gaugeSize: str(over.gaugeSize, ''),
      hookSize: str(over.hookSize, ''),
      notes: str(over.notes, ''),
      theme: VALID_THEME[over.theme] ? over.theme : 'modern',
      orientation: VALID_ORIENT[over.orientation] ? over.orientation : 'portrait',
      chartLayout: VALID_LAYOUT[over.chartLayout] ? over.chartLayout : 'fit',
      tileColumns: num(over.tileColumns, null),
      tileRows: num(over.tileRows, null),
      chartDisplay: VALID_DISPLAY[over.chartDisplay] ? over.chartDisplay : 'color',
      legendPlacement: VALID_LEGEND[over.legendPlacement] ? over.legendPlacement : 'bottom',
      instructionMode: VALID_INSTR[over.instructionMode] ? over.instructionMode : 'symbol-color',
      largeFont: bool(over.largeFont, false),
      alternateRowShading: bool(over.alternateRowShading, false),
      compressRuns: bool(over.compressRuns, true)
    };
  }

  // ---- Palette ----------------------------------------------------------------

  // Build a normalized palette entry. Accepts legacy-ish input and fills defaults.
  function makePaletteEntry(input, index) {
    input = input || {};
    var hex = normHex(input.chartHex || input.hex || '#000000');
    var displayName = str(input.displayName || input.name,
      isWhite(hex) ? 'Background' : 'Color ' + (index + 1));

    var entry = {
      id: str(input.id, 'c' + index),
      chartHex: hex,
      stitchCount: num(input.stitchCount != null ? input.stitchCount : input.count, 0),
      symbol: str(input.symbol, SYMBOLS[index % SYMBOLS.length]),
      displayName: displayName
    };

    // Attach yarn only if there is a real assignment (brand present and not the
    // placeholder "Unassigned").
    var brand = input.yarn && input.yarn.brandName != null
      ? input.yarn.brandName
      : input.brand;
    var hasYarn = input.yarn || (brand && brand !== 'Unassigned' && brand !== '');
    if (hasYarn) {
      var y = input.yarn || {};
      entry.yarn = {
        source: str(y.source, 'yarn-colorways-api'),
        colorwayName: str(y.colorwayName || input.name || displayName, displayName),
        brandName: str(y.brandName != null ? y.brandName : brand, ''),
        yarnName: str(y.yarnName != null ? y.yarnName : input.yarnName, ''),
        weightId: str(y.weightId != null ? y.weightId : (input.yarnWeightName || input.yarnWeightId), ''),
        approximateHex: normHex(y.approximateHex || input.hex || hex),
        href: str(y.href != null ? y.href : input.href, ''),
        unavailable: bool(y.unavailable != null ? y.unavailable : input.unavailable, false)
      };
    }
    return entry;
  }

  function normalizePalette(palette, grid) {
    if (Array.isArray(palette) && palette.length) {
      return palette.map(makePaletteEntry);
    }
    // No palette given: derive from the grid so a project is never colorless.
    return colorCountsFromGrid(grid).map(function (c, i) {
      return makePaletteEntry({ hex: c.hex, count: c.count }, i);
    });
  }

  // ---- Public constructors ----------------------------------------------------

  // Create a fresh, fully-formed v1 project.
  function createProject(over) {
    over = over || {};
    var dims = gridDims(over.chart && over.chart.grid);
    var conv = defaultConversion(Object.assign(
      { stitches: dims.stitches || undefined, rows: dims.rows || undefined },
      over.conversion || {}
    ));
    return {
      schemaVersion: SCHEMA_VERSION,
      id: str(over.id, genId()),
      ownerId: str(over.ownerId, ''),
      type: 'tapestry',
      name: str(over.name, 'Untitled project'),
      visibility: over.visibility === 'public' ? 'public' : 'private',
      createdAt: toISO(over.createdAt),
      updatedAt: toISO(over.updatedAt || over.createdAt),
      source: defaultSource(over.source),
      conversion: conv,
      chart: defaultChart(over.chart),
      palette: normalizePalette(over.palette, over.chart && over.chart.grid),
      packet: defaultPacket(over.packet)
    };
  }

  // Take any object and coerce it into a valid v1 project (fills gaps, fixes types).
  function normalizeProject(obj) {
    if (!isObject(obj)) return createProject();
    return createProject(obj);
  }

  // Lightweight validation. Returns { ok, errors[] }.
  function validate(obj) {
    var errors = [];
    if (!isObject(obj)) { return { ok: false, errors: ['Project is not an object'] }; }
    if (obj.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion must be ' + SCHEMA_VERSION);
    if (!obj.id) errors.push('missing id');
    if (obj.type !== 'tapestry') errors.push('type must be "tapestry"');
    if (!obj.chart || !Array.isArray(obj.chart.grid)) errors.push('chart.grid must be an array');
    if (!Array.isArray(obj.palette)) errors.push('palette must be an array');
    if (obj.chart && !VALID_FOUNDATION[obj.chart.foundationChainMode]) errors.push('invalid foundationChainMode');
    if (obj.chart && !VALID_ROWDIR[obj.chart.rowDirection]) errors.push('invalid rowDirection');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SYMBOLS: SYMBOLS,
    createProject: createProject,
    normalizeProject: normalizeProject,
    makePaletteEntry: makePaletteEntry,
    normalizePalette: normalizePalette,
    colorCountsFromGrid: colorCountsFromGrid,
    validate: validate,
    genId: genId,
    _helpers: { normHex: normHex, isWhite: isWhite, gridDims: gridDims, toISO: toISO }
  };
});
