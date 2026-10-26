import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const browser = resolve(root, ".local-tools/node_modules/agent-browser/bin/agent-browser-win32-x64.exe");
const evidence = resolve(root, ".verify/local-rhythm/tutorial");
mkdirSync(evidence, { recursive: true });

function command(...args) {
  const run = spawnSync(browser, ["--session", "ocellus-teaching-proof", "--json", ...args], { encoding: "utf8", timeout: 45_000 });
  if (run.status !== 0) throw new Error(`${args[0]} failed: ${run.stdout} ${run.stderr}`);
  const result = JSON.parse(run.stdout);
  if (!result.success) throw new Error(`${args[0]} failed: ${result.error}`);
  return result.data;
}
const read = (expression) => command("eval", expression).result;
const state = () => read("window.__archiveOcellusProbe.snapshot()");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function tickTo(at) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const snapshot = state();
    if (snapshot.fight.run.kind === "running" && snapshot.fight.run.tick >= at) return snapshot;
    await sleep(15);
  }
  throw new Error(`Encounter did not reach tick ${at}`);
}

function capture(name) {
  command("screenshot", resolve(evidence, `${name}.png`));
  writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(state(), null, 2));
}

function clickPoint(point) {
  assert.ok(point, "The cue must have a visible click position");
  command("mouse", "move", String(Math.round(point.x)), String(Math.round(point.y)));
  command("mouse", "down");
  command("mouse", "up");
}

function clickTile(tile) {
  clickPoint(read(`window.__archiveOcellusProbe.tileCentre(${JSON.stringify(tile)})`));
}

try {
  command("set", "viewport", "1280", "800");
  command("open", "http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&tutorial=on&seed=1");
  command("wait", "#tutorial_start:not([disabled])", "--timeout", "30000");
  command("snapshot", "-i");
  capture("intro");
  const intro = state();
  assert.equal(intro.ticking, false);
  assert.equal(intro.fight.run.kind, "waiting");
  await sleep(1100);
  assert.equal(state().tick, intro.tick);

  read(`(() => {
    window.__teachingPaint = { attack: null, tiles: {} };
    const fill = OffscreenCanvasRenderingContext2D.prototype.fillText;
    OffscreenCanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      const matrix = this.getTransform();
      const point = matrix.transformPoint({x, y});
      const tick = window.__archiveOcellusProbe?.snapshot().tutorial?.tick;
      if (text === '▼ ATTACK') window.__teachingPaint.attack = { x: point.x, y: point.y, tick };
      if (['A', 'B', 'A · STEP', 'B · STEP'].includes(text)) window.__teachingPaint.tiles[text] = { x: point.x, y: point.y, tick };
      return fill.call(this, text, x, y, ...rest);
    };
    return true;
  })()`);
  command("click", "#tutorial_start");
  await tickTo(0);
  command("click", "#tutorial_pause");
  const paused = state();
  assert.equal(paused.ticking, false);
  await sleep(1100);
  assert.equal(state().fight.run.tick, paused.fight.run.tick);
  capture("paused");
  command("click", "#tutorial_pause");

  const marks = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68];
  for (const [index, mark] of marks.entries()) {
    const before = await tickTo(mark - 1);
    assert.equal(before.fight.run.tick, mark - 1);
    assert.equal(before.tutorial.cue.kind, "step");
    capture(`pair-${index + 1}-step`);
    clickTile(before.tutorial.cue.tile);
    const marked = await tickTo(mark);
    assert.equal(marked.fight.run.tick, mark);
    assert.equal(marked.tutorial.cue.kind, "attack");
    capture(`pair-${index + 1}-attack`);
    const point = read("window.__teachingPaint.attack");
    assert.equal(point?.tick, mark, "The actual gold label must be drawn for this mark");
    clickPoint(point);
    const impact = await tickTo(mark + 1);
    assert.equal(impact.tutorial.feedback, "clean-pair");
  }
  const completed = state();
  assert.equal(completed.tutorial.clean, 30);
  assert.equal(completed.tutorial.attempts, 30);
  capture("thirty-clean-pairs");

  const next = await tickTo(74);
  assert.equal(next.tutorial.cue.kind, "step");
  capture("missed-attack-step");
  clickTile(next.tutorial.cue.tile);
  await tickTo(76);
  assert.equal(state().tutorial.feedback, "dodge-without-attack");
  capture("missed-attack-feedback");
  await tickTo(78);
  assert.equal(state().tutorial.feedback, "hit");
  capture("late-step-feedback");
  clickTile({ x: 8, y: 3 });
  await tickTo(80);
  assert.equal(state().tutorial.feedback, "moved-too-far");
  assert.equal(state().tutorial.cue.kind, "return-to-pair");
  capture("too-far-recovery");
  command("click", "#tutorial_pause");
  capture("final-paused");
  command("click", "#tutorial_leave");
  command("wait", "--fn", "window.__archiveOcellusProbe?.snapshot().tutorial === null && window.__archiveOcellusProbe?.snapshot().fight?.run.kind === 'running'", "--timeout", "30000");
  capture("ordinary-practice-restored");
  const errors = command("errors");
  assert.deepEqual(errors.errors ?? [], []);
  writeFileSync(resolve(evidence, "verdict.json"), JSON.stringify({ passed: true, cleanPairs: 30, clickedActualBossLabel: true, feedback: ["clean-pair", "dodge-without-attack", "hit", "moved-too-far"], introWaits: true, pauseFreezesTick: true, ordinaryPracticeRestored: true, errors }, null, 2));
  console.log("PASS teaching aid: 30 guide-driven pairs using actual gold-label clicks, four real feedback outcomes, pause/start and ordinary practice restored.");
} finally {
  command("close");
}
