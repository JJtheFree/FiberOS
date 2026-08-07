/* Palette engine verification. Run: node palette-engine.test.cjs */
const assert = require('assert');
const P = require('../app/palette-engine.js');
let pass = 0;
function test(n, f) { try { f(); pass++; console.log('  ok  - ' + n); } catch (e) { console.error('  FAIL- ' + n + '\n        ' + e.message); process.exitCode = 1; } }

console.log('Color conversions:');
test('hex -> hsl -> hex round-trips closely', () => {
  ['#20482F', '#C46A2B', '#7286A3', '#FFFFFF', '#000000'].forEach(hex => {
    const hsl = P.hexToHsl(hex); const back = P.hslToHex(hsl[0], hsl[1], hsl[2]);
    assert.ok(P.distance(hex, back) < 6, hex + ' -> ' + back);
  });
});
test('luminance orders white > gray > black', () => {
  assert.ok(P.luminance('#FFFFFF') > P.luminance('#888888'));
  assert.ok(P.luminance('#888888') > P.luminance('#000000'));
});

console.log('Harmony:');
test('complementary is ~180deg from seed', () => {
  const seed = '#2F6F48'; const out = P.harmony(seed, 'complementary', 2);
  const h0 = P.hexToHsl(out[0])[0], h1 = P.hexToHsl(out[1])[0];
  let diff = Math.abs(h0 - h1) % 360; if (diff > 180) diff = 360 - diff;
  assert.ok(Math.abs(diff - 180) < 25, 'hue diff ' + diff);
});
test('harmony returns the requested count (deduped)', () => {
  const out = P.harmony('#B5631D', 'triadic', 5);
  assert.ok(out.length >= 3 && out.length <= 5, 'got ' + out.length);
  out.forEach(h => assert.ok(/^#[0-9A-F]{6}$/.test(h), 'bad hex ' + h));
});

console.log('Moods:');
test('moods are valid hex palettes', () => {
  P.moodNames().forEach(name => {
    const m = P.mood(name, 5);
    assert.ok(m.length >= 2);
    m.forEach(h => assert.ok(/^#[0-9A-Fa-f]{6}$/.test(h), name + ' bad hex ' + h));
  });
});

console.log('Extraction + background:');
test('extractFromPixels finds the dominant colors', () => {
  // 70% red, 30% blue
  const px = [];
  for (let i = 0; i < 700; i++) px.push([200, 20, 20]);
  for (let i = 0; i < 300; i++) px.push([20, 20, 200]);
  const pal = P.extractFromPixels(px, 2);
  assert.strictEqual(pal.length, 2);
  assert.ok(pal[0].weight > pal[1].weight, 'most-covered first');
  assert.ok(P.distance(pal[0].hex, '#C81414') < 40, 'dominant ~red: ' + pal[0].hex);
});
test('withBackground picks the lightest by default, most-covered byWeight', () => {
  const lit = P.withBackground(['#20482F', '#EFE9E1', '#7286A3']);
  assert.strictEqual(lit.backgroundIndex, 1, 'lightest is #EFE9E1');
  const byW = P.withBackground([{ hex: '#20482F', weight: 0.6 }, { hex: '#EFE9E1', weight: 0.1 }], { byWeight: true });
  assert.strictEqual(byW.backgroundIndex, 0, 'most-covered background');
});

console.log('\n' + pass + ' checks passed.');
