import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const browser = resolve(root, ".local-tools/node_modules/agent-browser/bin/agent-browser-win32-x64.exe");
const evidence = resolve(root, ".verify/local-rhythm/tutorial-v3");
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
let input = null;

async function connectInput() {
  const socket = new WebSocket(command("get", "cdp-url").cdpUrl);
  await new Promise((done, reject) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const pending = new Map();
  let serial = 0;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const reply = pending.get(message.id);
    if (!reply) return;
    pending.delete(message.id);
    if (message.error) reply.reject(new Error(message.error.message));
    else reply.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetInfos } = await send("Target.getTargets");
  const target = targetInfos.find((target) => target.type === "page" && target.url.startsWith("http://127.0.0.1:8002/"));
  assert.ok(target, "The verification trainer tab must exist");
  const { sessionId } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  return { send: (method, params) => send(method, params, sessionId), close: () => socket.close() };
}

async function tickTo(at) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const snapshot = state();
    if (snapshot.fight.run.kind === "running" && snapshot.fight.run.tick >= at) return snapshot;
    await sleep(15);
  }
  throw new Error(`Encounter did not reach tick ${at}`);
}

async function waitFor(predicate, label) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const snapshot = state();
    if (predicate(snapshot)) return snapshot;
    await sleep(15);
  }
  throw new Error(`Did not observe ${label}`);
}

async function capture(name, snapshot) {
  const shot = await input.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  writeFileSync(resolve(evidence, `${name}.jpg`), Buffer.from(shot.data, "base64"));
  writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(snapshot ?? state(), null, 2));
}

async function clickPoint(point) {
  assert.ok(point, "The cue must have a visible click position");
  const position = { x: Math.round(point.x), y: Math.round(point.y) };
  await input.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...position });
  await input.send("Input.dispatchMouseEvent", { type: "mousePressed", ...position, button: "left", clickCount: 1 });
  await input.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...position, button: "left", clickCount: 1 });
}

async function clickTile(tile) {
  await clickPoint(read(`window.__archiveOcellusProbe.tileCentre(${JSON.stringify(tile)})`));
}

function assertSafePair(snapshot) {
  assert.equal(snapshot.tutorial.safeFloor, true, "The player must be on safe floor");
  const innerDanger = snapshot.tutorial.lesson.style === "ranged";
  for (const tile of Object.values(snapshot.tutorial.tiles)) {
    const central = tile.x >= 3 && tile.x <= 7 && tile.y >= 3 && tile.y <= 7;
    assert.equal(central, !innerDanger, "Both teaching tiles must be safe for the current style");
  }
}

async function reposition(style, hold) {
  const before = await waitFor((snapshot) => snapshot.tutorial.lesson.kind === "positioning" && snapshot.tutorial.lesson.style === style, `${style} positioning`);
  assert.equal(before.tutorial.cue.kind, "return-to-pair");
  await capture(`${style}-positioning`);
  const held = await tickTo(before.tutorial.tick + hold);
  assert.equal(held.tutorial.lesson.kind, "positioning");
  assert.equal(held.tutorial.attempts, before.tutorial.attempts);
  assert.equal(held.tutorial.safeFloor, true);
  const waitingRows = read(`window.__archiveOcellusProbe.log().rows.filter(row => row.tick >= ${before.tutorial.tick} && row.tick <= ${held.tutorial.tick})`);
  assert.ok(waitingRows.every((row) => ["after-inner", "after-outer"].includes(row.phase.stage)));
  assert.deepEqual(waitingRows.flatMap((row) => row.events).filter((event) => ["floor-hit", "explosion-marked", "explosion-resolved"].includes(event.kind)), []);
  assert.deepEqual(read(`window.__teachingPaint.labels.filter(label => label.tick >= ${before.tutorial.tick} && label.text === 'STEP')`), []);
  await capture(`${style}-held-safe`);
  await clickTile(held.tutorial.cue.tile);
  const counting = await waitFor((snapshot) => snapshot.tutorial.lesson.kind === "count-in" && snapshot.tutorial.lesson.style === style, `${style} count-in`);
  assert.equal(counting.tutorial.lesson.remaining, 5);
  assertSafePair(counting);
  return counting;
}

async function cleanPair(before, name) {
  assert.equal(before.tutorial.cue.kind, "step");
  assertSafePair(before);
  await capture(`${name}-step`, before);
  await clickTile(before.tutorial.cue.tile);
  const marked = await tickTo(before.tutorial.tick + 1);
  assert.equal(marked.tutorial.tick, before.tutorial.tick + 1);
  assert.equal(marked.tutorial.cue.kind, "attack");
  assertSafePair(marked);
  await capture(`${name}-attack`, marked);
  const point = read("window.__teachingPaint.attack");
  assert.equal(point?.tick, marked.tutorial.tick);
  await clickPoint(point);
  const impact = await tickTo(marked.tutorial.tick + 1);
  assert.equal(impact.tutorial.feedback, "clean-pair");
  assertSafePair(impact);
  return impact;
}

try {
  command("set", "viewport", "1280", "800");
  command("open", "http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&tutorial=on&seed=1");
  input = await connectInput();
  command("wait", "#tutorial_start:not([disabled])", "--timeout", "30000");
  command("snapshot", "-i");
  await capture("intro");
  const intro = state();
  assert.equal(intro.ticking, false);
  assert.equal(intro.fight.run.kind, "waiting");
  await sleep(1100);
  assert.equal(state().tick, intro.tick);

  read(`(() => {
    window.__teachingPaint = { attack: null, labels: [] };
    window.__teachingAudio = [];
    const fill = OffscreenCanvasRenderingContext2D.prototype.fillText;
    OffscreenCanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      const matrix = this.getTransform();
      const point = matrix.transformPoint({x, y});
      const tick = window.__archiveOcellusProbe?.snapshot().tutorial?.tick;
      if (text === '▼ ATTACK') window.__teachingPaint.attack = { x: point.x, y: point.y, tick };
      if (['HERE', 'STEP', 'POSITION'].includes(text)) window.__teachingPaint.labels.push({ text, tick });
      return fill.call(this, text, x, y, ...rest);
    };
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const oscillator = create.call(this);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (...args) => {
        window.__teachingAudio.push({ tick: window.__archiveOcellusProbe.snapshot().tutorial.tick, frequency: oscillator.frequency.value });
        return start(...args);
      };
      return oscillator;
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
  assert.deepEqual(read("window.__teachingAudio"), []);
  await capture("paused");
  command("click", "#tutorial_metronome");
  await sleep(700);
  assert.deepEqual(read("window.__teachingAudio"), []);
  command("click", "#tutorial_pause");

  const pulseSamples = [];
  for (const style of ["ranged", "melee"]) {
    if (style === "melee") await reposition(style, 10);
    let previousImpact = null;
    for (let pair = 1; pair <= 15; pair++) {
      const before = previousImpact?.tutorial.cue.kind === "step" ? previousImpact : await waitFor((snapshot) => snapshot.tutorial.cue.kind === "step" && snapshot.tutorial.lesson.style === style, `${style} step ${pair}`);
      pulseSamples.push(before.tutorial.tickProgress);
      previousImpact = await cleanPair(before, `${style}-${pair}`);
    }
  }
  const completed = state();
  assert.equal(completed.tutorial.clean, 30);
  assert.equal(completed.tutorial.attempts, 30);
  await capture("thirty-clean-pairs");
  const log = read("window.__archiveOcellusProbe.log()");
  writeFileSync(resolve(evidence, "safe-floor-fight-log.json"), JSON.stringify(log, null, 2));
  assert.deepEqual(log.rows.flatMap((row) => row.events).filter((event) => event.kind === "floor-hit"), []);
  assert.ok(pulseSamples.every((progress) => progress >= 0 && progress <= 1));
  assert.ok(pulseSamples.some((progress) => progress > 0 && progress < 1));
  const audio = read("window.__teachingAudio");
  assert.ok(audio.length >= 30, "Enabled metronome must emit real tones");
  assert.ok(new Set(audio.map((tone) => tone.frequency)).size >= 2, "Step and attack must have distinct tones");
  assert.equal(new Set(audio.map((tone) => tone.tick)).size, audio.length, "No duplicate tones or catch-up bursts");

  await reposition("ranged", 5);
  const next = await waitFor((snapshot) => snapshot.tutorial.cue.kind === "step", "next ranged step");
  assert.equal(next.tutorial.cue.kind, "step");
  await capture("missed-attack-step");
  await clickTile(next.tutorial.cue.tile);
  await tickTo(next.tutorial.tick + 2);
  assert.equal(state().tutorial.feedback, "dodge-without-attack");
  await capture("missed-attack-feedback");
  await tickTo(next.tutorial.tick + 4);
  assert.equal(state().tutorial.feedback, "hit");
  await capture("late-step-feedback");
  const stationary = state().player;
  await clickTile({ x: stationary.x + 2, y: stationary.y });
  await tickTo(next.tutorial.tick + 6);
  assert.equal(state().tutorial.feedback, "moved-too-far");
  const moved = state();
  assert.equal(moved.tutorial.cue.kind, "step");
  assert.equal(Math.max(Math.abs(moved.tutorial.cue.tile.x - moved.player.x), Math.abs(moved.tutorial.cue.tile.y - moved.player.y)), 1);
  assertSafePair(moved);
  await capture("dynamic-step-after-moving-away");
  await cleanPair(moved, "dynamic");
  assert.deepEqual(read("window.__archiveOcellusProbe.log().rows.flatMap(row => row.events).filter(event => event.kind === 'floor-hit')"), []);
  await capture("dynamic-clean-pair");
  command("click", "#tutorial_pause");
  await capture("final-paused");
  const pausedAudio = read("window.__teachingAudio.length");
  await sleep(1100);
  assert.equal(read("window.__teachingAudio.length"), pausedAudio);
  command("click", "#tutorial_metronome");
  command("set", "viewport", "800", "800");
  await capture("compact-paused-800");
  command("click", "#tutorial_leave");
  command("wait", "--fn", "window.__archiveOcellusProbe?.snapshot().tutorial === null && window.__archiveOcellusProbe?.snapshot().fight?.run.kind === 'running'", "--timeout", "30000");
  await capture("ordinary-practice-restored");
  const errors = command("errors");
  assert.deepEqual(errors.errors ?? [], []);
  writeFileSync(resolve(evidence, "verdict.json"), JSON.stringify({ passed: true, cleanPairs: 31, floorHits: 0, heldPositioningTicks: [10, 5], fullCountInAfterPositioning: true, inactiveStepHidden: true, fractionalPulse: true, metronomeTones: audio.length, distinctTones: true, noDuplicateTones: true, dynamicStepAfterManualMove: true, clickedActualBossLabel: true, feedback: ["clean-pair", "dodge-without-attack", "hit", "moved-too-far"], introWaits: true, pauseFreezesTick: true, ordinaryPracticeRestored: true, errors }, null, 2));
  console.log("PASS teaching v3: 31 clean pairs, no floor hits, safe readiness waits and full count-ins, clear markers, fractional pulse, real metronome tones, pause and ordinary practice restored.");
} catch (error) {
  writeFileSync(resolve(evidence, "failure-log.json"), JSON.stringify(read("window.__archiveOcellusProbe.log()"), null, 2));
  if (input) await capture("failure");
  throw error;
} finally {
  input?.close();
  command("close");
}
