// Parametric layout for the sample-lamp test fixture. Pure data (mm), no renderer.
(function (root) {
  function layout(parallel) {
    const stemH = 280;
    const cells = [
      { node: "column", shape: "cylinder", d: 20, h: stemH, x: 50, y: 50, z: 0 }
    ];
    const inner = { w: 100, d: 100, h: stemH };
    const box = { node: "base", shape: "box", w: 100, d: 100, h: 20 };
    return { units: "mm", cells, box, inner, nodes: ["base", "column", "shade"] };
  }
  const api = { layout };
  if (typeof module !== "undefined") module.exports = api;
  else root.GD_ATLAS_MODELS = Object.assign(root.GD_ATLAS_MODELS || {}, { "sample-lamp": api });
})(typeof window !== "undefined" ? window : globalThis);
