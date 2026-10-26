import { tile } from "../../../sim/brands";
import { UNDER_BOSS, startDrill } from "./drill";
import { loadPage } from "./page";

const RANGED = { A: tile(5, 2), B: tile(6, 2) };
const MELEE = { A: tile(5, 3), B: tile(6, 3) };
const TEACHING = { focus: "rhythm-loop", tutorial: "on" } as const;
type Drill = ReturnType<typeof startDrill>;

function status(drill: Drill) {
  const value = drill.region.tutorialStatus();
  if (!value) throw new Error("the lesson has no public status");
  return value;
}
function next(drill: Drill): void { drill.tickTo((status(drill).tick ?? -1) + 1); }
async function follow(drill: Drill, clean: number): Promise<void> {
  for (let guard = 0; status(drill).clean < clean; guard++) {
    if (guard > 160) throw new Error("the guide did not reach the requested clean pairs");
    const { cue } = status(drill);
    if (cue.kind === "step" || cue.kind === "return-to-pair") await drill.click(cue.tile);
    if (cue.kind === "attack") await drill.click(UNDER_BOSS);
    next(drill);
  }
}

describe("guided rhythm lesson", () => {
  test("the first safe count-in retains next-tick step and attack timing", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(0);
    expect(status(drill).lesson).toEqual({ kind: "count-in", style: "ranged", remaining: 5 });
    drill.tickTo(4);
    expect(status(drill).cue).toEqual({ kind: "step", style: "ranged", beat: 1, target: "B", tile: RANGED.B });
    await drill.click(RANGED.B);
    drill.tickTo(5);
    expect(status(drill).cue.kind).toBe("attack");
    await drill.click(UNDER_BOSS);
    drill.tickTo(6);
    expect(status(drill)).toMatchObject({ feedback: "clean-pair", clean: 1, attempts: 1, lesson: { kind: "practice", style: "ranged", beat: 1 } });
    drill.dispose();
  });
  test.each([
    { mode: "ranged", here: tile(9, 3), step: tile(10, 3) },
    { mode: "ranged", here: tile(3, 2), step: tile(4, 2) },
    { mode: "melee", here: tile(3, 3), step: tile(4, 3) },
    { mode: "melee", here: tile(7, 3), step: tile(6, 3) },
  ] as const)("$mode follows a manual safe position and earns a clean attack", async ({ mode, here, step }) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    drill.tickTo(0);
    await drill.click(here);
    drill.tickTo(4);
    expect(status(drill)).toMatchObject({ tiles: { A: here, B: step }, cue: { kind: "step", tile: step } });
    await drill.click(step);
    drill.tickTo(5);
    expect(status(drill).tiles.A).toEqual(step);
    await drill.click(UNDER_BOSS);
    drill.tickTo(6);
    expect(status(drill)).toMatchObject({ feedback: "clean-pair", safeFloor: true });
    expect(drill.events("floor-hit")).toEqual([]);
    drill.dispose();
  });
  test("positioning waits on clear floor, accepts movement, then gives a full count-in", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(35);
    expect(status(drill)).toMatchObject({ lesson: { kind: "positioning", style: "melee" }, safeFloor: true, virtualTick: 35 });
    const attempts = status(drill).attempts;
    drill.tickTo(60);
    expect(status(drill)).toMatchObject({ lesson: { kind: "positioning", style: "melee" }, attempts, virtualTick: 35, safeFloor: true });
    expect(drill.rows().filter((row) => row.tick >= 35).flatMap((row) => row.beats)).toEqual([]);
    expect(drill.events("floor-hit")).toEqual([]);
    const markers = drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile");
    expect(markers.map((marker) => marker.visible(0))).toEqual([true, false]);
    const position = status(drill).cue;
    if (position.kind !== "return-to-pair") throw new Error("no positioning target");
    await drill.click(position.tile);
    next(drill);
    expect(drill.player().location).toEqual(position.tile);
    next(drill);
    expect(status(drill).lesson).toEqual({ kind: "count-in", style: "melee", remaining: 5 });
    const started = status(drill).tick ?? 0;
    drill.tickTo(started + 4);
    expect(status(drill).cue.kind).toBe("step");
    expect(drill.events("explosion-marked").filter((event) => event.at > 35)).toEqual([]);
    await follow(drill, 15);
    expect(status(drill).lesson).toMatchObject({ kind: "practice", style: "melee", beat: 15 });
    expect(drill.events("floor-hit")).toEqual([]);
    drill.dispose();
  });
  test("leaving safe floor during count-in resets readiness without damage", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(1);
    await drill.click(MELEE.A);
    drill.tickTo(3);
    expect(status(drill).lesson).toEqual({ kind: "positioning", style: "ranged" });
    drill.tickTo(20);
    expect(drill.events("explosion-marked")).toEqual([]);
    expect(drill.events("floor-hit")).toEqual([]);
    await drill.click(RANGED.A);
    next(drill); next(drill);
    expect(status(drill).lesson).toEqual({ kind: "count-in", style: "ranged", remaining: 5 });
    drill.dispose();
  });
  test("thirty live guide pairs retain two-tick attacks across a readiness break", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(0);
    await drill.click(tile(9, 2));
    await follow(drill, 30);
    expect(status(drill)).toMatchObject({ clean: 30, attempts: 30, safeFloor: true });
    const attacks = drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick);
    expect(attacks).toHaveLength(30);
    for (const group of [attacks.slice(0, 15), attacks.slice(15)]) expect(group.slice(1).map((at, index) => at - group[index])).toEqual(Array(14).fill(2));
    expect(attacks[15] - attacks[14]).toBeGreaterThan(5);
    expect(drill.events("floor-hit")).toEqual([]);
    next(drill);
    expect(status(drill).lesson).toEqual({ kind: "positioning", style: "ranged" });
    drill.dispose();
  });
  test.each(["alternating", "ranged", "melee"] as const)("%s restarts cleanly and keeps markers on valid floor", (mode) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    const initial = mode === "melee" ? MELEE : RANGED;
    expect(drill.player().location).toEqual(initial.A);
    const markers = drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile");
    for (let at = 0; at <= 80; at++) {
      drill.tickTo(at);
      const current = status(drill);
      expect(markers.map((marker) => marker.location)).toEqual([current.tiles.A, current.tiles.B]);
      for (const marker of markers) {
        const { x, y } = marker.location;
        expect(x >= 3 && x <= 7 && y >= 3 && y <= 7).toBe(current.lesson.style === "melee");
        expect(x >= 4 && x <= 6 && y >= 4 && y <= 6).toBe(false);
      }
      if (mode !== "alternating") expect(current.lesson.style).toBe(mode);
    }
    drill.restart();
    expect(drill.player().location).toEqual(initial.A);
    expect(status(drill)).toMatchObject({ clean: 0, attempts: 0, virtualTick: 0 });
    expect(drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile")).toHaveLength(2);
    drill.dispose();
  });
  test.each([
    { mode: "ranged", unsafe: MELEE.A, void: "inner-void" },
    { mode: "melee", unsafe: RANGED.A, void: "outer-void" },
  ] as const)("$mode reports actual phase and damage during active unsafe recovery", async ({ mode, unsafe, void: kind }) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    drill.tickTo(10);
    await drill.click(unsafe);
    drill.tickTo(13);
    expect(status(drill)).toMatchObject({ safeFloor: false, lesson: { kind: "practice", style: mode, beat: 5 }, cue: { kind: "return-to-pair" } });
    expect(drill.events("floor-hit")[0]).toMatchObject({ void: kind, tile: unsafe, receipt: { applied: expect.any(Number) } });
    expect(drill.events("floor-hit")[0].receipt.applied).toBeGreaterThan(0);
    drill.dispose();
  });
  test("an in-flight ranged hit retains historical launch phase during a long wait", () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(33);
    drill.hit(drill.player(), drill.boss(), 40, "range", 20);
    drill.tickTo(70);
    expect(drill.events("player-hit-judged").filter((event) => event.at > 33)).toMatchObject([{ style: "ranged", outcome: "passed" }]);
    expect(status(drill).lesson.kind).toBe("positioning");
    drill.dispose();
  });
  test.each([
    { movement: "one", attack: true, expected: "clean-pair", clean: 1 },
    { movement: "one", attack: false, expected: "dodge-without-attack", clean: 0 },
    { movement: "none", attack: false, expected: "hit", clean: 0 },
    { movement: "two", attack: false, expected: "moved-too-far", clean: 0 },
  ] as const)("real $movement-tile movement gives $expected feedback", async ({ movement, attack, expected, clean }) => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(4);
    if (movement !== "none") await drill.click(movement === "one" ? RANGED.B : tile(7, 2));
    drill.tickTo(5);
    if (attack) await drill.click(UNDER_BOSS);
    drill.tickTo(6);
    expect(status(drill)).toMatchObject({ feedback: expected, clean, attempts: 1 });
    drill.dispose();
  });
  test("ordinary rhythm retains its original spawn and cosmetic floor", async () => {
    const drill = startDrill({ selection: { focus: "rhythm-loop" } });
    expect(drill.player().location).toEqual(MELEE.A);
    drill.tickTo(0);
    await drill.click(RANGED.A);
    drill.tickTo(45);
    expect(drill.events("floor-hit")).toEqual([]);
    expect(drill.region.tutorialStatus()).toBeNull();
    expect(drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile")).toEqual([]);
    drill.dispose();
  });
  test("the introduction explains readiness and offers a mode control without duplicate banner", () => {
    const lesson = loadPage("/?focus=rhythm-loop&tutorial=on&seed=1");
    expect(lesson.element("tutorial_intro").textContent).toContain("The lesson waits");
    expect(lesson.element("rhythm_mode").textContent).toContain("Alternating 15");
    expect(() => lesson.element("rhythm_banner")).toThrow("the page has no #rhythm_banner");
    lesson.close();
    const plain = loadPage("/?focus=rhythm-loop&seed=1");
    expect(() => plain.element("tutorial_intro")).toThrow("the page has no #tutorial_intro");
    expect(plain.element("rhythm_banner").textContent).toContain("Rhythm practice");
    plain.close();
  });
});
