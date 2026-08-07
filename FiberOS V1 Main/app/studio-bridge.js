/*
 * FiberOS — Studio Bridge (Phase 3: connect the flow)
 * ---------------------------------------------------
 * Wires the standalone Tapestry Studio into the unified v1 project system without
 * rewriting studio's internals. It:
 *   1. LOADS a project into the editor when you arrive via "Open in Studio".
 *   2. Keeps the v1 "active project" continuously in sync while you edit (current work).
 *   3. Replaces the Save button so saving writes the FULL v1 project (grid, palette +
 *      yarn, chart settings) into your library — nothing drops on the round trip.
 *
 * Studio's main <script> is a classic (non-module) script, so its top-level
 * `state` and functions (setScreen, redrawGrid, renderPalette, showToast,
 * renderSavedProjects, closeModal) are reachable here by name. This file must load
 * AFTER studio's main script and after schema/migrate/repository.
 */
(function () {
  'use strict';
  var Schema = window.FiberOSSchema;
  var Migrate = window.FiberOSMigrate;
  var Repo = window.FiberOSRepo;
  if (!Schema || !Migrate || !Repo) { console.warn('[FiberOS] bridge: core scripts missing'); return; }

  // Studio's code lives inside an IIFE; it publishes what we need on window.__studio.
  var S = window.__studio;
  if (!S || !S.state) { console.warn('[FiberOS] bridge: studio internals not published'); return; }
  var state = S.state;
  var setScreen = S.setScreen, redrawGrid = S.redrawGrid, renderPalette = S.renderPalette,
      showToast = S.showToast, renderSavedProjects = S.renderSavedProjects, closeModal = S.closeModal;

  var PROJECTS_KEY = Migrate.V1_KEYS.projects;

  function $(id) { return document.getElementById(id); }
  function setVal(id, val) { var el = $(id); if (el != null && val != null) el.value = val; }
  function readRaw() { try { var v = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeRaw(list) { try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); } catch (e) {} }

  // -------------------------------------------------------------------------
  // Build a full v1 project from the live studio state + save-dialog inputs.
  // -------------------------------------------------------------------------
  function buildV1(meta) {
    meta = meta || {};
    var grid = state.gridData || [];

    // Count colors, most-used first, and attach any assigned yarn from state.yarnMatches.
    var counts = {};
    grid.forEach(function (r) { (r || []).forEach(function (c) { var h = (c || '').toUpperCase(); counts[h] = (counts[h] || 0) + 1; }); });
    var order = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var palette = order.map(function (hex, i) {
      var y = state.yarnMatches ? state.yarnMatches[hex] : null;
      return Schema.makePaletteEntry({
        hex: hex, count: counts[hex],
        name: y ? y.name : undefined,
        brand: y ? y.brandName : undefined,
        yarnName: y ? y.yarnName : undefined,
        yarnWeightName: y ? (y.yarnWeightId || y.yarnWeightName) : undefined,
        href: y ? y.href : undefined,
        unavailable: y ? y.unavailable : undefined
      }, i);
    });

    var nameEl = $('saveName'), visEl = $('visibilitySelect'), noteEl = $('saveNote');
    var gridColor = state.gridLineColor === 'custom' ? (state.customGridColor || '#2f6f48') : (state.gridLineColor || 'auto');

    var p = Schema.createProject({
      id: window.__fiberosCurrentProjectId || (meta.id != null ? String(meta.id) : undefined),
      name: (meta.name || (nameEl && nameEl.value) || 'Untitled project').trim() || 'Untitled project',
      visibility: (meta.visibility || (visEl && visEl.value) || 'private'),
      chart: {
        grid: grid,
        foundationChainMode: state.foundationChainMode,
        rowDirection: 'odd-rtl',
        gridLines: {
          visible: !!state.showGrid,
          color: gridColor,
          opacity: (state.gridOpacity != null ? state.gridOpacity / 100 : 1),
          majorEvery: 10
        }
      },
      conversion: { mode: mapMode(state.conversionMode) },
      packet: { notes: (meta.note != null ? meta.note : (noteEl && noteEl.value) || '') },
      source: { fileName: state.sourceFileName || '' }
    });

    p.palette = palette;                 // keep our yarn-aware palette
    p.editorState = {                    // studio-native settings, lossless round trip
      rowLabelMethod: state.rowLabelMethod,
      foundationChainMode: state.foundationChainMode,
      gridLineColor: state.gridLineColor,
      customGridColor: state.customGridColor,
      gridOpacity: state.gridOpacity,
      showGrid: state.showGrid,
      conversionMode: state.conversionMode,
      zoom: state.zoom,
      cellSize: state.cellSize
    };
    p.updatedAt = new Date().toISOString();
    window.__fiberosCurrentProjectId = p.id;
    return p;
  }

  function mapMode(m) {
    if (m === 'logo' || m === 'clip-art' || m === 'photo' || m === 'pixel-art') return m;
    if (m === 'clip') return 'clip-art';
    if (m === 'pixel') return 'pixel-art';
    return 'clip-art';
  }

  function upsert(project) {
    var list = readRaw();
    var i = -1;
    for (var k = 0; k < list.length; k++) { if (String(list[k].id) === String(project.id)) { i = k; break; } }
    if (i >= 0) list[i] = project; else list.unshift(project);
    writeRaw(list);
  }

  // -------------------------------------------------------------------------
  // LOAD a project into the editor (arriving from "Open in Studio").
  // -------------------------------------------------------------------------
  function hydrateFromProject(p) {
    if (!p || !p.chart || !Array.isArray(p.chart.grid) || !p.chart.grid.length) return false;
    var grid = p.chart.grid.map(function (r) { return r.slice(); });

    state.gridData = grid;
    state.history = [grid.map(function (r) { return r.slice(); })];
    state.historyIndex = 0;
    state.manualEditsMade = false;

    // Rebuild yarn assignments keyed by chart hex.
    state.yarnMatches = {};
    (p.palette || []).forEach(function (e) {
      if (e.yarn) {
        state.yarnMatches[(e.chartHex || '').toUpperCase()] = {
          name: e.yarn.colorwayName,
          brandName: e.yarn.brandName,
          yarnName: e.yarn.yarnName,
          yarnWeightId: e.yarn.weightId,
          href: e.yarn.href,
          hex: e.yarn.approximateHex || e.chartHex,
          unavailable: !!e.yarn.unavailable
        };
      }
    });

    // Restore settings (prefer studio-native passthrough, fall back to canonical).
    var es = p.editorState || {};
    var chart = p.chart || {};
    if (es.rowLabelMethod) state.rowLabelMethod = es.rowLabelMethod;
    state.foundationChainMode = es.foundationChainMode || chart.foundationChainMode || state.foundationChainMode;
    if (es.gridLineColor) state.gridLineColor = es.gridLineColor;
    else if (chart.gridLines && chart.gridLines.color) state.gridLineColor = chart.gridLines.color;
    if (es.customGridColor) state.customGridColor = es.customGridColor;
    if (es.gridOpacity != null) state.gridOpacity = es.gridOpacity;
    else if (chart.gridLines && chart.gridLines.opacity != null) state.gridOpacity = Math.round(chart.gridLines.opacity * 100);
    if (es.showGrid != null) state.showGrid = es.showGrid;
    else if (chart.gridLines && chart.gridLines.visible != null) state.showGrid = chart.gridLines.visible;
    if (es.conversionMode) state.conversionMode = es.conversionMode;
    if (es.zoom) state.zoom = es.zoom;
    state.sourceFileName = (p.source && p.source.fileName) || state.sourceFileName;
    state.gridLineColorDirty = true;

    // Sync the visible controls so the UI matches the loaded project.
    setVal('saveName', p.name);
    setVal('visibilitySelect', p.visibility);
    setVal('saveNote', (p.packet && p.packet.notes) || '');
    setVal('rowLabelMethod', state.rowLabelMethod);
    setVal('foundationChainMode', state.foundationChainMode);
    setVal('gridLineColor', state.gridLineColor);
    setVal('customGridColor', state.customGridColor);
    setVal('gridOpacity', state.gridOpacity);

    window.__fiberosCurrentProjectId = p.id;

    if (typeof setScreen === 'function') setScreen('editor');
    if (typeof renderPalette === 'function') { try { renderPalette(); } catch (e) {} }
    if (typeof redrawGrid === 'function') { try { redrawGrid(); } catch (e) {} }
    if (typeof showToast === 'function') showToast('Project loaded into the editor.');
    return true;
  }

  function maybeLoadOnOpen() {
    var wantsOpen = false;
    try { wantsOpen = sessionStorage.getItem('fiberos_studio_open') === '1'; } catch (e) {}
    if (!wantsOpen) return;
    try { sessionStorage.removeItem('fiberos_studio_open'); } catch (e) {}
    var p = Repo.getActive();
    hydrateFromProject(p);
  }

  // -------------------------------------------------------------------------
  // SAVE: replace studio's Save button so it writes the full v1 project.
  // Cloning the node strips studio's captured click handler cleanly.
  // -------------------------------------------------------------------------
  function installSaveOverride() {
    var old = $('confirmSaveBtn');
    if (!old) return;
    var neo = old.cloneNode(true);
    old.parentNode.replaceChild(neo, old);
    neo.addEventListener('click', function () {
      if (!(state.gridData && state.gridData.length)) {
        if (typeof showToast === 'function') showToast('Create a chart before saving.');
        return;
      }
      var nameEl = $('saveName'), visEl = $('visibilitySelect'), noteEl = $('saveNote');
      var p = buildV1({
        name: nameEl && nameEl.value,
        visibility: visEl && visEl.value,
        note: noteEl && noteEl.value
      });
      upsert(p);
      Repo.makeActive(p);              // v1 active + legacy active (for the packet page)
      mirrorToLegacyList(p);           // keep studio's own "Saved in this browser" list working
      state.signedIn = true;
      if (typeof closeModal === 'function') closeModal('saveModalWrap');
      if (typeof showToast === 'function') showToast('Saved to your library.');
      if (typeof renderSavedProjects === 'function') { try { renderSavedProjects(); } catch (e) {} }
    });
  }

  // Mirror into the legacy fiberosProjects list so studio's landing list still shows it.
  function mirrorToLegacyList(p) {
    var legacy;
    try { legacy = JSON.parse(localStorage.getItem('fiberosProjects') || '[]'); } catch (e) { legacy = []; }
    if (!Array.isArray(legacy)) legacy = [];
    var row = {
      id: p.id, name: p.name, email: (($('saveEmail') && $('saveEmail').value) || '').trim(),
      visibility: p.visibility, note: (p.packet && p.packet.notes) || '',
      grid: p.chart.grid, createdAt: new Date().toLocaleString(),
      stitches: p.conversion.stitches, rows: p.conversion.rows
    };
    var i = -1;
    for (var k = 0; k < legacy.length; k++) { if (String(legacy[k].id) === String(p.id)) { i = k; break; } }
    if (i >= 0) legacy[i] = row; else legacy.unshift(row);
    try { localStorage.setItem('fiberosProjects', JSON.stringify(legacy.slice(0, 20))); } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // Keep the v1 ACTIVE project in sync while editing (current work, not library).
  // -------------------------------------------------------------------------
  function syncActive() {
    if (state.currentScreen !== 'editor' || !(state.gridData && state.gridData.length)) return;
    try { Repo.makeActive(buildV1()); } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  installSaveOverride();
  maybeLoadOnOpen();
  setInterval(syncActive, 5000);
  window.addEventListener('beforeunload', syncActive);

  // Expose a couple of hooks for debugging / future phases.
  window.FiberOSStudioBridge = { buildV1: buildV1, hydrateFromProject: hydrateFromProject };
})();
