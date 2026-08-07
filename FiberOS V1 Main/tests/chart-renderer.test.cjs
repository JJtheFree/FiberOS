/*
 * Phase 4 verification — the renderer's pure logic (no canvas needed).
 * Run: node chart-renderer.test.cjs
 */
const assert = require('assert');
const R = require('../app/chart-renderer.js');

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  - ' + name); }
  catch (e) { console.error('  FAIL- ' + name + '\n        ' + e.message); process.exitCode = 1; }
}

console.log('Row direction:');
test('odd-rtl: odd rows reverse, even rows forward', () => {
  assert.strictEqual(R.isReverseRow(1, 'odd-rtl'), true);
  assert.strictEqual(R.isReverseRow(2, 'odd-rtl'), false);
  assert.strictEqual(R.isReverseRow(3, 'odd-rtl'), true);
});
test('odd-ltr flips it', () => {
  assert.strictEqual(R.isReverseRow(1, 'odd-ltr'), false);
  assert.strictEqual(R.isReverseRow(2, 'odd-ltr'), true);
});

console.log('Row numbering + foundation offset:');
test('row 1 is the bottom row; top row is highest', () => {
  const N = 28;
  assert.strictEqual(R.displayedRowNumber(0, { startRow: 1, totalRows: N, foundationChainMode: 'foundation' }), 28);
  assert.strictEqual(R.displayedRowNumber(27, { startRow: 1, totalRows: N, foundationChainMode: 'foundation' }), 1);
});
test('foundation "row1" shifts every worked row up by one', () => {
  const N = 28;
  assert.strictEqual(R.displayedRowNumber(27, { startRow: 1, totalRows: N, foundationChainMode: 'row1' }), 2);
  assert.strictEqual(R.displayedRowNumber(0, { startRow: 1, totalRows: N, foundationChainMode: 'row1' }), 29);
});
test('tiled page keeps global row numbers', () => {
  // A tile whose global origin is row 11 (startRow=11), 10 tall, of a 28-row chart.
  const N = 28;
  // top of this tile (y=0) => 28 - (11-1+0) = 18
  assert.strictEqual(R.displayedRowNumber(0, { startRow: 11, totalRows: N, foundationChainMode: 'foundation' }), 18);
});

console.log('Column numbering + major lines:');
test('columns number from startCol (global on tiles)', () => {
  assert.strictEqual(R.columnNumber(0, 1), 1);
  assert.strictEqual(R.columnNumber(0, 11), 11);
  assert.strictEqual(R.columnNumber(4, 11), 15);
});
test('every 10th boundary is major', () => {
  assert.strictEqual(R.isMajorBoundary(0, 10), true);
  assert.strictEqual(R.isMajorBoundary(10, 10), true);
  assert.strictEqual(R.isMajorBoundary(20, 10), true);
  assert.strictEqual(R.isMajorBoundary(5, 10), false);
  assert.strictEqual(R.isMajorBoundary(11, 10), false);
});

console.log('Tiling:');
test('even split with global origins and correct remainder sizes', () => {
  const t = R.tileRanges(25, 25, 10, 10);
  assert.strictEqual(t.length, 9, 'got ' + t.length);
  assert.strictEqual(t[0].startCol, 1);
  assert.strictEqual(t[0].startRow, 1);
  assert.strictEqual(t[0].w, 10);
  const last = t[t.length - 1];
  assert.strictEqual(last.startCol, 21);
  assert.strictEqual(last.startRow, 21);
  assert.strictEqual(last.w, 5, 'remainder width');
  assert.strictEqual(last.h, 5, 'remainder height');
});
test('single page when chart fits in one tile', () => {
  const t = R.tileRanges(20, 20, 40, 40);
  assert.strictEqual(t.length, 1);
  assert.strictEqual(t[0].w, 20);
});

console.log('Cell geometry:');
test('cells stay square and clamped 2..18', () => {
  assert.strictEqual(R.computeCell(28, 36, 690, 560, 2, 18) <= 18, true);
  assert.strictEqual(R.computeCell(1000, 1000, 690, 560, 2, 18), 2);
  assert.strictEqual(R.computeCell(5, 5, 690, 560, 2, 18), 18);
});

console.log('\n' + pass + ' checks passed.');
