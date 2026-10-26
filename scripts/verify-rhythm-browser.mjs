import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const browser = resolve(root, ".local-tools/node_modules/agent-browser/bin/agent-browser-win32-x64.exe");
const evidence = resolve(root, ".verify/local-rhythm/browser");
const session = "ocellus-rhythm-proof";
mkdirSync(evidence, { recursive: true });

function command(...args) {
  const ran = spawnSync(browser, ["--session", session, "--json", ...args], { encoding: "utf8", timeout: 45_000 });
  if (ran.status !== 0) throw new Error(`${args[0]} failed: ${ran.stderr} ${ran.stdout}`);
  const result = JSON.parse(ran.stdout);
  if (!result.success) throw new Error(`${args[0]} failed: ${result.error}`);
  return result.data;
}

const read = (expression) => command("eval", expression).result;
const snapshot = () => read("window.__archiveOcellusProbe.snapshot()");
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

async function tickTo(at) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const state = snapshot();
    if (state.fight?.run.kind === "running" && state.fight.run.tick >= at) return state;
    await pause(20);
  }
  throw new Error(`The browser did not reach encounter tick ${at}`);
}

function capture(name) {
  command("screenshot", resolve(evidence, `${name}.png`));
  writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(snapshot(), null, 2));
}

function clickTile(at, name, bodyOffset = 0) {
  const point = read(`window.__archiveOcellusProbe.tileCentre(${JSON.stringify(at)})`);
  assert.ok(point, `Tile ${JSON.stringify(at)} must be visible`);
  capture(name);
  command("mouse", "move", String(point.x), String(point.y - bodyOffset));
  command("mouse", "down");
  command("mouse", "up");
  return snapshot();
}

try {
  command("set", "viewport", "1280", "800");
  command("open", "http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&seed=1");
  command("wait", "--fn", "window.__archiveOcellusProbe?.snapshot().fight?.run.kind === 'running'", "--timeout", "30000");
  capture("prepare-ranged");
  let stepToSide = true;
  for (const [style, marks, weapon] of [
    ["ranged", [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33], 20997],
    ["melee", [40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68], 22325],
  ]) {
    for (const [index, mark] of marks.entries()) {
      const before = await tickTo(mark - 1);
      assert.equal(before.fight.run.tick, mark - 1, "Input must arrive before the mark");
      assert.equal(before.fight.player.equipped.weapon, weapon);
      clickTile({ x: stepToSide ? 6 : 5, y: 3 }, `${style}-${index + 1}-step`);
      stepToSide = !stepToSide;
      const marked = await tickTo(mark);
      assert.equal(marked.fight.run.tick, mark, "Attack input must arrive before impact");
      clickTile({ x: 5, y: 5 }, `${style}-${index + 1}-attack`, style === "ranged" ? 140 : 80);
    }
    await tickTo(marks[marks.length - 1] + 1);
    capture(`${style}-complete`);
  }
  await tickTo(70);
  const log = read("window.__archiveOcellusProbe.log()");
  writeFileSync(resolve(evidence, "fight-log.json"), JSON.stringify(log, null, 2));
  const rows = log.rows.filter((row) => row.tick <= 69);
  const impacts = rows.flatMap((row) => row.events).filter((event) => event.kind === "explosion-resolved");
  const expectedAttacks = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69];
  assert.deepEqual(impacts.map((event) => event.outcome.kind), Array(30).fill("dodged"));
  assert.deepEqual(rows.filter((row) => row.combatDraws > 0).map((row) => row.tick), expectedAttacks);
  assert.equal(snapshot().fight.run.kind, "running");
  const errors = command("errors");
  writeFileSync(resolve(evidence, "page-errors.json"), JSON.stringify(errors, null, 2));
  assert.deepEqual(errors.errors ?? [], []);
  writeFileSync(resolve(evidence, "verdict.json"), JSON.stringify({ passed: true, impacts: 30, attackTicks: expectedAttacks }, null, 2));
  console.log("PASS rhythm browser: thirty one-tile dodges, fifteen two-tick bow shots, fifteen two-tick scythe swings, no page errors.");
} finally {
  command("close");
}
