// Parametric bell: a lathe profile (mm) from the mouth diameter, height and sound-bow wall thickness.
// Pure data plus an optional three.js builder (vendored r158, lazy-loaded by atlas-3d.js). The curve is
// a generic Western bell shape (lip, sound bow, waist, shoulder, crown) scaled to the given numbers; it is
// illustrative, not a scan or a founder's strickle profile. Defaults when a number is [UNKNOWN]:
// height = 0.8 x diameter and wall = diameter / 13 [model assumptions, flagged in layout().assumed].
(function (root) {
  "use strict";
  const H_OVER_D = 0.8;      // default height/diameter [assumption]
  const T_OVER_D = 1 / 13;   // default sound-bow thickness/diameter [assumption]
  // Outer profile as fractions of (radius, height), lip to crown. Radius never increases going up.
  const OUTER = [[1.0, 0.0], [0.99, 0.04], [0.93, 0.12], [0.8, 0.25], [0.68, 0.42], [0.6, 0.6], [0.56, 0.78], [0.52, 0.9], [0.42, 0.97], [0.2, 1.0], [0.0, 1.0]];
  // Wall thickness along the profile as a fraction of the sound-bow thickness (thickest near the lip).
  const WALL = [0.55, 0.85, 1.0, 0.8, 0.55, 0.45, 0.42, 0.42, 0.5, 0.6, 0.6];

  function num(v) { return typeof v === "number" && isFinite(v) && v > 0 ? v : null; }

  // params: { diameter_m, height_m?, thickness_m? } (metres, as in the bell record). Returns mm.
  function layout(params) {
    const p = params || {};
    const dM = num(p.diameter_m);
    if (!dM) throw new Error("bell layout needs a positive diameter_m");
    const D = dM * 1000;
    let H = num(p.height_m) ? p.height_m * 1000 : D * H_OVER_D;
    H = Math.min(Math.max(H, D * 0.5), D * 2); // keep a bell-like shape for odd inputs
    let T = num(p.thickness_m) ? p.thickness_m * 1000 : D * T_OVER_D;
    T = Math.min(Math.max(T, D * 0.02), D * 0.15);
    const R = D / 2;
    const outer = OUTER.map(([r, y]) => [r * R, y * H]);
    const inner = OUTER.map(([r, y], i) => {
      const t = T * WALL[i];
      return [Math.max(0, r * R - t), Math.max(0, Math.min(y * H, H - t))];
    }).slice(0, -1);
    inner.push([0, H - T * WALL[WALL.length - 1]]);
    // One closed outline for a lathe: inner crown centre -> inner lip -> outer lip -> outer crown centre.
    const profile = inner.slice().reverse().concat(outer).map(([r, y]) => [round(r), round(y)]);
    const crown = { r: round(R * 0.16), h: round(H * 0.12) };
    const clapper = { ball: round(T * 1.6), len: round(H * 0.8) };
    return {
      kind: "bell", units: "mm", diameter: round(D), height: round(H), thickness: round(T), outer: outer.map(rp), inner: inner.map(rp), profile, crown, clapper,
      box: { w: round(D), d: round(D), h: round(H + crown.h) },
      assumed: { height: !num(p.height_m), thickness: !num(p.thickness_m) },
      nodes: ["lip", "sound_bow", "waist", "shoulder", "crown", "clapper"],
    };
  }
  function round(v) { return Math.round(v * 10) / 10; }
  function rp(pt) { return [round(pt[0]), round(pt[1])]; }

  // three.js scene for atlas-3d.js. Bronze lathe body, a simple crown block and a hanging clapper.
  function build(THREE, L) {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const bronze = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide });
    const pts = L.profile.map((p) => new THREE.Vector2(p[0], p[1]));
    group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), bronze));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(L.crown.r, L.crown.r * 1.2, L.crown.h, 24), bronze);
    crown.position.set(0, L.height + L.crown.h / 2, 0);
    group.add(crown);
    const iron = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.6 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(L.clapper.ball * 0.18, L.clapper.ball * 0.18, L.clapper.len, 12), iron);
    rod.position.set(0, L.height - L.clapper.len / 2, 0);
    group.add(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(L.clapper.ball / 2, 20, 14), iron);
    ball.position.set(0, L.height - L.clapper.len, 0);
    group.add(ball);
    group.position.y = 0;
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(L.diameter, L.height * 2, L.diameter); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffe0b0, 0.5); rim.position.set(-L.diameter, L.height, -L.diameter); scene.add(rim);
    return { scene, group, size: Math.max(L.diameter, L.box.h), lookAtY: L.height * 0.45 };
  }

  const api = { layout, build, H_OVER_D, T_OVER_D };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GD_ATLAS_MODELS = Object.assign(root.GD_ATLAS_MODELS || {}, { bell: api });
})(typeof window !== "undefined" ? window : globalThis);
