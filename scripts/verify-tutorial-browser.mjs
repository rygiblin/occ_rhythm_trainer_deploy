import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const browser = resolve(root, ".local-tools/node_modules/agent-browser/bin/agent-browser-win32-x64.exe");
const endurance = process.argv.includes("--endurance");
const evidence = resolve(root, endurance ? ".verify/local-rhythm/tutorial-v5" : ".verify/local-rhythm/tutorial-v4");
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
  assert.equal(before.tutorial.threat.kind, "preview");
  assert.deepEqual(before.tutorial.threat.tile, before.player);
  assert.equal(before.tutorial.threat.moveAt, before.tutorial.tick + 1);
  assert.equal(before.tutorial.threat.impactAt, before.tutorial.tick + 2);
  assertSafePair(before);
  await capture(`${name}-step`, before);
  await clickTile(before.tutorial.cue.tile);
  const marked = await tickTo(before.tutorial.tick + 1);
  assert.equal(marked.tutorial.tick, before.tutorial.tick + 1);
  assert.equal(marked.tutorial.cue.kind, "attack");
  assert.equal(marked.tutorial.threat.kind, "locked");
  assert.deepEqual(marked.tutorial.threat.tile, before.player, "The locked danger must stay on the actual marked tile");
  assert.equal(marked.tutorial.threat.playerOnMark, false);
  assert.equal(marked.tutorial.threat.markedAt, marked.tutorial.tick);
  assert.equal(marked.tutorial.threat.impactAt, marked.tutorial.tick + 1);
  assertSafePair(marked);
  await capture(`${name}-attack`, marked);
  assert.deepEqual(read(`window.__teachingPaint.labels.filter(label => label.tick === ${marked.tutorial.tick} && label.text === 'STEP')`), []);
  const point = read("window.__teachingPaint.attack");
  assert.equal(point?.tick, marked.tutorial.tick);
  await clickPoint(point);
  const impact = await tickTo(marked.tutorial.tick + 1);
  assert.equal(impact.tutorial.feedback, "clean-pair");
  assert.notEqual(impact.tutorial.threat.kind, "locked");
  assertSafePair(impact);
  return impact;
}

function observePaintAndAudio() {
  read(`(() => {
    window.__teachingPaint = { attack: null, labels: [] };
    window.__teachingAudio = [];
    const fill = OffscreenCanvasRenderingContext2D.prototype.fillText;
    OffscreenCanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      if (!['▼ ATTACK', 'HERE', 'STEP', 'POSITION', 'TARGET', 'IMPACT'].includes(text)) return fill.call(this, text, x, y, ...rest);
      const matrix = this.getTransform();
      const point = matrix.transformPoint({x, y});
      const tick = window.__archiveOcellusProbe?.snapshot().tutorial?.tick;
      if (text === '▼ ATTACK') window.__teachingPaint.attack = { x: point.x, y: point.y, tick };
      if (['HERE', 'STEP', 'POSITION', 'TARGET', 'IMPACT'].includes(text)) window.__teachingPaint.labels.push({ text, tick });
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
}

async function verifySets() {
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
  observePaintAndAudio();
  command("click", "#tutorial_start");
  await tickTo(0);
  command("click", "#tutorial_pause");
  assert.equal(read("document.querySelector('#tutorial_pulse')"), null);
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
  assert.equal(completed.tutorial.recovery.kind, "steady");
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
  assert.equal(state().tutorial.recovery.kind, "recovering");
  await capture("missed-attack-feedback");
  const committed = await tickTo(next.tutorial.tick + 3);
  assert.equal(committed.tutorial.threat.kind, "locked");
  assert.equal(committed.tutorial.threat.playerOnMark, true);
  assert.deepEqual(committed.tutorial.threat.tile, committed.player);
  await capture("committed-hit", committed);
  assert.deepEqual(read(`window.__teachingPaint.labels.filter(label => label.tick === ${committed.tutorial.tick} && ['HERE', 'STEP'].includes(label.text))`), []);
  assert.ok(read("document.body.innerText.includes('Too late for this hit')"));
  const nearImpact = await waitFor((snapshot) => {
    assert.equal(snapshot.tutorial.tick, committed.tutorial.tick);
    return snapshot.tutorial.tickProgress >= 0.65;
  }, "locked ring approaching impact");
  assert.deepEqual(nearImpact.tutorial.threat.tile, committed.tutorial.threat.tile);
  await capture("committed-hit-near-impact", nearImpact);
  await tickTo(next.tutorial.tick + 4);
  assert.equal(state().tutorial.feedback, "hit");
  assert.equal(state().tutorial.recovery.kind, "recovering");
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
  const recovered = await cleanPair(moved, "dynamic");
  assert.equal(recovered.tutorial.recovery.kind, "recovered");
  assert.deepEqual(read("window.__archiveOcellusProbe.log().rows.flatMap(row => row.events).filter(event => event.kind === 'floor-hit')"), []);
  await capture("dynamic-clean-pair");
  const steady = await cleanPair(recovered, "steady");
  assert.equal(steady.tutorial.recovery.kind, "steady");
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
  writeFileSync(resolve(evidence, "verdict.json"), JSON.stringify({ passed: true, cleanPairs: 32, floorHits: 0, movementDeadlinePreview: true, fixedActualThreat: true, committedHitWarning: true, recoveryConfirmedByCleanPair: true, steadyAfterSecondCleanPair: true, numericBarRemoved: true, heldPositioningTicks: [10, 5], fullCountInAfterPositioning: true, inactiveStepHidden: true, nativeCountdownClock: true, metronomeTones: audio.length, distinctTones: true, noDuplicateTones: true, dynamicStepAfterManualMove: true, clickedActualBossLabel: true, feedback: ["clean-pair", "dodge-without-attack", "hit", "moved-too-far"], introWaits: true, pauseFreezesTick: true, ordinaryPracticeRestored: true, errors }, null, 2));
  console.log("PASS teaching v4: 32 clean pairs, no floor hits, actual locked threats and movement previews, live recovery after errors, clear markers, metronome, readiness, pause and ordinary practice restored.");
}

async function openContinuous(mode, style, name) {
  command("set", "viewport", "1280", "800");
  command("open", `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&tutorial=on&seed=1&lessonMode=${mode}&rhythmMode=${style}`);
  input?.close();
  input = await connectInput();
  command("wait", "#tutorial_start:not([disabled])", "--timeout", "30000");
  observePaintAndAudio();
  assert.equal(state().tutorial.lessonMode, mode);
  assert.equal(state().tutorial.lesson.style, style);
  await capture(`${name}-intro`);
  command("click", "#tutorial_start");
  await tickTo(0);
}

async function continuousPairs(style, count, name) {
  let impact = null;
  for (let pair = 1; pair <= count; pair++) {
    const before = impact?.tutorial.cue.kind === "step" ? impact : await waitFor((snapshot) => snapshot.tutorial.cue.kind === "step", `${name} next step`);
    assert.equal(before.tutorial.lesson.style, style);
    impact = await cleanPair(before, `${name}-${pair}`);
    assert.equal(impact.tutorial.lesson.kind, "practice");
    assert.equal(impact.tutorial.lesson.count, null);
    assert.equal(impact.tutorial.lesson.beat, pair);
    assert.equal(impact.tutorial.attempt.kind, "running");
    assert.equal(impact.tutorial.attempt.survivedImpacts, pair);
    assert.equal(impact.tutorial.attempt.cleanPairs, pair);
    assert.equal(impact.tutorial.attempt.elapsed, impact.tutorial.tick - 5);
  }
  const rows = read("window.__archiveOcellusProbe.log().rows");
  const marks = rows.flatMap((row) => row.events).filter((event) => event.kind === "explosion-marked");
  assert.deepEqual(marks.map((mark) => mark.pulse), Array.from({ length: count }, (_, index) => index));
  assert.ok(rows.filter((row) => row.tick >= 5).every((row) => row.phase.stage === (style === "ranged" ? "inner-void" : "outer-void")));
  assert.deepEqual(rows.flatMap((row) => row.events).filter((event) => event.kind === "floor-hit"), []);
  return impact;
}

async function verifyEndurance() {
  await openContinuous("unlimited", "ranged", "unlimited-ranged");
  const ranged = await continuousPairs("ranged", 40, "unlimited-ranged");
  const hit = await tickTo(ranged.tutorial.tick + 2);
  assert.equal(hit.tutorial.feedback, "hit");
  assert.equal(hit.tutorial.attempt.kind, "running");
  assert.equal(hit.ticking, true);
  const unlimitedRecovery = await cleanPair(hit, "unlimited-ranged-recovery");
  assert.equal(unlimitedRecovery.tutorial.recovery.kind, "recovered");
  await capture("unlimited-continues-after-hit");

  await openContinuous("unlimited", "melee", "unlimited-melee");
  await continuousPairs("melee", 20, "unlimited-melee");
  await capture("unlimited-melee-past-fifteen");

  await openContinuous("survival", "ranged", "survival-ranged");
  const oldBest = Number(read("localStorage.getItem('archive-ocellus:survival-best:ranged')") ?? 0);
  const survived = await continuousPairs("ranged", 20, "survival-ranged");
  command("click", "#tutorial_pause");
  const paused = state();
  await sleep(1100);
  assert.equal(state().tutorial.attempt.elapsed, paused.tutorial.attempt.elapsed);
  command("click", "#tutorial_pause");
  const failed = await waitFor((snapshot) => snapshot.tutorial.attempt.kind === "failed", "first impact-hit result");
  assert.equal(failed.tutorial.tick, survived.tutorial.tick + 2);
  assert.equal(failed.tutorial.attempt.endedAt, failed.tutorial.tick);
  assert.equal(failed.tutorial.attempt.elapsed, failed.tutorial.tick - 5);
  assert.equal(failed.tutorial.attempt.survivedImpacts, 20);
  assert.equal(failed.tutorial.attempt.cleanPairs, 20);
  assert.equal(failed.ticking, false);
  assert.equal(failed.tutorial.threat.kind, "none");
  assert.ok(read("document.querySelector('#tutorial_pause')?.disabled !== false"));
  await capture("survival-ranged-result", failed);
  await sleep(1100);
  assert.equal(state().tutorial.tick, failed.tutorial.tick);
  assert.deepEqual(state().tutorial.attempt, failed.tutorial.attempt);
  const best = Number(read("localStorage.getItem('archive-ocellus:survival-best:ranged')"));
  assert.equal(best, Math.max(oldBest, failed.tutorial.attempt.elapsed));
  command("click", "#tutorial_retry");
  await waitFor((snapshot) => snapshot.tutorial.tick === 0 && snapshot.ticking, "mounted Retry reset");
  assert.equal(state().tutorial.clean, 0);
  assert.equal(state().tutorial.recovery.kind, "steady");
  await continuousPairs("ranged", 3, "retry");
  assert.equal(Number(read("localStorage.getItem('archive-ocellus:survival-best:ranged')")), best);
  command("reload");
  command("wait", "#tutorial_start:not([disabled])", "--timeout", "30000");
  assert.equal(Number(read("localStorage.getItem('archive-ocellus:survival-best:ranged')")), best);
  await capture("survival-best-after-reload");

  await openContinuous("survival", "melee", "survival-melee");
  const oldMeleeBest = Number(read("localStorage.getItem('archive-ocellus:survival-best:melee')") ?? 0);
  const meleeFailed = await waitFor((snapshot) => snapshot.tutorial.attempt.kind === "failed", "first melee impact hit");
  assert.equal(meleeFailed.tutorial.attempt.elapsed, 1);
  assert.equal(meleeFailed.tutorial.attempt.survivedImpacts, 0);
  assert.equal(Number(read("localStorage.getItem('archive-ocellus:survival-best:melee')")), Math.max(oldMeleeBest, 1));
  assert.equal(Number(read("localStorage.getItem('archive-ocellus:survival-best:ranged')")), best);
  await capture("survival-melee-result");
  const errors = command("errors");
  assert.deepEqual(errors.errors ?? [], []);
  const verdict = { passed: true, unlimitedRangedPairs: 40, unlimitedMeleePairs: 20, unlimitedContinuesAfterHit: true, survivalAvoidedImpacts: 20, survivalElapsedTicks: failed.tutorial.attempt.elapsed, failedOnFirstImpactHit: true, pauseExcluded: true, latchedResult: true, retryResets: true, bestSurvivesRetryAndReload: true, separateStyleBests: true, firstImpactDurationTicks: 1, uniquePulses: true, noFifteenHitBreak: true, errors };
  writeFileSync(resolve(evidence, "verdict.json"), JSON.stringify(verdict, null, 2));
  console.log("PASS teaching v5: continuous ranged/melee beyond15, Unlimited recovery afterhit, Survival first-hit result, accurate duration, Retry and separate persistent bests.");
}

try {
  if (endurance) await verifyEndurance();
  else await verifySets();
} catch (error) {
  writeFileSync(resolve(evidence, "failure-log.json"), JSON.stringify(read("window.__archiveOcellusProbe.log()"), null, 2));
  if (input) await capture("failure");
  throw error;
} finally {
  input?.close();
  command("close");
}
