/*
 * Phase 1 verification.
 * Exercises the schema + migration against realistic legacy fixtures using a mock
 * localStorage. Run: node migrate.test.cjs
 */
const assert = require('assert');
const Schema = require('../app/project-schema.js');
const Migrate = require('../app/project-migrate.js');

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  - ' + name); }
  catch (e) { console.error('  FAIL- ' + name + '\n        ' + e.message); process.exitCode = 1; }
}

// --- Mock storage ------------------------------------------------------------
function mockStorage(seed) {
  const map = Object.assign({}, seed);
  return {
    getItem: k => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: k => { delete map[k]; },
    _dump: () => map
  };
}

// --- Fixtures (the four real legacy shapes we mapped from the code) ----------
const smallGrid = [
  ['#FFFFFF', '#C13F8A', '#C13F8A'],
  ['#2A7D58', '#FFFFFF', '#C13F8A'],
  ['#2A7D58', '#2A7D58', '#FFFFFF']
];

// Shape A: bare saveProject() payload (no palette)
const flatSaved = {
  id: 1712345678901, name: 'Bare Save', email: 'a@b.com',
  visibility: 'public', note: 'watch color placement',
  grid: smallGrid, createdAt: '7/19/2025, 6:03:00 PM', stitches: 3, rows: 3
};

// Shape B: packet handoff (rich palette + yarn assignment)
const activeHandoff = {
  id: 'active-999', name: 'Packet Handoff', visibility: 'private', note: '',
  grid: smallGrid, stitches: 3, rows: 3, createdAt: '7/19/2025, 6:05:00 PM',
  palette: [
    { hex: '#FFFFFF', name: 'Background', brand: 'Unassigned', yarnName: '', yarnWeightName: '', href: '', count: 3 },
    { hex: '#C13F8A', name: 'Magenta Pop', brand: 'Red Heart', yarnName: 'Super Saver', yarnWeightName: '4', href: 'https://ex/1', count: 4 },
    { hex: '#2A7D58', name: 'Forest', brand: 'Lion Brand', yarnName: 'Wool-Ease', yarnWeightName: '4', href: '', count: 3 }
  ]
};

// Shape C: demo project (palette with {hex,count,name,brand})
const demo = {
  id: 'demo', name: 'Flower Sampler', visibility: 'private',
  createdAt: '7/19/2025', stitches: 3, rows: 3, grid: smallGrid, note: 'Check placement.',
  palette: [{ hex: '#FFFFFF', count: 3, name: 'Color 1', brand: 'Unassigned' }]
};

// Shape D: autosave snapshot (settings, no chart)
const autosave = {
  version: 2, savedAt: '2025-07-19T22:40:00.000Z', screen: 'editor',
  grid: smallGrid,
  palette: [{ hex: '#C13F8A', count: 4 }],
  settings: { zoom: 1.2, rowLabelMethod: 'odd-ltr', foundationChainMode: 'row1', conversionMode: 'logo' },
  sourceName: 'flower.png'
};

// ============================================================================
console.log('Schema:');

test('createProject produces a valid v1 project', () => {
  const p = Schema.createProject({ name: 'X', chart: { grid: smallGrid } });
  const v = Schema.validate(p);
  assert.ok(v.ok, 'errors: ' + v.errors.join(', '));
  assert.strictEqual(p.schemaVersion, 1);
  assert.strictEqual(p.type, 'tapestry');
});

test('createProject infers stitches/rows from grid', () => {
  const p = Schema.createProject({ chart: { grid: smallGrid } });
  assert.strictEqual(p.conversion.stitches, 3);
  assert.strictEqual(p.conversion.rows, 3);
});

test('palette derived from grid when none supplied', () => {
  const p = Schema.createProject({ chart: { grid: smallGrid } });
  assert.strictEqual(p.palette.length, 3, 'three distinct colors');
  // white should be named Background and carry no yarn
  const white = p.palette.find(e => e.chartHex === '#FFFFFF');
  assert.strictEqual(white.displayName, 'Background');
  assert.ok(!white.yarn, 'background has no yarn');
  // most-used color first
  assert.ok(p.palette[0].stitchCount >= p.palette[1].stitchCount);
});

test('every palette entry gets a unique-ish symbol', () => {
  const p = Schema.createProject({ chart: { grid: smallGrid } });
  const syms = p.palette.map(e => e.symbol);
  assert.strictEqual(new Set(syms).size, syms.length);
});

test('defaults land where expected', () => {
  const p = Schema.createProject({});
  assert.strictEqual(p.chart.foundationChainMode, 'foundation');
  assert.strictEqual(p.chart.rowDirection, 'odd-rtl');
  assert.strictEqual(p.packet.instructionMode, 'symbol-color');
  assert.strictEqual(p.packet.compressRuns, true);
  assert.strictEqual(p.source.adjustments.brightness, 100);
});

console.log('Converter:');

test('flat saved shape (no palette) converts and derives palette', () => {
  const p = Migrate.convertOne(flatSaved);
  assert.ok(Schema.validate(p).ok);
  assert.strictEqual(p.name, 'Bare Save');
  assert.strictEqual(p.visibility, 'public');
  assert.strictEqual(p.packet.notes, 'watch color placement');
  assert.strictEqual(p.chart.grid.length, 3);
  assert.strictEqual(p.palette.length, 3);
  assert.strictEqual(String(p.id), '1712345678901');
});

test('packet handoff yarn assignments survive', () => {
  const p = Migrate.convertOne(activeHandoff);
  const magenta = p.palette.find(e => e.chartHex === '#C13F8A');
  assert.ok(magenta.yarn, 'magenta has a yarn');
  assert.strictEqual(magenta.yarn.brandName, 'Red Heart');
  assert.strictEqual(magenta.yarn.yarnName, 'Super Saver');
  assert.strictEqual(magenta.yarn.colorwayName, 'Magenta Pop');
  assert.strictEqual(magenta.yarn.href, 'https://ex/1');
  // "Unassigned" background must NOT get a yarn object
  const white = p.palette.find(e => e.chartHex === '#FFFFFF');
  assert.ok(!white.yarn, 'unassigned stays unassigned');
});

test('autosave shape maps settings into chart/conversion', () => {
  const p = Migrate.convertOne(autosave);
  assert.ok(Schema.validate(p).ok);
  assert.strictEqual(p.chart.foundationChainMode, 'row1');
  assert.strictEqual(p.chart.rowDirection, 'odd-ltr');
  assert.strictEqual(p.conversion.mode, 'logo');
  assert.strictEqual(p.source.fileName, 'flower.png');
});

test('converting an already-v1 project is idempotent', () => {
  const once = Migrate.convertOne(activeHandoff);
  const twice = Migrate.convertOne(once);
  assert.deepStrictEqual(twice, once);
});

console.log('Migration run:');

test('migrate gathers all keys, dedupes, writes v1 store', () => {
  const s = mockStorage({
    fiberosProjects: JSON.stringify([flatSaved, demo]),
    fiberosActiveProject: JSON.stringify(activeHandoff),
    fiberos_autosave_project: JSON.stringify(autosave)
  });
  const res = Migrate.migrate({ storage: s });
  assert.ok(res.migrated);
  // flatSaved + demo + activeHandoff + autosave = 4 distinct ids
  assert.strictEqual(res.count, 4, 'got ' + res.count);
  const stored = JSON.parse(s.getItem('fiberos_v1_projects'));
  assert.strictEqual(stored.length, 4);
  stored.forEach(p => assert.ok(Schema.validate(p).ok, 'stored project invalid'));
  // active carried forward
  const active = JSON.parse(s.getItem('fiberos_v1_active_project'));
  assert.strictEqual(active.name, 'Packet Handoff');
});

test('migrate is idempotent (second run is a no-op)', () => {
  const s = mockStorage({ fiberosProjects: JSON.stringify([flatSaved]) });
  const first = Migrate.migrate({ storage: s });
  assert.ok(first.migrated);
  const second = Migrate.migrate({ storage: s });
  assert.strictEqual(second.migrated, false);
  assert.strictEqual(second.reason, 'already-migrated');
});

test('migrate is non-destructive (legacy keys untouched)', () => {
  const seed = { fiberosProjects: JSON.stringify([flatSaved]) };
  const s = mockStorage(seed);
  Migrate.migrate({ storage: s });
  assert.strictEqual(s.getItem('fiberosProjects'), seed.fiberosProjects);
});

test('empty/garbage grids are skipped', () => {
  const s = mockStorage({
    fiberosProjects: JSON.stringify([{ id: 'empty', name: 'Nope', grid: [] }, flatSaved])
  });
  const res = Migrate.migrate({ storage: s });
  assert.strictEqual(res.count, 1, 'only the real project survives');
});

console.log('\n' + pass + ' checks passed.');
