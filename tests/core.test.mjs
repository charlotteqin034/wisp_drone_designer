// Tests for the show logic in index.html (everything between the CORE START and CORE END markers).
// Run with: npm test   (Node 18 or newer, no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const core = html.split("// ===== CORE START")[1].split("// ===== CORE END")[0].replace(/^[^\n]*\n/, "");
const ctx = vm.createContext({ TextEncoder, Math, console });
vm.runInContext(core + `
  globalThis.api = { compile, positionsAt, checkShow, lightsAt, exampleLights, lightDefaults, sampleShow, fitDrone, ledEvents,
    buildDroneFile, parseDroneBin, evalPieces, makeZip, crc32, d3, LIGHT_TYPES, SHAPES, formationPoints, EXPORT };`, ctx);
const A = ctx.api;

const settings = { droneCount: 20, areaX: 6, areaY: 6, areaZ: 3, minSpacing: 0.5, maxSpeed: 1.5, maxAccel: 1.0, takeoffSpacing: 0.8, takeoffAlt: 1.0 };
const f = (id, extra) => ({ id, name: id, plane: "flat", cx: 0, cy: 0, rot: 0, start: 0, hold: 4, color: "#ffffff", ...extra });
function sampleShow() {
  const show = { settings: { ...settings }, formations: [
    f("ring", { shape: "circle", size: 3.6, cz: 1.6, hold: 8, motion: [{ type: "spin", turns: 0.5, axis: "z", smooth: true, spots: "all" }, { type: "bob", amp: 0.5, cycles: 1, spots: [0, 10] }] }),
    f("helix", { shape: "helix", size: 2.4, cz: 1.5 }),
    f("globe", { shape: "sphere", size: 2.4, cz: 1.5, hold: 5 }),
    f("wall", { shape: "grid", plane: "vertical", size: 2.6, cz: 1.5 })] };
  const c = A.compile(show, { fit: "tighten" });
  show.lights = A.exampleLights(c);
  return { show, c: A.compile(show) };
}

test("every built-in shape produces one spot per drone", () => {
  for (const shape of Object.keys(A.SHAPES).filter(k => k !== "custom")) {
    const pts = A.formationPoints({ shape, plane: "vertical", size: 2, cx: 0, cy: 0, cz: 1.5, rot: 0 }, 20);
    assert.equal(pts.length, 20, shape);
    assert.ok(pts.every(p => p.every(Number.isFinite)), shape);
  }
});

test("the sample show passes the safety check", () => {
  const { show, c } = sampleShow();
  const problems = A.checkShow(c, show.settings);
  assert.equal(problems.length, 0, JSON.stringify(problems.slice(0, 3)));
});

test("drone N takes off from pad N, and every drone lands on its own free pad", () => {
  const { c } = sampleShow();
  const start = A.positionsAt(c, 0), end = A.positionsAt(c, c.duration);
  c.home.forEach((h, i) => assert.ok(A.d3(start[i], h) < 1e-9, `drone ${i + 1} starts on pad ${i + 1}`));
  const landed = end.map(p => c.home.findIndex(h => A.d3(p, h) < 1e-6));
  assert.ok(landed.every(k => k >= 0), "every drone ends on a pad");
  assert.equal(new Set(landed).size, c.N, "no two drones land on the same pad");
});

test("every light effect returns a valid colour for every drone", () => {
  const { c } = sampleShow(), t = 10, P = A.positionsAt(c, t);
  for (const type of Object.keys(A.LIGHT_TYPES)) {
    const C = A.lightsAt(c, [{ ...A.lightDefaults(type, t - 1, c.duration), fadeIn: 0 }], t, P);
    assert.equal(C.length, 20);
    assert.ok(C.every(rgb => rgb.every(v => Number.isInteger(v) && v >= 0 && v <= 255)), type);
  }
});

test("exported .bin files round-trip and follow the designed path", () => {
  const { show, c } = sampleShow(), S = A.sampleShow(c, show.lights);
  const meta = { name: "test", showId: 0x1234ABCD, duration: c.duration, drones: c.N, pads: c.home.map(p => [p[0], p[1]]) };
  for (let i = 0; i < c.N; i++) {
    const fitted = A.fitDrone(c, S, i), ev = A.ledEvents(S, i), file = A.buildDroneFile(meta, i + 1, fitted, ev), back = A.parseDroneBin(file.bin);
    assert.equal(back.magic, "DSHW"); assert.equal(back.version, 1); assert.equal(back.drone, i + 1); assert.equal(back.showId, 0x1234ABCD);
    assert.ok(back.crcOk, "CRC and size");
    assert.equal(file.bin.length, A.EXPORT.header + back.pieces.length * A.EXPORT.pieceBytes + back.leds.length * A.EXPORT.ledBytes);
    const total = back.pieces.reduce((a, p) => a + p.dur, 0);
    assert.ok(Math.abs(total - c.duration) < 1e-3, "pieces cover the whole show");
    for (let k = 0; k <= S.K; k += 5) assert.ok(A.d3(A.evalPieces(back.pieces, k * S.dt), S.pos[k][i]) < A.EXPORT.tol, `drone ${i + 1} at ${k * S.dt}s`);
  }
});

test("a corrupted .bin fails its CRC check", () => {
  const { show, c } = sampleShow(), S = A.sampleShow(c, show.lights);
  const meta = { name: "test", showId: 1, duration: c.duration, drones: c.N, pads: c.home.map(p => [p[0], p[1]]) };
  const file = A.buildDroneFile(meta, 1, A.fitDrone(c, S, 0), A.ledEvents(S, 0));
  const bad = file.bin.slice(); bad[100] ^= 0xff;
  assert.equal(A.parseDroneBin(bad).crcOk, false);
});

test("the zip writer produces a valid archive signature", () => {
  const z = A.makeZip([{ name: "a.txt", data: "hello" }]);
  assert.deepEqual([...z.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(A.crc32(new TextEncoder().encode("123456789")), 0xCBF43926);
});
