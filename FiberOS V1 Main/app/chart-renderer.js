/*
 * FiberOS — Canonical Chart Renderer (Phase 4)
 * --------------------------------------------
 * ONE engine that draws a tapestry chart, used by the packet, print, and (later)
 * standalone previews/exports. Extracted from the proven packet renderer so output
 * stays identical, then extended with the two locked rules it was missing:
 *   - foundation-chain row-number offset
 *   - configurable grid-line color / opacity
 *
 * Locked rules honored (see handoff sections 8 and 15.2):
 *   - Every chart cell is square.
 *   - Every column number shown at BOTH top and bottom.
 *   - Every row numbered on BOTH sides with a working-direction arrow.
 *   - Odd rows follow the chosen direction; even rows the opposite.
 *   - Every 10th global row/column boundary is darker and thicker.
 *   - Grid lines are clipped to the chart rectangle; labels sit outside it.
 *   - Tiled pages keep GLOBAL numbering (startCol / startRow / totalRows).
 *
 * The pure helpers are exported separately so they can be unit-tested without a canvas.
 * Works in the browser (window.FiberOSChartRenderer) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FiberOSChartRenderer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Pure logic (no canvas) ----------------------------------------------

  // Odd rows follow the chosen direction; even rows are reversed. Direction is keyed
  // to the number the reader SEES, so chart arrows and written instructions agree.
  function isReverseRow(rowNumber, rowDirection) {
    var oddRTL = rowDirection !== 'odd-ltr'; // default odd-rtl
    return (rowNumber % 2 === 1) ? oddRTL : !oddRTL;
  }

  // The row number shown for grid row y. Row 1 is the BOTTOM worked row. When the
  // starting chain counts as Row 1 ('row1'), every worked row shifts up by one.
  function displayedRowNumber(y, opts) {
    var startRow = opts.startRow || 1;
    var totalRows = opts.totalRows;
    var offset = opts.foundationChainMode === 'row1' ? 1 : 0;
    return (totalRows - (startRow - 1 + y)) + offset;
  }

  function columnNumber(x, startCol) { return (startCol || 1) + x; }

  // A boundary line is "major" when its global index is a multiple of majorEvery.
  function isMajorBoundary(globalBoundaryIndex, majorEvery) {
    var m = majorEvery || 10;
    return globalBoundaryIndex % m === 0;
  }

  // Even split of a full chart into tiles, each carrying its global origin.
  function tileRanges(rows, cols, tileH, tileW) {
    var pagesY = Math.max(1, Math.ceil(rows / tileH));
    var pagesX = Math.max(1, Math.ceil(cols / tileW));
    var out = [];
    for (var py = 0; py < pagesY; py++) {
      for (var px = 0; px < pagesX; px++) {
        var y = py * tileH, x = px * tileW;
        out.push({
          tileX: px + 1, tileY: py + 1, pagesX: pagesX, pagesY: pagesY,
          x: x, y: y,
          w: Math.min(cols, x + tileW) - x,
          h: Math.min(rows, y + tileH) - y,
          startCol: x + 1, startRow: y + 1
        });
      }
    }
    return out;
  }

  function computeCell(rows, cols, maxW, maxH, minCell, maxCell) {
    var c = Math.floor(Math.min(maxW / Math.max(1, cols), maxH / Math.max(1, rows)));
    return Math.max(minCell || 2, Math.min(maxCell || 18, c));
  }

  function luma(hex) {
    var h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // ---- Canvas rendering -----------------------------------------------------

  function renderChart(canvas, opts) {
    opts = opts || {};
    var grid = opts.grid || [];
    var rows = grid.length, cols = rows ? grid[0].length : 0;
    if (!rows || !cols) return;

    var mode = opts.mode || 'color';                 // 'color' | 'symbol' | 'both'
    var startCol = opts.startCol || 1;
    var startRow = opts.startRow || 1;
    var totalRows = opts.totalRows || rows;
    var rowDirection = opts.rowDirection || 'odd-rtl';
    var foundationChainMode = opts.foundationChainMode || 'foundation';
    var symbolFor = typeof opts.symbolFor === 'function' ? opts.symbolFor : function () { return ''; };

    var gl = opts.gridLines || {};
    var minorColor = gl.minorColor || '#888';
    var majorColor = gl.majorColor || '#333';
    var opacity = (gl.opacity != null ? gl.opacity : 1);
    var majorEvery = gl.majorEvery || 10;
    var showLines = gl.visible !== false;

    var fitPage = !!opts.fitPage;
    var maxW = opts.maxW != null ? opts.maxW : (fitPage ? 690 : 680);
    var maxH = opts.maxH != null ? opts.maxH : (fitPage ? 560 : 650);
    var cell = opts.cell || computeCell(rows, cols, maxW, maxH, 2, 18);

    var left = 58, right = 58, top = 30, bottom = 30;
    canvas.width = left + cols * cell + right;
    canvas.height = top + rows * cell + bottom;
    var ctx = canvas.getContext('2d');
    var x0 = left, y0 = top;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = Math.max(6, cell * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Cells (color and/or symbol).
    for (var yy = 0; yy < rows; yy++) {
      for (var xx = 0; xx < cols; xx++) {
        var hex = grid[yy][xx];
        var px = x0 + xx * cell, py = y0 + yy * cell;
        ctx.fillStyle = (mode === 'symbol') ? '#fff' : hex;
        ctx.fillRect(px, py, cell, cell);
        if (mode !== 'color' && cell >= 7) {
          ctx.fillStyle = (mode === 'both') ? (luma(hex) < 130 ? '#fff' : '#111') : '#111';
          ctx.fillText(symbolFor(hex), px + cell / 2, py + cell / 2);
        }
      }
    }

    // Grid lines, clipped to the chart; every 10th global boundary is major.
    if (showLines) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.rect(x0, y0, cols * cell, rows * cell);
      ctx.clip();
      var vx;
      for (vx = 0; vx <= cols; vx++) {
        var gb = startCol - 1 + vx;
        var majV = isMajorBoundary(gb, majorEvery);
        ctx.beginPath();
        ctx.strokeStyle = majV ? majorColor : minorColor;
        ctx.lineWidth = majV ? Math.max(1.25, cell * 0.12) : Math.max(0.35, cell * 0.045);
        ctx.moveTo(x0 + vx * cell, y0);
        ctx.lineTo(x0 + vx * cell, y0 + rows * cell);
        ctx.stroke();
      }
      var hy;
      for (hy = 0; hy <= rows; hy++) {
        var gtr = totalRows - (startRow - 1 + hy);
        var majH = isMajorBoundary(gtr, majorEvery);
        ctx.beginPath();
        ctx.strokeStyle = majH ? majorColor : minorColor;
        ctx.lineWidth = majH ? Math.max(1.25, cell * 0.12) : Math.max(0.35, cell * 0.045);
        ctx.moveTo(x0, y0 + hy * cell);
        ctx.lineTo(x0 + cols * cell, y0 + hy * cell);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Column numbers, top and bottom.
    ctx.fillStyle = '#222';
    ctx.font = Math.max(6, cell * 0.46) + 'px sans-serif';
    for (var cx = 0; cx < cols; cx++) {
      var n = columnNumber(cx, startCol);
      var cpx = x0 + cx * cell + cell / 2;
      ctx.textAlign = 'center';
      ctx.fillText(String(n), cpx, top / 2);
      ctx.fillText(String(n), cpx, y0 + rows * cell + bottom / 2);
    }

    // Row numbers, both sides, with the working-direction arrow.
    for (var ry = 0; ry < rows; ry++) {
      var rn = displayedRowNumber(ry, { startRow: startRow, totalRows: totalRows, foundationChainMode: foundationChainMode });
      var reverse = isReverseRow(rn, rowDirection);
      var rpy = y0 + ry * cell + cell / 2;
      ctx.textAlign = 'right';
      ctx.fillText(reverse ? (rn + ' ←') : (rn + ' →'), x0 - 5, rpy);
      ctx.textAlign = 'left';
      ctx.fillText(reverse ? ('← ' + rn) : ('→ ' + rn), x0 + cols * cell + 5, rpy);
    }

    return { cell: cell, width: canvas.width, height: canvas.height };
  }

  return {
    renderChart: renderChart,
    // pure helpers (exported for testing / reuse by instruction generator)
    isReverseRow: isReverseRow,
    displayedRowNumber: displayedRowNumber,
    columnNumber: columnNumber,
    isMajorBoundary: isMajorBoundary,
    tileRanges: tileRanges,
    computeCell: computeCell,
    luma: luma
  };
});
