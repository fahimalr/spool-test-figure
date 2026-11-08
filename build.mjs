// Full-scale fatigue test of a spiral-welded X70 spool (Chowdhury MSc, Ch. 4).
// World units are inches. x runs along the pipe from Side A, y across the bay, z up.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = "light";
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- truth
const PIPE_L = 192; // spool length between cap welds, in
const RP = 15; // 30 in OD
const PITCH = 77; // seam pitch along the axis, in (seam at 50.8 deg to the axis)
const SEAM0 = 45; // seam clock angle at Side A, deg clockwise from 12 o'clock
const PMAX = 1482;
const PMIN = 206; // R = 0.139
const BREAK = 11951; // Notch 1 through-wall; N1 and N6 records end
const END = 37000;
const PAUT = [28233, 32852];
const NOTCHES = [
  { id: 1, x: 136, c2: 2, a: 0.25 },
  { id: 2, x: 116, c2: 4, a: 0.16 },
  { id: 3, x: 96, c2: 6, a: 0.135 },
  { id: 4, x: 156, c2: 8, a: 0.125 },
  { id: 5, x: 42, c2: 10, a: 0.12 },
  { id: 6, x: 126, c2: 2, a: 0.25 },
];
const clockOf = (x) => (((SEAM0 + (360 * x) / PITCH) % 360) + 360) % 360;
const ALPHA = Math.atan((2 * Math.PI * RP) / PITCH); // 50.8 deg

// CMOD records digitised from the clip gauges (inches), per notch
const csv = readFileSync(join(HERE, "cmod.csv"), "utf8").trim().split("\n").slice(1);
const TRACES = NOTCHES.map((_, i) => {
  const pts = [];
  for (const line of csv) {
    const cells = line.split(",");
    const v = cells[i + 1];
    if (v !== "" && v !== undefined) pts.push([+cells[0], +v]);
  }
  return pts.sort((p, q) => p[0] - q[0]);
});

// ---------------------------------------------------------------- layout
const W = 820;
const H = 360;
const ZC = 29; // pipe axis height
const PAD = { x: -46, y: -40, w: 328, d: 108, r: 4 };
const PAD_H = 5;
const CH = { x: -24, y: -30, w: 240, d: 60 };
const WALL = 1.5;
const FLOOR_T = 1.5;
const TALL = 54;
const LOW = 18;
const SUPPORT_X = [30, 162];
const CAP_SKIRT = 2;
const CAP_DEPTH = RP / 2; // 2:1 ellipsoidal head
const S0 = -CAP_SKIRT - CAP_DEPTH;
const S1 = PIPE_L + CAP_SKIRT + CAP_DEPTH;

const P = k.fitProjection(
  [
    [PAD.x, PAD.y, -PAD_H],
    [PAD.x + PAD.w, PAD.y, -PAD_H],
    [PAD.x, PAD.y + PAD.d, -PAD_H],
    [PAD.x + PAD.w, PAD.y + PAD.d, -PAD_H],
    [CH.x, CH.y, TALL + 8],
    [CH.x + CH.w, CH.y, TALL + 8],
    [-41, 52, 51],
  ],
  W,
  H,
  { pad: 18, azimuth: 67, elevation: 28 },
);
const KS = G.scaleOf(P);
const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const path = (pts, close = false) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("") + (close ? "Z" : "");
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / Math.hypot(...a));

const R = A.recorder(P);
const { items, nameFor } = R;
function put(name, ref, svg, shapes = [], bias = 0) {
  return R.put({ at: ref, svg, shapes, name: nameFor(name), bias });
}
const solid = (shape) => R.solid(shape);
function box(name, plan, z, h, style = {}, { extra = "", bevel = 0.3, steps = 3, bias = 0, ground = false } = {}) {
  const p = { r: 0.4, ...plan };
  const id = nameFor(name);
  const shape = solid(A.box([p.x, p.y, z], [p.x + p.w, p.y + p.d, z + h], { name: id, ground }));
  R.put({ at: [p.x + p.w / 2, p.y + p.d / 2, z + h / 2], svg: S(k.slabOf(p, z, h, P, steps, bevel), { tone: "mid", ...style }) + extra, shapes: [shape], name: id, bias });
  return p;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, steps, smooth = false, seated = false } = {}) {
  const id = nameFor(name);
  const paths = G.solidOf(profile, F, P, { ...(steps ? { steps } : {}), smooth });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = solid(A.solid(F, profile, { name: id, seated }));
  R.put({ at: add(F.o, mul(F.a, mid)), svg: S(paths, { tone: "mid", ...style, inner }) + extra, shapes: [shape], name: id, bias });
}
function cable(name, route, r, { tone = "lo", maxLength = 24, tag = "" } = {}) {
  const id = nameFor(name);
  R.route(id, route, r, { limp: true });
  tubePieces(route, r, P, { maxLength, spacing: 2.2 }).forEach((part, index) =>
    R.put({ at: part.mid, svg: tag ? `<g data-cable="${tag}">${tubeSvg(part, { tone })}</g>` : tubeSvg(part, { tone }), shapes: [A.tube(part.points, part.radii)], name: `${id}:${index}`, route: id, chunk: index }),
  );
}
const smoothRoute = (pts, radius) => G.fillet(pts, radius, 7);

// A body of revolution with a 2:1 dome on one or both ends, cut into bands.
function domed(F, s0, s1, r, { domeStart = true, domeEnd = true, depth = r / 2 } = {}) {
  const a = s0 + (domeStart ? depth : 0);
  const b = s1 - (domeEnd ? depth : 0);
  const radius = (s) => {
    if (s < a) return r * Math.sqrt(Math.max(0, 1 - ((a - s) / depth) ** 2));
    if (s > b) return r * Math.sqrt(Math.max(0, 1 - ((s - b) / depth) ** 2));
    return r;
  };
  const slope = (s) => {
    const lim = 40;
    if (s < a) {
      const u = (a - s) / depth;
      return Math.min(lim, (r * u) / depth / Math.sqrt(Math.max(1e-6, 1 - u * u)));
    }
    if (s > b) {
      const u = (s - b) / depth;
      return Math.max(-lim, (-r * u) / depth / Math.sqrt(Math.max(1e-6, 1 - u * u)));
    }
    return 0;
  };
  return { radius, slope, a, b };
}

// ---------------------------------------------------------------- back layer: the concrete pad
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PAD, -PAD_H, PAD_H, P)}"/>`);
const padItem = solid(A.box([PAD.x, PAD.y, -PAD_H], [PAD.x + PAD.w, PAD.y + PAD.d, 0], { name: "stand.pad", ground: true }));
back.push(S(k.slabOf(PAD, -PAD_H, PAD_H, P, 4, 0.8), { tone: "lo" }));
// saw-cut control joints in the slab
back.push(Ln([path([at([110, PAD.y, 0]), at([110, PAD.y + PAD.d, 0])]), path([at([PAD.x, 52, 0]), at([PAD.x + PAD.w, 52, 0])])].join(""), { tone: "faint" }));
// anchor bolts for the trough
const anchors = [];
for (const x of [CH.x - 3, 46, 116, 186, CH.x + CH.w + 3]) for (const y of [CH.y - 3, CH.y + CH.d + 3]) anchors.push(at([x, y, 0]));
back.push(Dots(anchors, { size: 0.5, tone: "mid" }));

// ---------------------------------------------------------------- the trough (test chamber)
box("stand.chamber.floor", { x: CH.x, y: CH.y, w: CH.w, d: CH.d, r: 0.6 }, 0, FLOOR_T, { tone: "lo" }, { bevel: 0.4 });
const farWall = { x: CH.x, y: CH.y, w: CH.w, d: WALL };
const seamLines = [24, 72, 120, 168].map((x) => path([at([x, CH.y + WALL, FLOOR_T]), at([x, CH.y + WALL, TALL])])).join("");
box("stand.chamber.far", farWall, FLOOR_T, TALL - FLOOR_T, { tone: "mid" }, { extra: Ln(seamLines, { tone: "faint" }) + Dots([24, 72, 120, 168].flatMap((x) => [6, 30, 50].map((z) => at([x - 1.5, CH.y + WALL, z]))), { size: 0.4, tone: "lo" }) });
box("stand.chamber.endA", { x: CH.x, y: CH.y + WALL, w: WALL, d: CH.d - 2 * WALL }, FLOOR_T, TALL - FLOOR_T, { tone: "mid" });
box("stand.chamber.capfar", { x: CH.x - 0.5, y: CH.y - 1, w: CH.w + 1, d: 3.5, r: 0.5 }, TALL, 1.4, { tone: "mid" }, { extra: Dots([0, 40, 80, 120, 160, 200].map((x) => at([x, CH.y + 0.75, TALL + 1.4])), { size: 0.42 }) });
box("stand.chamber.capA", { x: CH.x - 1, y: CH.y + 2.5, w: 3.5, d: CH.d - 5, r: 0.5 }, TALL, 1.4, { tone: "mid" });
// lifting lugs on the far wall
for (const x of [6, 96, 186]) {
  const lug = { x: x - 3.5, y: CH.y + 0.4, w: 7, d: 1.2 };
  const plane = k.sideMatrix([x, lug.y + lug.d], TALL + 5.4, P, "left");
  box("stand.chamber.lug", lug, TALL + 1.4, 6.5, { tone: "mid" }, { extra: `<g transform="${plane}"><path class="iso-line" data-tone="lo" d="M1.4 0A1.4 1.4 0 1 1 -1.4 0A1.4 1.4 0 1 1 1.4 0Z"/></g>` });
}

// timber cribbing under the spool
for (const x of SUPPORT_X) {
  const low = { x: x - 6, y: -15, w: 12, d: 30 };
  const grain = (p, z0, z1) =>
    [0.33, 0.66].map((f) => k.fadeLineSvg([at([p.x + 0.6, p.y + p.d, z0 + (z1 - z0) * f]), at([p.x + p.w - 0.6, p.y + p.d, z0 + (z1 - z0) * f])], { fade: [4, 4], tone: "faint" })).join("");
  box("stand.crib.low", low, FLOOR_T, 6, { tone: "mid" }, { extra: grain(low, FLOOR_T, FLOOR_T + 6), bevel: 0 });
  const high = { x: x - 4.5, y: -12, w: 9, d: 24 };
  box("stand.crib.high", high, FLOOR_T + 6, ZC - RP - FLOOR_T - 6, { tone: "mid" }, { extra: grain(high, FLOOR_T + 6, ZC - RP), bevel: 0 });
}

// ---------------------------------------------------------------- the spool: pipe body, welded heads, spiral seam
const PF = G.frameOf([0, 0, ZC], [1, 0, 0], [0, 0, 1], [0, -1, 0]); // angle = clock angle, clockwise seen from Side A
const onPipe = (x, deg, r = RP) => G.pointOf(PF, x, r, deg * DEG);
const normalAt = (deg) => [0, -Math.sin(deg * DEG), Math.cos(deg * DEG)];
const BODY = domed(PF, S0, S1, RP, { depth: CAP_DEPTH });
const CUTS = [-CAP_SKIRT, 0, 16, 34, 52, 70, 88, 106, 124, 142, 160, 178, PIPE_L, PIPE_L + CAP_SKIRT];
const SPOOL = G.bandsOf(
  [
    [S0, 0],
    [S1, 0],
  ],
  CUTS,
  PF,
  P,
  { radius: BODY.radius, slope: BODY.slope, rows: 8, steps: 120 },
);
const girth = (s) => Ln([G.arcOf(PF, s - 0.35, RP, P), G.arcOf(PF, s + 0.35, RP, P)].join(""), { tone: "lo", className: "ts-weld" });
SPOOL.bands.forEach((band) => {
  let inner = "";
  if (band.s0 === 0) inner += girth(0);
  if (band.s1 === PIPE_L) inner += girth(PIPE_L);
  const id = nameFor(band.s1 <= 1e-6 || band.s0 >= PIPE_L - 1e-6 ? "spool.cap" : "spool.band");
  const head = band.s1 <= -CAP_SKIRT + 1e-6 || band.s0 >= PIPE_L + CAP_SKIRT - 1e-6;
  R.put({ at: G.pointOf(PF, (band.s0 + band.s1) / 2, 0, 0), svg: S(head ? { ...band.paths, outline: band.outline } : band.paths, { tone: "hi", inner }), shapes: [solid(A.solid(PF, band.profile, { radius: BODY.radius, name: id }))], name: id });
});
{
  const sides = SPOOL.sidesOf(-CAP_SKIRT, PIPE_L + CAP_SKIRT, { ends: false });
  put("spool.sides", G.pointOf(PF, PIPE_L / 2, 0, 0), Ln(sides.d, { tone: "hi" }), sides.points.map((list) => A.tube(list, 0.4 / KS)), 0.4);
}

// spiral seam: a helix at 50.8 deg, drawn only where it faces the viewer, fading at the limb
{
  const runs = [];
  let run = null;
  for (let x = 0; x <= PIPE_L + 1e-6; x += 0.5) {
    const deg = clockOf(x);
    const facing = dot(normalAt(deg), V);
    if (facing > 0.04) {
      run ??= [];
      run.push(onPipe(x, deg, RP + 0.12));
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  runs.forEach((pts) => {
    const flat = pts.map(at);
    const startsOnEdge = pts[0][0] <= 0.01;
    const endsOnEdge = pts[pts.length - 1][0] >= PIPE_L - 0.01;
    const svg =
      k.fadeLineSvg(flat, { fade: [startsOnEdge ? 0 : 7, endsOnEdge ? 0 : 7], tone: "mid" }) +
      k.fadeLineSvg(
        pts.map((p) => at(add(p, [0, 0, 0.0]))).map(([sx, sy]) => [sx, sy - 0.7]),
        { fade: [startsOnEdge ? 0 : 7, endsOnEdge ? 0 : 7], tone: "faint" },
      );
    put("spool.seam", pts[Math.floor(pts.length / 2)], svg, [A.tube(pts, 0.25)], 0.2);
  });
}

// the six EDM notches at the weld toe, and the clip gauges bonded across them
const TOE = 0.55; // offset of the slot from the seam centreline, in
const seamTangent = (x) => {
  const deg = clockOf(x);
  const w = (2 * Math.PI) / PITCH;
  return unit([1, -RP * Math.cos(deg * DEG) * w, -RP * Math.sin(deg * DEG) * w]);
};
const notchGeo = NOTCHES.map((n) => {
  const deg = clockOf(n.x);
  const nrm = normalAt(deg);
  const t = seamTangent(n.x);
  const across = unit(cross(nrm, t));
  // slot centre: the toe, then back onto the surface
  const p = add(onPipe(n.x, deg), mul(across, TOE));
  const x0 = p[0];
  const d0 = Math.atan2(-p[1], p[2] - ZC) / DEG;
  const c = n.c2 / 2;
  const slot = [];
  for (let i = 0; i <= 10; i++) {
    const f = -1 + (2 * i) / 10;
    slot.push([x0 + f * c * Math.cos(ALPHA), d0 + (f * c * Math.sin(ALPHA)) / RP / DEG]);
  }
  const centre = onPipe(x0, d0);
  const n0 = normalAt(d0);
  const visible = dot(n0, V) > 0.05;
  return { ...n, deg: d0, x0, slot, centre, nrm: n0, t, across: unit(cross(n0, t)), visible };
});
notchGeo.forEach((g) => {
  const half = 0.16;
  const left = g.slot.map(([x, d]) => add(onPipe(x, d, RP + 0.08), mul(g.across, -half)));
  const right = g.slot.map(([x, d]) => add(onPipe(x, d, RP + 0.08), mul(g.across, half)));
  const outline = [...left, ...right.reverse()];
  const svg = `<g data-notch="${g.id}"><path class="ts-slot" d="${path(outline.map(at), true)}"/><path class="iso-line" data-tone="lo" d="${path(outline.map(at), true)}"/></g>`;
  if (g.visible) put(`spool.notch${g.id}`, g.centre, svg, [A.tube(g.slot.map(([x, d]) => onPipe(x, d, RP + 0.1)), 0.16)], 0.3);
});

const GAUGE_TOP = 2.4;
function clipGauge(g) {
  const F = G.frameOf(g.centre, g.nrm, g.across, cross(g.nrm, g.across));
  const parts = [];
  const shapes = [];
  const prism = (poly, s0, s1, tone = "mid") => {
    parts.push(S(G.prismOf(F, poly, s0, s1, P), { tone }));
    shapes.push(A.prism(F, poly, s0, s1, { name: `gauge${g.id}` }));
  };
  const rect = (u0, u1, v0, v1) => [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  // knife-edge blocks bonded either side of the slot, then the gauge body and its arms
  prism(rect(-1.25, -0.55, -0.45, 0.45), 0.05, 0.45, "mid");
  prism(rect(0.55, 1.25, -0.45, 0.45), 0.05, 0.45, "mid");
  prism(rect(-1.5, 1.5, -0.55, 0.55), 0.45, 1.85, "hi");
  const gland = G.frameOf(add(g.centre, mul(g.nrm, 1.85)), g.nrm, g.across, cross(g.nrm, g.across));
  parts.push(S(G.solidOf([[0, 0.42], [GAUGE_TOP - 1.85, 0.42]], gland, P, { steps: 18 }), { tone: "mid" }));
  shapes.push(A.disc(gland, 0, GAUGE_TOP - 1.85, 0.42, { name: `gauge${g.id}` }));
  const face = add(g.centre, mul(g.nrm, 1.85));
  parts.push(Dots([at(add(face, mul(g.across, -1.0))), at(add(face, mul(g.across, 1.0)))], { size: 0.4, tone: "lo" }));
  shapes.forEach((s) => solid(s));
  const id = nameFor(`gauge${g.id}`);
  R.put({ at: add(g.centre, mul(g.nrm, 1)), svg: `<g data-gauge="${g.id}">${parts.join("")}</g>`, shapes, name: id, bias: 0.4 });
}
notchGeo.forEach((g) => clipGauge(g));

// ---------------------------------------------------------------- cap fittings: inlet on Side B, vent on Side A
const TIP_B = PIPE_L + CAP_SKIRT + CAP_DEPTH;
const NF = G.frameOf([TIP_B, 0, ZC], [1, 0, 0], [0, 0, 1], [0, -1, 0]);
turned("inlet.boss", NF, [[-0.3, 2.2], [1.4, 2.2], [1.4, 1.6], [2.6, 1.6]], { tone: "mid" }, { seated: true });
turned("inlet.nut", NF, [[2.6, 1.9], [4.2, 1.9]], { tone: "mid" }, { steps: 6 });
turned("inlet.stem", NF, [[4.2, 1.1], [5.6, 1.1]], { tone: "mid" });
const HOSE_R = 0.95;
const HOSE = smoothRoute(
  [
    [TIP_B + 5.6, 0, ZC],
    [TIP_B + 9, 0, ZC],
    [218, 2.5, 25.5],
    [223, 7, 20],
    [225.5, 8, 19],
    [226.6, 8, 19],
  ],
  4,
);
cable("hose", HOSE, HOSE_R, { tone: "lo", maxLength: 12 });

const VENT_S = 5;
const ventBase = onPipe(VENT_S, 0, RP - 0.15);
const VF = G.frameOf(ventBase, [0, 0, 1], [1, 0, 0], [0, -1, 0]);
turned("vent.boss", VF, [[0, 1.2], [2.6, 1.2], [2.6, 0.8], [5.2, 0.8]], { tone: "mid" }, { seated: true });
turned("vent.body", VF, [[5.2, 1.5], [7.8, 1.5]], { tone: "mid" }, { steps: 6 });
turned("vent.cap", VF, [[7.8, 0.7], [8.6, 0.7]], { tone: "mid" });
{
  const stemTop = add(ventBase, [0, 0, 8.6]);
  box("vent.handle", { x: stemTop[0] - 0.4, y: stemTop[1] - 0.4, w: 6, d: 0.8, r: 0.3 }, stemTop[2], 0.6, { tone: "mid" }, { bevel: 0.1, steps: 2 });
}

// ---------------------------------------------------------------- near walls (cut low so the spool shows)
box("stand.chamber.near", { x: CH.x, y: CH.y + CH.d - WALL, w: CH.w, d: WALL }, FLOOR_T, LOW - FLOOR_T, { tone: "mid" });
box("stand.chamber.endB", { x: CH.x + CH.w - WALL, y: CH.y + WALL, w: WALL, d: CH.d - 2 * WALL }, FLOOR_T, LOW - FLOOR_T, { tone: "mid" });
box("stand.chamber.capnear", { x: CH.x + WALL, y: CH.y + CH.d - 2.5, w: CH.w - WALL + 0.5, d: 3.5, r: 0.5 }, LOW, 1.4, { tone: "mid" }, { extra: Dots([0, 40, 80, 120, 160, 200].map((x) => at([x, CH.y + CH.d - 0.75, LOW + 1.4])), { size: 0.42 }) });
box("stand.chamber.capB", { x: CH.x + CH.w - 2.5, y: CH.y + 1, w: 3.5, d: CH.d - 3.5, r: 0.5 }, LOW, 1.4, { tone: "mid" });

// ---------------------------------------------------------------- pump skid (Side B)
const SK = { x: 228, y: -18, w: 50, d: 46 };
box("stand.skid.rail", { x: SK.x, y: SK.y, w: SK.w, d: 3.2 }, 0, 4, { tone: "lo" });
box("stand.skid.rail", { x: SK.x, y: SK.y + SK.d - 3.2, w: SK.w, d: 3.2 }, 0, 4, { tone: "lo" });
box("skid.deck", { ...SK, r: 0.8 }, 4, 1.2, { tone: "mid" }, { extra: Dots([[SK.x + 2, SK.y + 2], [SK.x + SK.w - 2, SK.y + 2], [SK.x + 2, SK.y + SK.d - 2], [SK.x + SK.w - 2, SK.y + SK.d - 2]].map(([x, y]) => at([x, y, 5.2])), { size: 0.45 }) });
const DECK_Z = 5.2;
// water reservoir with lid, filler and sight glass
const TANK = { x: 252, y: -16, w: 24, d: 16 };
box("skid.tank", TANK, DECK_Z, 24, { tone: "mid" }, {
  bevel: 0,
  extra:
    `<g transform="${k.sideMatrix([TANK.x + 4, TANK.y + TANK.d], DECK_Z + 21, P, "left")}"><path class="iso-line" data-tone="lo" d="M0 0H1.6V17H0Z"/><path class="iso-line" data-tone="faint" d="M0 6H1.6"/></g>` +
    k.fadeLineSvg([at([TANK.x + 8, TANK.y + TANK.d, DECK_Z + 12]), at([TANK.x + TANK.w - 1, TANK.y + TANK.d, DECK_Z + 12])], { fade: [5, 5], tone: "faint" }),
});
box("skid.tank.lid", { x: TANK.x + 1, y: TANK.y + 1, w: TANK.w - 2, d: TANK.d - 2 }, DECK_Z + 24, 0.8, { tone: "mid" });
turned("skid.tank.filler", G.frameOf([TANK.x + 18, TANK.y + 8, DECK_Z + 24.8], [0, 0, 1], [1, 0, 0], [0, -1, 0]), [[0, 2], [1.8, 2]], { tone: "mid" });
// accumulator bottle
{
  const AF = G.frameOf([236, -8, DECK_Z], [0, 0, 1], [1, 0, 0], [0, -1, 0]);
  const bottle = domed(AF, 0, 23, 4, { domeStart: false, depth: 3 });
  const parts = G.bandsOf([[0, 4], [23, 0]], [], AF, P, { radius: bottle.radius, slope: bottle.slope, rows: 6, steps: 48 });
  parts.bands.forEach((band) => {
    const id = nameFor("skid.accumulator");
    R.put({ at: G.pointOf(AF, 10, 0, 0), svg: S({ ...band.paths, outline: band.outline }, { tone: "mid", inner: Ln(G.arcOf(AF, 4, 4, P), { tone: "faint" }) }), shapes: [solid(A.solid(AF, band.profile, { radius: bottle.radius, name: id }))], name: id });
  });
  turned("skid.accumulator.port", G.frameOf([236, -8, DECK_Z + 23 - 0.5], [0, 0, 1], [1, 0, 0], [0, -1, 0]), [[0, 1], [2.2, 1]], { tone: "mid" }, { steps: 6 });
}
// triplex pump head and outlet manifold
box("skid.pump", { x: 229, y: 4, w: 11, d: 18 }, DECK_Z, 15, { tone: "mid" }, {
  extra: Dots([7, 13, 19].map((y) => at([229, y, DECK_Z + 11])), { size: 0.5, tone: "lo" }),
});
for (const y of [8, 13, 18]) turned("skid.pump.plunger", G.frameOf([234.5, y, DECK_Z + 15], [0, 0, 1], [1, 0, 0], [0, -1, 0]), [[0, 1.6], [3, 1.6], [3, 1.1], [4, 1.1]], { tone: "mid" });
turned("skid.pump.port", G.frameOf([229, 8, 19], [-1, 0, 0], [0, 0, 1], [0, 1, 0]), [[0, 1.4], [1.2, 1.4], [1.2, 1.1], [2.4, 1.1]], { tone: "mid" }, { steps: 6 });
// coupling guard and motor
box("skid.guard", { x: 240, y: 9, w: 6, d: 10 }, DECK_Z, 13, { tone: "mid" });
box("skid.motor.feet", { x: 248, y: 8.5, w: 17, d: 11 }, DECK_Z, 2, { tone: "mid" });
{
  const MF = G.frameOf([246, 14, DECK_Z + 2 + 6], [1, 0, 0], [0, 0, 1], [0, -1, 0]);
  const id = nameFor("skid.motor");
  const ribs = G.ribsOf(MF, 3.4, 18.6, 6.3, 28, P, { fade: [0.1, 0.4], seams: true });
  R.put({ at: G.pointOf(MF, 11, 0, 0), svg: S(G.solidOf([[0, 6], [3, 6], [3, 6.3], [19, 6.3], [19, 6], [21, 6]], MF, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }), shapes: [solid(A.solid(MF, [[0, 6], [3, 6], [3, 6.3], [19, 6.3], [19, 6], [21, 6]], { name: id }))], name: id });
  turned("skid.motor.fan", G.frameOf([267, 14, DECK_Z + 8], [1, 0, 0], [0, 0, 1], [0, -1, 0]), [[0, 5.6], [2.6, 5.6], [3.2, 4.6]], { tone: "mid" });
}
// control box with the dial pressure gauge
const CB = { x: 252, y: 22, w: 14, d: 5 };
box("skid.control", CB, DECK_Z, 16, { tone: "mid" }, {
  extra: Dots([at([CB.x + 3, CB.y + CB.d, DECK_Z + 3]), at([CB.x + 11, CB.y + CB.d, DECK_Z + 3])], { size: 0.55, tone: "lo" }),
});
const DIAL = [CB.x + 7, CB.y + CB.d, DECK_Z + 10];
const DIAL_R = 3.6;
const DF = G.frameOf(DIAL, [0, 1, 0], [1, 0, 0], [0, 0, -1]);
const dialPlane = k.sideMatrix([DIAL[0], DIAL[1] + 1.2], DIAL[2], P, "left");
const SWEEP = 270;
const dialAngle = (psi) => -135 + (SWEEP * psi) / 2000; // 0 at 12 o'clock on the face
const ticks = [];
for (let i = 0; i <= 20; i++) {
  const a = dialAngle(i * 100) * DEG;
  const r0 = i % 5 === 0 ? DIAL_R - 1.3 : DIAL_R - 0.9;
  ticks.push(`M${(Math.sin(a) * r0).toFixed(2)} ${(-Math.cos(a) * r0).toFixed(2)}L${(Math.sin(a) * (DIAL_R - 0.5)).toFixed(2)} ${(-Math.cos(a) * (DIAL_R - 0.5)).toFixed(2)}`);
}
const band = (p0, p1, r) => {
  const a0 = dialAngle(p0) * DEG;
  const a1 = dialAngle(p1) * DEG;
  return `M${(Math.sin(a0) * r).toFixed(2)} ${(-Math.cos(a0) * r).toFixed(2)}A${r} ${r} 0 0 1 ${(Math.sin(a1) * r).toFixed(2)} ${(-Math.cos(a1) * r).toFixed(2)}`;
};
const needleD = `M0 0.7L0 ${-(DIAL_R - 0.8)}`;
const dialFace =
  `<g transform="${dialPlane}">` +
  `<path class="iso-line" data-tone="lo" d="${ticks.join("")}" style="stroke-width:.25"/>` +
  `<path class="iso-line" data-tone="mid" d="${band(PMIN, PMAX, DIAL_R - 0.5)}"/>` +
  `<path data-part="needle" class="iso-line" data-tone="lit" data-free="end" d="${needleD}" transform="rotate(${dialAngle(PMAX).toFixed(1)})" style="stroke-width:.45"/>` +
  `<circle class="iso-line" data-tone="mid" r="0.55" cx="0" cy="0"/>` +
  `</g>`;
{
  const id = nameFor("skid.dial");
  R.put({ at: add(DIAL, [0, 0.6, 0]), svg: S(G.solidOf([[0, DIAL_R], [1.2, DIAL_R]], DF, P, { steps: 48 }), { tone: "hi" }) + dialFace, shapes: [solid(A.disc(DF, 0, 1.2, DIAL_R, { name: id }))], name: id });
}

// ---------------------------------------------------------------- DAQ cart with the clip-gauge channels and the monitor
const CART = { x: -40, y: 39, w: 30, d: 23 };
const SHELF_Z = 4.6;
for (const [x, y] of [[CART.x + 2.5, CART.y + 2.5], [CART.x + CART.w - 2.5, CART.y + 2.5], [CART.x + 2.5, CART.y + CART.d - 2.5], [CART.x + CART.w - 2.5, CART.y + CART.d - 2.5]]) {
  turned("cart.wheel", G.frameOf([x, y - 0.7, 1.7], [0, 1, 0], [1, 0, 0], [0, 0, -1]), [[0, 1.7], [1.4, 1.7]], { tone: "lo" }, { steps: 24 });
  box("cart.fork", { x: x - 0.9, y: y - 1, w: 1.8, d: 2 }, 3.4, SHELF_Z - 3.4, { tone: "mid" }, { bevel: 0.1, steps: 2 });
}
const TOP_Z = 25;
const CAB_Z = SHELF_Z;
const PLUG_Y = [43, 46, 49, 52, 55, 58];
const front = (u, v) => k.sideMatrix([CART.x + u, CART.y + CART.d], CAB_Z + v, P, "left");
const slots = Array.from({ length: 9 }, (_, i) => `M${3 + i * 1.4} 0h0.5v5h-0.5Z`).join("");
box("cart.cabinet", { ...CART, r: 0.8 }, CAB_Z, TOP_Z + 1.2 - CAB_Z, { tone: "mid" }, {
  bevel: 0.4,
  extra:
    // the DAQ unit: a rack panel with one channel lamp per clip gauge, and a vented drawer below
    `<g transform="${front(1.6, TOP_Z - CAB_Z - 1.6)}"><path class="iso-line" data-tone="lo" d="M0 0H${CART.w - 3.2}V7H0Z"/><path class="iso-line" data-tone="faint" d="M${CART.w - 11} 1.6H${CART.w - 5}V5.4H${CART.w - 11}Z"/>${NOTCHES.map((_, i) => `<circle data-led="${i + 1}" class="ts-led" cx="${3 + i * 2.6}" cy="3.5" r="0.5"/>`).join("")}</g>` +
    `<g transform="${front(1.6, 9.6)}"><path class="iso-line" data-tone="lo" d="M0 0H${CART.w - 3.2}V7.4H0Z"/><path class="iso-line" data-tone="faint" d="${slots}" transform="translate(0 1.2)"/></g>` +
    Dots([[1.0, TOP_Z - CAB_Z - 1.0], [CART.w - 1.0, TOP_Z - CAB_Z - 1.0], [1.0, 1.4], [CART.w - 1.0, 1.4]].map(([u, v]) => at([CART.x + u, CART.y + CART.d, CAB_Z + v])), { size: 0.45, tone: "lo" }),
});
const PLUG_Z = CAB_Z + 7;
const PLUG_X = CART.x + CART.w;
PLUG_Y.forEach((y) => turned("cart.bnc", G.frameOf([PLUG_X, y, PLUG_Z], [1, 0, 0], [0, 0, 1], [0, -1, 0]), [[0, 0.75], [1.2, 0.75], [1.2, 0.5], [2.4, 0.5]], { tone: "mid" }, { steps: 16 }));
// monitor
const MON = { x: -42, y: 51, w: 34, d: 1.6 };
const MON_Z = 30;
const MON_H = 20;
box("cart.monitor.foot", { x: -29, y: 47, w: 8, d: 6, r: 1 }, TOP_Z + 1.2, 0.8, { tone: "mid" });
box("cart.monitor.neck", { x: -26, y: 49.4, w: 2, d: 1.6 }, TOP_Z + 2, MON_Z - TOP_Z - 2, { tone: "mid" });
const SCREEN = { u0: 1.2, v0: 1.2, w: MON.w - 2.4, h: MON_H - 2.4 };
const screenPlane = k.sideMatrix([MON.x, MON.y + MON.d], MON_Z + MON_H, P, "left");
// plot area on the screen (face units = inches; u right along +x, v down)
const PLOT = { u0: SCREEN.u0 + 2.2, v0: SCREEN.v0 + 2.2, w: SCREEN.w - 3.2, h: SCREEN.h - 3.8 };
const CMOD_MAX = 3.2e-3;
const uOf = (cyc) => PLOT.u0 + (PLOT.w * cyc) / END;
const vOf = (cmod) => PLOT.v0 + PLOT.h - (PLOT.h * Math.min(cmod, CMOD_MAX)) / CMOD_MAX;
const TRACE_PTS = TRACES.map((pts) => pts.map(([c, m]) => [+uOf(c).toFixed(2), +vOf(m).toFixed(2), Math.round(c), +(m * 1000).toFixed(3)]));
const screenSvg =
  `<g transform="${screenPlane}"><clipPath id="ts-screen"><rect x="${SCREEN.u0}" y="${SCREEN.v0}" width="${SCREEN.w}" height="${SCREEN.h}"/></clipPath>` +
  `<rect class="ts-screen" x="${SCREEN.u0}" y="${SCREEN.v0}" width="${SCREEN.w}" height="${SCREEN.h}"/>` +
  `<g clip-path="url(#ts-screen)">` +
  `<path class="iso-line" data-tone="faint" data-free="" d="M${PLOT.u0} ${PLOT.v0}V${PLOT.v0 + PLOT.h}H${PLOT.u0 + PLOT.w}" style="stroke-width:.12"/>` +
  [1e-3, 2e-3, 3e-3].map((m) => `<path class="iso-line" data-tone="faint" data-free="" d="M${PLOT.u0} ${vOf(m).toFixed(2)}h${PLOT.w}" style="stroke-width:.06"/>`).join("") +
  [BREAK, ...PAUT].map((c, i) => `<path class="iso-line" data-tone="${i ? "faint" : "lo"}" data-free="" d="M${uOf(c).toFixed(2)} ${PLOT.v0}V${PLOT.v0 + PLOT.h}" style="stroke-width:.08"/>`).join("") +
  TRACE_PTS.map((_, i) => `<polyline class="ts-trace" data-trace="${i + 1}" points=""/>`).join("") +
  `<path data-part="cursor" class="iso-line" data-tone="mid" data-free="" d="M${PLOT.u0} ${PLOT.v0}V${PLOT.v0 + PLOT.h}" style="stroke-width:.08"/>` +
  `<text class="ts-screen-text" x="${SCREEN.u0 + 0.8}" y="${SCREEN.v0 + 1.3}" font-size="0.95">CMOD</text>` +
  `<text class="ts-screen-text" data-count="" x="${SCREEN.u0 + SCREEN.w - 0.8}" y="${SCREEN.v0 + 1.3}" font-size="0.95" text-anchor="end">N 0</text>` +
  `<text class="ts-screen-text" x="${PLOT.u0 + PLOT.w}" y="${PLOT.v0 + PLOT.h + 1.1}" font-size="0.75" text-anchor="end">37,000 cycles</text>` +
  `</g></g>`;
box("cart.monitor", MON, MON_Z, MON_H, { tone: "mid" }, { extra: screenSvg, bevel: 0.2 });

// ---------------------------------------------------------------- clip-gauge cables: over the near wall, along the floor, into the DAQ
const byX = [...notchGeo].sort((a, b) => a.x0 - b.x0);
byX.forEach((g, i) => {
  const yf = 37.5 + i * 3.2;
  const yc = PLUG_Y[i];
  const xt = PLUG_X + 8 + i * 3;
  const top = add(g.centre, mul(g.nrm, GAUGE_TOP));
  const pts = [top, add(g.centre, mul(g.nrm, GAUGE_TOP + 1.4))];
  if (!g.visible) {
    // far-side gauges: the cable is draped over the top of the spool to the near side
    for (let d = g.deg - 9; d > -32; d -= 8) pts.push(onPipe(g.x0, d, RP + GAUGE_TOP + 1.4));
  } else {
    const q = add(g.centre, mul(g.nrm, GAUGE_TOP + 2.4));
    pts.push(q, [q[0], q[1] + 5, q[2] + (g.nrm[2] > 0 ? 0.5 : 2.5)]);
  }
  const x = g.x0;
  const F0 = 0.62;
  pts.push([x, 30.5, 23], [x, 35.5, 11], [x, 37.5, 2], [x, yf, F0], [xt, yf, F0], [xt, yc, F0], [PLUG_X + 6, yc, F0], [PLUG_X + 5, yc, PLUG_Z - 3], [PLUG_X + 3.6, yc, PLUG_Z], [PLUG_X + 2.4, yc, PLUG_Z]);
  cable(`cable${g.id}`, smoothRoute(pts, 3.2), 0.35, { tone: "lo", maxLength: 20, tag: g.id });
});

// ---------------------------------------------------------------- assemble
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
const LABEL =
  "Full-scale fatigue test. A 30 inch spiral-welded X70 spool, 192 inches between its welded 2:1 heads, lies on timber cribbing in a steel trough. A triplex pump on a skid at Side B cycles it with water between 206 and 1,482 psi through a hose on the Side B head. Six EDM notches sit at the toe of the 50.8 degree spiral seam, each with a clip gauge bonded across it; the gauge cables run over the near wall to a data cart whose monitor plots crack-mouth opening against cycles.";
const PAINT = [
  [/^spool\.cap/, "cap"],
  [/^spool\.band/, "steel"],
  [/^stand\.chamber/, "green"],
  [/^stand\.crib/, "timber"],
  [/^skid\.(pump|guard|motor|control)/, "blue"],
  [/^skid\.accumulator/, "red"],
  [/^stand\.skid/, "blue"],
  [/^(inlet|vent)\./, "brass"],
];
const paint = (item) => {
  const hit = PAINT.find(([re]) => re.test(item.name));
  return hit ? `<g class="ts-${hit[1]}">${item.svg}</g>` : item.svg;
};
// ---------------------------------------------------------------- part labels (scientific-figure callouts)
const FIG_W = 1010;
const FIG_H = 500;
const OX = 125;
const OY = 78;
const scr = (p) => {
  const [x, y] = at(p);
  return [x + OX, y + OY];
};
const FS = 10.5;
const textW = (t) => t.length * FS * 0.56;
const g2 = notchGeo.find((g) => g.id === 2);
const LABELS = {
  top: [
    ["Vent valve", add(ventBase, [0, 0, 9])],
    ["Welded 2:1 end cap (Side A)", G.pointOf(PF, S0 + 3.2, BODY.radius(S0 + 3.2) - 0.1, 335 * DEG)],
    ["Lifting lug", [96, CH.y + 1.6, TALL + 6]],
    ["Spiral seam, 50.8° to axis", onPipe(61, clockOf(61), RP + 0.1)],
    ["X70 spool, 30 in OD × 0.441 in wall", onPipe(104, 352)],
    ["Steel test chamber", [176, CH.y + WALL, 46]],
  ],
  bottom: [
    ["Gauge cables to DAQ", [24, 37.5, 0.6]],
    ["Timber cribbing", [SUPPORT_X[0] + 6, 4, FLOOR_T + 4]],
    ["Clip gauge over EDM notch", add(g2.centre, mul(g2.nrm, 1.9))],
    ["Welded end cap (Side B)", G.pointOf(PF, S1 - 3.2, BODY.radius(S1 - 3.2) - 0.1, 250 * DEG)],
  ],
  left: [
    ["Monitor: CMOD vs cycles", [MON.x + 4, MON.y + MON.d, MON_Z + MON_H - 3]],
    ["Data acquisition cabinet", [CART.x + 5, CART.y + CART.d, CAB_Z + 13]],
  ],
  right: [
    ["Accumulator", [236, -4, DECK_Z + 18]],
    ["Water reservoir", [TANK.x + TANK.w - 4, TANK.y + 4, DECK_Z + 24.8]],
    ["Water inlet", [TIP_B + 3.4, 0, ZC + 1.9]],
    ["High-pressure hose", HOSE[Math.floor(HOSE.length * 0.55)]],
    ["Triplex pump", [234.5, 18, DECK_Z + 18.5]],
    ["Electric motor", [262, 14, DECK_Z + 8 + 6.3]],
    ["Pressure gauge", add(DIAL, [2.4, 1.2, -1.2])],
  ],
};
const segX = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
const permute = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permute([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
// pick the label order with the fewest crossing leaders, then the least travel
function arrange(list, lo, hi, gap, end) {
  let best = null;
  for (const order of permute(list)) {
    place(order, lo, hi, gap);
    const segs = order.map((l) => [[l.ax, l.ay], end(l)]);
    let cross = 0;
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) if (segX(...segs[i], ...segs[j])) cross++;
    const travel = order.reduce((t, l) => t + Math.abs(l.pos + l.size / 2 - l.want), 0);
    const score = cross * 1e6 + travel;
    if (!best || score < best.score) best = { score, pos: order.map((l) => l.pos), order };
  }
  best.order.forEach((l, i) => (l.pos = best.pos[i]));
}
function place(list, lo, hi, gap) {
  let prev = lo;
  for (const l of list) {
    l.pos = Math.max(l.want - l.size / 2, prev);
    prev = l.pos + l.size + gap;
  }
  let next = hi;
  for (let i = list.length - 1; i >= 0; i--) {
    const l = list[i];
    l.pos = Math.min(l.pos, next - l.size);
    next = l.pos - gap;
  }
}
const TOP_Y = 34;
const BOT_Y = FIG_H - 22;
const LEFT_X = 112;
const RIGHT_X = 880;
const callouts = [];
const lab = (side, text, p3) => {
  const [ax, ay] = scr(p3);
  return { side, text, ax, ay };
};
const top = LABELS.top.map(([t, p]) => ({ ...lab("top", t, p), size: textW(t) }));
top.forEach((l) => (l.want = l.ax));
arrange(top, 20, FIG_W - 20, 14, (l) => [l.pos + l.size / 2, TOP_Y + 4]);
const bottom = LABELS.bottom.map(([t, p]) => ({ ...lab("bottom", t, p), size: textW(t) }));
bottom.forEach((l) => (l.want = l.ax));
arrange(bottom, 20, FIG_W - 20, 14, (l) => [l.pos + l.size / 2, BOT_Y - FS - 1]);
const left = LABELS.left.map(([t, p]) => ({ ...lab("left", t, p), size: FS * 1.6 }));
left.forEach((l) => (l.want = l.ay));
arrange(left, 60, FIG_H - 60, 6, (l) => [LEFT_X, l.pos + l.size / 2]);
const right = LABELS.right.map(([t, p]) => ({ ...lab("right", t, p), size: FS * 1.6 }));
right.forEach((l) => (l.want = l.ay));
arrange(right, 60, FIG_H - 60, 6, (l) => [RIGHT_X, l.pos + l.size / 2]);
for (const l of top) callouts.push({ ...l, tx: l.pos + l.size / 2, ty: TOP_Y, anchor: "middle", ex: l.pos + l.size / 2, ey: TOP_Y + 4 });
for (const l of bottom) callouts.push({ ...l, tx: l.pos + l.size / 2, ty: BOT_Y, anchor: "middle", ex: l.pos + l.size / 2, ey: BOT_Y - FS - 1 });
for (const l of left) callouts.push({ ...l, tx: LEFT_X - 4, ty: l.pos + l.size / 2 + FS * 0.35, anchor: "end", ex: LEFT_X, ey: l.pos + l.size / 2 });
for (const l of right) callouts.push({ ...l, tx: RIGHT_X + 4, ty: l.pos + l.size / 2 + FS * 0.35, anchor: "start", ex: RIGHT_X, ey: l.pos + l.size / 2 });
const calloutSvg =
  `<g class="ts-callouts">` +
  callouts.map((c) => `<path class="ts-leader" d="M${c.ax.toFixed(1)} ${c.ay.toFixed(1)}L${c.ex.toFixed(1)} ${c.ey.toFixed(1)}"/>`).join("") +
  callouts.map((c) => `<circle class="ts-pin" cx="${c.ax.toFixed(1)}" cy="${c.ay.toFixed(1)}" r="1.9"/>`).join("") +
  callouts.map((c) => `<text class="ts-label" x="${c.tx.toFixed(1)}" y="${c.ty.toFixed(1)}" text-anchor="${c.anchor}">${c.text}</text>`).join("") +
  // notch tags beside each clip gauge (N3 and N4 are on the far side; their tags sit on the cable where it crosses the crown)
  notchGeo
    .map((g) => {
      const p = g.visible ? add(g.centre, mul(g.nrm, 3.4)) : onPipe(g.x0, 0, RP + GAUGE_TOP + 1.4);
      const [x, y] = scr(p);
      const dx = g.visible ? 7 : 6;
      const dy = g.visible ? -5 : -7;
      return `<text class="ts-tag" data-tag="${g.id}" x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}">N${g.id}</text>`;
    })
    .join("") +
  `</g>`;
const svg = k.figureSvg({ width: FIG_W, height: FIG_H, label: LABEL, body: [`<g transform="translate(${OX} ${OY})">`, ...back, ...items.map(paint), `</g>`, calloutSvg] });

const live = `
const TRACES = ${JSON.stringify(TRACE_PTS)};
const PLOT = ${JSON.stringify(PLOT)};
const END = ${END}, BREAK = ${BREAK}, PMAX = ${PMAX}, PMIN = ${PMIN};
const NOTCH = ${JSON.stringify(NOTCHES.map((n) => ({ id: n.id, c2: n.c2, a: n.a })))};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const needle = svg.querySelector('[data-part="needle"]');
const cursor = svg.querySelector('[data-part="cursor"]');
const count = svg.querySelector("[data-count]");
const traces = [...svg.querySelectorAll("[data-trace]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dialAngle = (psi) => -135 + (${SWEEP} * psi) / 2000;
const LOOP = 44, RUN = 38;
let clock = 0, cycles = 0, target = 0, pick = 1, touring = true, visible = false, frame = 0, last = 0, idle = 0, phase = 0;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const valueAt = (i, c) => {
  const pts = TRACES[i];
  if (!pts.length || c < pts[0][2]) return null;
  let j = 0;
  while (j < pts.length - 1 && pts[j + 1][2] <= c) j++;
  return pts[j];
};
function select(n) {
  pick = n;
  svg.querySelectorAll("[data-gauge]").forEach((g) => g.querySelectorAll(".iso-solid").forEach((s) => (+g.dataset.gauge === n ? s.setAttribute("data-lit", "") : s.removeAttribute("data-lit"))));
  svg.querySelectorAll("[data-notch]").forEach((g) => (+g.dataset.notch === n ? g.setAttribute("data-on", "") : g.removeAttribute("data-on")));
  traces.forEach((t) => (+t.dataset.trace === n ? t.setAttribute("data-on", "") : t.removeAttribute("data-on")));
  svg.querySelectorAll("[data-tag]").forEach((t) => (+t.dataset.tag === n ? t.setAttribute("data-on", "") : t.removeAttribute("data-on")));
  svg.querySelectorAll("[data-cable]").forEach((c) => (+c.dataset.cable === n ? c.setAttribute("data-on", "") : c.removeAttribute("data-on")));
  svg.querySelectorAll("[data-led]").forEach((l) => (+l.dataset.led === n ? l.setAttribute("data-on", "") : l.removeAttribute("data-on")));
}
let drawn = -1;
function draw() {
  const c = Math.round(cycles);
  if (c !== drawn) {
    drawn = c;
    traces.forEach((t, i) => {
      const pts = TRACES[i];
      let s = "";
      for (const p of pts) { if (p[2] > c) break; s += p[0] + "," + p[1] + " "; }
      t.setAttribute("points", s);
    });
    const u = PLOT.u0 + (PLOT.w * c) / END;
    cursor.setAttribute("d", "M" + u.toFixed(2) + " " + PLOT.v0 + "V" + (PLOT.v0 + PLOT.h));
    count.textContent = "N " + fmt(c);
  }
  const psi = PMIN + (PMAX - PMIN) * (0.5 - 0.5 * Math.cos(phase));
  needle.setAttribute("transform", "rotate(" + dialAngle(psi).toFixed(1) + ")");
  const n = NOTCH[pick - 1];
  const v = valueAt(pick - 1, c);
  let tail;
  if ((pick === 1 || pick === 6) && c >= BREAK) tail = pick === 1 ? "through-wall at " + fmt(BREAK) : "record ends " + fmt(BREAK);
  else tail = v ? "CMOD " + v[3].toFixed(2) + "×10⁻³ in" : "no reading yet";
  const text = "cycle " + fmt(c) + " · " + fmt(psi) + " psi · N" + n.id + " " + tail;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(c));
  stage.setAttribute("aria-valuetext", text);
}
function tourPick(c) {
  if (c < BREAK) return 1;
  const order = [2, 3, 5, 4];
  return order[Math.floor((c - BREAK) / ((END - BREAK) / order.length)) % order.length];
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  phase += dt * 2 * Math.PI * 0.55;
  if (touring) {
    clock = (clock + dt) % LOOP;
    target = Math.min(END, (END * clock) / RUN);
    const want = tourPick(target);
    if (want !== pick) select(want);
  }
  cycles = touring ? target : cycles + (target - cycles) * (1 - Math.exp(-dt / 0.2));
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (c) => {
  touring = false;
  target = clamp(c, 0, END);
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = (target / END) * RUN; run(); }, 5000);
  if (still.matches) { cycles = target; draw(); }
  run();
};
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (ev) => {
  const box = svg.getBoundingClientRect();
  steer(END * clamp(((ev.clientX - box.left) / box.width - 0.1) / 0.8, 0, 1));
});
stage.addEventListener("keydown", (ev) => {
  if (/^[1-6]$/.test(ev.key)) { select(+ev.key); steer(target); ev.preventDefault(); return; }
  let to = null;
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp") to = target + 1000;
  if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") to = target - 1000;
  if (ev.key === "Home") to = 0;
  if (ev.key === "End") to = END;
  if (to === null) return;
  ev.preventDefault();
  steer(to);
});
if (still.matches) { touring = false; cycles = target = 20000; select(2); phase = Math.PI; }
else select(1);
draw();
`;

const STYLE = `<style>
.ts-slot{fill:var(--anatomy-halo)}
[data-notch][data-on] .ts-slot{fill:var(--anatomy-lit)}
[data-notch][data-on] .iso-line{stroke:var(--anatomy-lit)}
.ts-screen{fill:var(--anatomy-halo)}
.ts-trace{fill:none;stroke:var(--anatomy-mid);stroke-width:.12;stroke-linejoin:round}
.ts-trace[data-on]{stroke:var(--anatomy-lit);stroke-width:.22}
.ts-screen-text{fill:var(--anatomy-mid);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ts-led{fill:var(--anatomy-lo)}
[data-cable][data-on] .tb-edge{stroke:var(--anatomy-lit)}
.ts-led[data-on]{fill:var(--anatomy-lit)}
.ts-leader{fill:none;stroke:var(--anatomy-strong);stroke-width:.55;opacity:.75}
.ts-pin{fill:var(--anatomy-strong);stroke:var(--anatomy-card);stroke-width:.8}
.ts-label{font-family:"Helvetica Neue",Arial,sans-serif;font-size:${FS}px;fill:var(--anatomy-strong);paint-order:stroke;stroke:var(--anatomy-card);stroke-width:3px;stroke-linejoin:round}
.ts-tag{font-family:"Helvetica Neue",Arial,sans-serif;font-size:8.5px;font-weight:700;fill:var(--anatomy-strong);paint-order:stroke;stroke:var(--anatomy-card);stroke-width:2.6px;stroke-linejoin:round}
.ts-tag[data-on]{fill:var(--anatomy-lit)}
.ts-steel{--anatomy-paper:#1b2129;--anatomy-top:#232b35;--anatomy-shade-0:#12171d;--anatomy-shade-1:#151b22;--anatomy-shade-2:#181f27;--anatomy-shade-3:#1c232c;}
body[data-theme="light"] .ts-steel{--anatomy-paper:#e8edf2;--anatomy-top:#f4f7fa;--anatomy-shade-0:#bccad7;--anatomy-shade-1:#c9d4df;--anatomy-shade-2:#d6dfe7;--anatomy-shade-3:#e1e8ee;}
.ts-cap{--anatomy-paper:#121314;--anatomy-top:#1a1b1d;--anatomy-shade-0:#0a0a0b;--anatomy-shade-1:#0d0d0e;--anatomy-shade-2:#101011;--anatomy-shade-3:#131315;}
body[data-theme="light"] .ts-cap{--anatomy-paper:#5b6067;--anatomy-top:#6e737a;--anatomy-shade-0:#393c41;--anatomy-shade-1:#43464b;--anatomy-shade-2:#4d5056;--anatomy-shade-3:#585b61;}
.ts-green{--anatomy-paper:#16231a;--anatomy-top:#1d2d22;--anatomy-shade-0:#0e1711;--anatomy-shade-1:#111b14;--anatomy-shade-2:#141f17;--anatomy-shade-3:#18241b;}
body[data-theme="light"] .ts-green{--anatomy-paper:#d3e6d3;--anatomy-top:#e1efe1;--anatomy-shade-0:#9cc4a0;--anatomy-shade-1:#acceaf;--anatomy-shade-2:#bcd8be;--anatomy-shade-3:#cbe1cc;}
.ts-timber{--anatomy-paper:#2a2116;--anatomy-top:#34291c;--anatomy-shade-0:#1d170f;--anatomy-shade-1:#211a11;--anatomy-shade-2:#251e14;--anatomy-shade-3:#2a2217;}
body[data-theme="light"] .ts-timber{--anatomy-paper:#ecdbbd;--anatomy-top:#f4e7cf;--anatomy-shade-0:#c9a676;--anatomy-shade-1:#d4b688;--anatomy-shade-2:#dec49c;--anatomy-shade-3:#e7d2b0;}
.ts-blue{--anatomy-paper:#17203a;--anatomy-top:#1e2a4a;--anatomy-shade-0:#0f1529;--anatomy-shade-1:#121930;--anatomy-shade-2:#151d37;--anatomy-shade-3:#19223f;}
body[data-theme="light"] .ts-blue{--anatomy-paper:#d4e0f3;--anatomy-top:#e3ebf8;--anatomy-shade-0:#8ea8d6;--anatomy-shade-1:#a1b7de;--anatomy-shade-2:#b4c6e6;--anatomy-shade-3:#c6d4ed;}
.ts-red{--anatomy-paper:#33191a;--anatomy-top:#3e2021;--anatomy-shade-0:#241112;--anatomy-shade-1:#291415;--anatomy-shade-2:#2e1718;--anatomy-shade-3:#331a1b;}
body[data-theme="light"] .ts-red{--anatomy-paper:#f2d2cf;--anatomy-top:#f8e2e0;--anatomy-shade-0:#d4908a;--anatomy-shade-1:#dca19c;--anatomy-shade-2:#e3b2ae;--anatomy-shade-3:#eac3c0;}
.ts-brass{--anatomy-paper:#2d2614;--anatomy-top:#382f18;--anatomy-shade-0:#1f1a0d;--anatomy-shade-1:#231d0f;--anatomy-shade-2:#272111;--anatomy-shade-3:#2c2514;}
body[data-theme="light"] .ts-brass{--anatomy-paper:#efe0b4;--anatomy-top:#f6ebc9;--anatomy-shade-0:#c9a74f;--anatomy-shade-1:#d3b565;--anatomy-shade-2:#dcc27c;--anatomy-shade-3:#e6d095;}
.iso{--anatomy-lit:#ff8a3d;--anatomy-lit-top:#4a2a14;--anatomy-lit-shade:#3a210f}
body[data-theme="light"].iso,body[data-theme="light"] .iso-figure{--anatomy-lit:#e8590c;--anatomy-lit-top:#ffe8d6;--anatomy-lit-shade:#ffd2b0}
.ts-weld{stroke:#d9822b}
.ts-screen{fill:#06140d}
.ts-trace{stroke:#3f8f6a}
.ts-screen-text{fill:#5fbf8f}
</style>`;

const body =
  STYLE +
  k.plateHtml({
    fig: "Fig 4.1",
    title: "Full-scale spool test",
    hint: "Hover to scrub cycles · keys 1–6 pick a notch",
    readout: `cycle 0 · ${PMAX.toLocaleString("en-US")} psi · N1 no reading yet`,
    keys: [
      { mark: "lit", label: "The selected clip gauge, its notch and its trace" },
      { mark: "raised", label: "Spool: 30 in OD, 0.441 in wall, X70, spiral seam at 50.8°" },
    ],
    caption:
      "The full-scale test as a machine. Water from the pump skid cycles the end-capped spool between 206 and 1,482 psi (R = 0.139, hoop stress 72 % of SMYS). Six EDM notches at the toe of the spiral seam each carry a clip gauge; the monitor replays their crack-mouth opening as digitised from the test. Notch 1 broke through at 11,951 cycles, when the records of both deep notches end; the shallow notches showed no measurable opening until about 26,000–29,000 cycles. From this side Notches 3 and 4 are on the far side of the pipe, so only their cables show.",
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Spool fatigue test: arrow keys step 1,000 cycles, keys 1 to 6 pick a notch" aria-valuemin="0" aria-valuemax="${END}" aria-valuenow="0">${svg}</div>`,
  });

const out = "test-spool.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Full-scale spool test", theme: THEME, body, script: kitScript() + live, width: 1040 }));
console.log("wrote", out, items.length, "items");
A.auditOrExit(R, P);
