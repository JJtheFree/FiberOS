/*
 * FiberOS — Legacy -> v1 Migration
 * --------------------------------
 * Reads the old browser-storage keys the prototype wrote and upconverts everything
 * into the unified v1 schema (project-schema.js).
 *
 * Principles:
 *   - Non-destructive: legacy keys are left untouched. We only ADD new v1 keys.
 *   - Idempotent: running twice does nothing the second time (unless force:true).
 *   - Loss-averse: grid, palette, and yarn assignments carry over; missing fields
 *     fall back to schema defaults rather than being dropped.
 *
 * Works in the browser (window.FiberOSMigrate, defaults to localStorage) and in Node
 * (module.exports, pass a storage-like object to each function for testing).
 */
(function (root, factory) {
  var Schema;
  if (typeof module === 'object' && module.exports) {
    Schema = require('./project-schema.js');
    module.exports = factory(Schema);
  } else {
    Schema = root.FiberOSSchema;
    root.FiberOSMigrate = factory(Schema);
  }
})(typeof self !== 'undefined' ? self : this, function (Schema) {
  'use strict';

  // Legacy keys (read-only) and the new v1 keys (write).
  var LEGACY = {
    projects: 'fiberosProjects',
    active: 'fiberosActiveProject',
    autosave: 'fiberos_autosave_project',
    versions: 'fiberos_project_versions'
  };
  var V1 = {
    projects: 'fiberos_v1_projects',
    active: 'fiberos_v1_active_project',
    migratedFlag: 'fiberos_v1_migrated'
  };

  function safeParse(raw, fallback) {
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function getStorage(storage) {
    if (storage) return storage;
    if (typeof localStorage !== 'undefined') return localStorage;
    throw new Error('No storage provided and localStorage is unavailable.');
  }

  // An autosave/version snapshot has a different shape:
  //   { grid, palette, settings:{rowLabelMethod, foundationChainMode, conversionMode}, sourceName }
  // Fold those settings into the flat shape createProject understands.
  function fromAutosaveShape(snap) {
    var settings = snap.settings || {};
    return {
      name: snap.sourceName || 'Recovered autosave',
      chart: {
        grid: snap.grid,
        foundationChainMode: settings.foundationChainMode,
        rowDirection: mapRowLabel(settings.rowLabelMethod)
      },
      conversion: { mode: settings.conversionMode },
      palette: snap.palette,
      source: { fileName: snap.sourceName || '' },
      createdAt: snap.savedAt
    };
  }

  // The prototype's rowLabelMethod values aren't the same vocabulary as the schema's
  // rowDirection. Map the ones we recognize; otherwise let the schema default apply.
  function mapRowLabel(v) {
    if (v === 'odd-ltr' || v === 'odd-rtl') return v;
    if (v === 'ltr' || v === 'left-right') return 'odd-ltr';
    if (v === 'rtl' || v === 'right-left') return 'odd-rtl';
    return undefined; // schema will default to 'odd-rtl'
  }

  // Convert a single legacy project object of ANY known shape into v1.
  function convertOne(legacy) {
    if (!legacy || typeof legacy !== 'object') return null;

    // Already v1? Just re-normalize so it's clean and complete.
    if (legacy.schemaVersion === Schema.SCHEMA_VERSION) {
      return Schema.normalizeProject(legacy);
    }

    var input = legacy;

    // Autosave/version snapshot shape (has settings, no top-level chart).
    if (!legacy.chart && legacy.settings) {
      input = fromAutosaveShape(legacy);
    } else if (!legacy.chart) {
      // Flat prototype shape: { id, name, visibility, note, grid, stitches, rows, palette? }
      input = {
        id: legacy.id != null ? String(legacy.id) : undefined,
        name: legacy.name,
        visibility: legacy.visibility,
        createdAt: legacy.createdAt,
        chart: { grid: legacy.grid },
        conversion: { stitches: legacy.stitches, rows: legacy.rows },
        palette: legacy.palette,
        packet: { notes: legacy.note || '' },
        source: {}
      };
    }

    var project = Schema.createProject(input);
    // Preserve any note that lived at the top level of the flat shape.
    if (legacy.note && !project.packet.notes) project.packet.notes = String(legacy.note);
    return project;
  }

  // Gather every legacy project across all keys, de-duplicated by id.
  function readLegacyProjects(storage) {
    var s = getStorage(storage);
    var out = [];
    var seen = {};

    function push(p) {
      var v1 = convertOne(p);
      if (!v1) return;
      if (seen[v1.id]) return;
      // Skip empty grids from stray autosave snapshots with nothing in them.
      if (!v1.chart.grid.length) return;
      seen[v1.id] = 1;
      out.push(v1);
    }

    var list = safeParse(s.getItem(LEGACY.projects), []);
    if (Array.isArray(list)) list.forEach(push);

    var active = safeParse(s.getItem(LEGACY.active), null);
    if (active) push(active);

    // Autosave + version snapshots are recovery material; include the latest autosave
    // if it isn't already represented.
    var autosave = safeParse(s.getItem(LEGACY.autosave), null);
    if (autosave) push(autosave);

    return out;
  }

  // Run the migration. Returns a summary. Non-destructive and idempotent.
  function migrate(opts) {
    opts = opts || {};
    var s = getStorage(opts.storage);

    if (!opts.force && s.getItem(V1.migratedFlag)) {
      return {
        migrated: false,
        reason: 'already-migrated',
        projects: safeParse(s.getItem(V1.projects), [])
      };
    }

    var projects = readLegacyProjects(s);

    s.setItem(V1.projects, JSON.stringify(projects));

    // Carry the active/handoff project forward too, so open-into-editor keeps working.
    var legacyActive = safeParse(s.getItem(LEGACY.active), null);
    if (legacyActive) {
      var activeV1 = convertOne(legacyActive);
      if (activeV1) s.setItem(V1.active, JSON.stringify(activeV1));
    }

    s.setItem(V1.migratedFlag, new Date().toISOString());

    return {
      migrated: true,
      count: projects.length,
      projects: projects
    };
  }

  return {
    LEGACY_KEYS: LEGACY,
    V1_KEYS: V1,
    convertOne: convertOne,
    readLegacyProjects: readLegacyProjects,
    migrate: migrate,
    _fromAutosaveShape: fromAutosaveShape,
    _mapRowLabel: mapRowLabel
  };
});
