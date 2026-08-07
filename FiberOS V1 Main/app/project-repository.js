/*
 * FiberOS — Project Repository (minimal, Phase 2)
 * -----------------------------------------------
 * A thin read/write layer over the v1 project store. It runs the Phase 1 migration
 * once, then serves projects in the unified v1 shape.
 *
 * This is deliberately small for the dashboard. The full persistence service (autosave,
 * versioning, and the Supabase seam) arrives in Phase 7 — this is the seam's first stub.
 *
 * Browser globals used: FiberOSSchema, FiberOSMigrate  (load those scripts first).
 * Exposes: window.FiberOSRepo
 */
(function (root) {
  'use strict';
  var Schema = root.FiberOSSchema;
  var Migrate = root.FiberOSMigrate;
  var KEYS = Migrate.V1_KEYS;
  // When the user deletes the built-in demo, remember it so it doesn't come back.
  var DEMO_DISMISSED = 'fiberos_v1_demo_dismissed';

  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  var migratedThisLoad = false;
  function ensureMigrated() {
    if (migratedThisLoad) return;
    try { Migrate.migrate(); } catch (e) { /* storage may be blocked; ignore */ }
    migratedThisLoad = true;
  }

  // A v1-shaped demo so an empty library still shows something friendly.
  function demoProject() {
    var colors = ['#F4EFE4', '#20482F', '#7F88CF', '#2F8A5B'];
    var grid = [];
    for (var y = 0; y < 28; y++) {
      var row = [];
      for (var x = 0; x < 36; x++) {
        var cx = x - 18, cy = y - 14;
        if (cx * cx + cy * cy < 55) row.push(colors[2]);
        else if (Math.abs(cx) < 2 && y > 14) row.push(colors[3]);
        else if ((x + y) % 17 === 0) row.push(colors[1]);
        else row.push(colors[0]);
      }
      grid.push(row);
    }
    var p = Schema.createProject({
      id: 'demo', name: 'Flower Sampler', visibility: 'private',
      chart: { grid: grid },
      packet: { notes: 'Check color placement before beginning.' }
    });
    p.isDemo = true;
    return p;
  }

  function getProjects() {
    ensureMigrated();
    var list = read(KEYS.projects, []);
    if (!Array.isArray(list) || !list.length) {
      // Empty library: show the friendly demo, unless the user deleted it.
      if (read(DEMO_DISMISSED, false)) return [];
      return [demoProject()];
    }
    return list;
  }

  function saveProjects(list) { write(KEYS.projects, list); }

  // Permanently dismiss the built-in demo so it stops regenerating.
  function dismissDemo() { write(DEMO_DISMISSED, true); }

  // Rename a saved design. If the target is the demo (not yet in the real store),
  // materialize it as a real project so the new name sticks.
  function rename(id, name) {
    var nm = String(name == null ? '' : name).trim();
    if (!nm) return getProjects();
    var list = read(KEYS.projects, []);
    if (!Array.isArray(list)) list = [];
    var i = findIndexById(list, id);
    if (i >= 0) {
      list[i].name = nm;
      list[i].updatedAt = new Date().toISOString();
      saveProjects(list);
      return list;
    }
    var demo = demoProject();
    if (String(demo.id) === String(id)) {
      demo.isDemo = false;
      demo.name = nm;
      demo.updatedAt = new Date().toISOString();
      list.unshift(demo);
      saveProjects(list);
    }
    return list;
  }

  function getActive() { ensureMigrated(); return read(KEYS.active, null); }
  function setActive(project) { write(KEYS.active, project); }

  function findIndexById(list, id) {
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return i;
    return -1;
  }

  // --- Library management helpers (operate on the v1 store) -------------------
  function toggleFavorite(id) {
    var list = getProjects(); var i = findIndexById(list, id);
    if (i < 0 || list[i].isDemo) return list;
    list[i].favorite = !list[i].favorite; saveProjects(list); return list;
  }
  function toggleArchive(id) {
    var list = getProjects(); var i = findIndexById(list, id);
    if (i < 0 || list[i].isDemo) return list;
    list[i].archived = !list[i].archived; saveProjects(list); return list;
  }
  function duplicate(id) {
    var list = getProjects(); var i = findIndexById(list, id);
    if (i < 0) return list;
    var copy = JSON.parse(JSON.stringify(list[i]));
    copy.id = Schema.genId(); copy.isDemo = false;
    copy.name = (copy.name || 'Untitled') + ' copy';
    copy.updatedAt = new Date().toISOString();
    list.unshift(copy); saveProjects(list); return list;
  }
  function remove(id) {
    var list = getProjects().filter(function (p) { return String(p.id) !== String(id); });
    saveProjects(list); return list;
  }

  // --- Convenience accessors (read a v1 project without knowing its shape) ----
  var view = {
    grid: function (p) { return (p.chart && p.chart.grid) || []; },
    stitches: function (p) { return (p.conversion && p.conversion.stitches) || 0; },
    rows: function (p) { return (p.conversion && p.conversion.rows) || 0; },
    notes: function (p) { return (p.packet && p.packet.notes) || ''; },
    colorCount: function (p) { return (p.palette && p.palette.length) || 0; }
  };

  // --- Back-compat adapter: hand the legacy packet page a shape it understands.
  // (Until Packet Builder is migrated in a later phase.)
  function toLegacyActive(p) {
    return {
      id: p.id, name: p.name, visibility: p.visibility,
      note: view.notes(p), grid: view.grid(p),
      stitches: view.stitches(p), rows: view.rows(p),
      createdAt: p.createdAt,
      palette: (p.palette || []).map(function (e) {
        return {
          hex: e.chartHex,
          name: e.displayName,
          brand: e.yarn ? e.yarn.brandName : 'Unassigned',
          yarnName: e.yarn ? e.yarn.yarnName : '',
          yarnWeightName: e.yarn ? e.yarn.weightId : '',
          href: e.yarn ? e.yarn.href : '',
          count: e.stitchCount
        };
      })
    };
  }

  // Prepare a project for opening elsewhere: set v1 active AND a legacy active,
  // so both new and not-yet-migrated pages can read it.
  function makeActive(p) {
    setActive(p);
    try { localStorage.setItem('fiberosActiveProject', JSON.stringify(toLegacyActive(p))); } catch (e) {}
  }

  // Request that Studio OPEN this project into the editor. Sets it active and raises
  // an open-intent flag the studio bridge reads on load. Also suppresses studio's
  // autosave-restore prompt so the two don't fight.
  function requestOpen(p) {
    makeActive(p);
    try {
      sessionStorage.setItem('fiberos_studio_open', '1');
      sessionStorage.setItem('fiberos_recovery_asked', '1');
    } catch (e) {}
  }

  root.FiberOSRepo = {
    getProjects: getProjects,
    saveProjects: saveProjects,
    getActive: getActive,
    setActive: setActive,
    makeActive: makeActive,
    requestOpen: requestOpen,
    dismissDemo: dismissDemo,
    rename: rename,
    toLegacyActive: toLegacyActive,
    toggleFavorite: toggleFavorite,
    toggleArchive: toggleArchive,
    duplicate: duplicate,
    remove: remove,
    view: view,
    demoProject: demoProject
  };
})(typeof self !== 'undefined' ? self : this);
