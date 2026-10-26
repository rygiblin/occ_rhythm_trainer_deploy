import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const browser = resolve(root, ".local-tools/node_modules/agent-browser/bin/agent-browser-win32-x64.exe");
const evidence = resolve(root, ".verify/local-rhythm/modes");
mkdirSync(evidence, { recursive: true });

function command(...args) {
  const run = spawnSync(browser, ["--session", "ocellus-rhythm-modes", "--json", ...args], { encoding: "utf8", timeout: 45_000 });
  if (run.status !== 0) throw new Error(`${args[0]} failed: ${run.stdout} ${run.stderr}`);
  const result = JSON.parse(run.stdout);
  if (!result.success) throw new Error(`${args[0]} failed: ${result.error}`);
  return result.data;
}

const read = (expression) => command("eval", expression).result;
const state = () => read("window.__archiveOcellusProbe.snapshot()");
const ready = () => command("wait", "--fn", "window.__archiveOcellusProbe?.snapshot().fight?.run.kind === 'running'", "--timeout", "30000");

function capture(name) {
  command("snapshot", "-i");
  command("screenshot", resolve(evidence, `${name}.png`));
  writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(state(), null, 2));
}

try {
  command("set", "viewport", "1280", "800");
  command("open", "http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&seed=1");
  ready();
  capture("default");
  for (const [mode, weapon, phase, voidKind] of [
    ["ranged", 20997, "inner-void", "inner-void"],
    ["melee", 22325, "outer-void", "outer-void"],
  ]) {
    command("click", "#rhythm_mode");
    command("wait", "--fn", `new URL(location.href).searchParams.get('rhythmMode') === '${mode}'`, "--timeout", "10000");
    ready();
    assert.equal(state().fight.player.equipped.weapon, weapon);
    capture(`${mode}-start`);
    command("wait", "--fn", "(window.__archiveOcellusProbe?.snapshot().fight?.run.tick ?? -1) >= 41", "--timeout", "35000");
    const now = state();
    assert.equal(now.fight.run.phase.stage, phase);
    assert.equal(now.fight.player.equipped.weapon, weapon);
    const impacts = read("window.__archiveOcellusProbe.log().rows.flatMap(row => row.events).filter(event => event.kind === 'explosion-resolved')");
    assert.ok(impacts.length >= 16);
    assert.ok(impacts.every((impact) => impact.void === voidKind));
    capture(`${mode}-repeats`);
    if (mode === "melee") {
      command("click", "#restart");
      ready();
      assert.equal(read("new URL(location.href).searchParams.get('rhythmMode')"), "melee");
      assert.equal(state().fight.player.equipped.weapon, 22325);
      capture("melee-restart");
    }
  }
  command("click", "#rhythm_mode");
  ready();
  assert.ok([null, "alternating"].includes(read("new URL(location.href).searchParams.get('rhythmMode')")));
  assert.equal(state().fight.player.equipped.weapon, 20997);
  capture("alternating-restored");
  const errors = command("errors");
  assert.deepEqual(errors.errors ?? [], []);
  writeFileSync(resolve(evidence, "verdict.json"), JSON.stringify({ passed: true, modes: ["alternating", "ranged", "melee"], restartPreservesMode: true, errors }, null, 2));
  console.log("PASS mode button: ranged and melee repeat alone, Restart preserves mode, default alternating restored, no page errors.");
} finally {
  command("close");
}
