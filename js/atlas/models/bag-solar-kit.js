// Parametric layout for the bag solar kit. Pure data (mm), no renderer.
// A later slice feeds these boxes and cylinders to three.js (vendored, lazy-loaded).
(function (root) {
  const CELL = { d: 32.2, h: 70.5, gap: 2 };   // 32700 cell + holder gap
  const WALL = 4;                              // box wall + insulation [assumption]
  const GRID = { 1: [4, 1], 2: [4, 2], 4: [4, 4] }; // 4S across, P groups deep

  function layout(parallel) {
    const g = GRID[parallel];
    if (!g) throw new Error("unsupported parallel count " + parallel);
    const [cols, rows] = g;
    const pitch = CELL.d + CELL.gap;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      cells.push({ node: "cells", shape: "cylinder", d: CELL.d, h: CELL.h, x: c * pitch + pitch / 2, y: r * pitch + pitch / 2, z: 0 });
    const inner = { w: cols * pitch, d: rows * pitch, h: CELL.h + 20 }; // 20 mm for busbars, BMS wires [assumption]
    const box = { node: "pack_box", shape: "box", w: inner.w + 2 * WALL, d: inner.d + 2 * WALL, h: inner.h + 2 * WALL };
    return { units: "mm", cells, box, inner, nodes: ["cells", "holders", "busbar", "bms", "pack_box", "fuse", "switch", "mppt", "panel", "pv_cable", "connectors", "usbc", "dc_out", "inverter", "bag"] };
  }
  const api = { layout, CELL };
  if (typeof module !== "undefined") module.exports = api; else root.GD_ATLAS_MODELS = Object.assign(root.GD_ATLAS_MODELS || {}, { "bag-solar-kit": api });
})(typeof window !== "undefined" ? window : globalThis);
