import { tile } from "../../../sim/brands";
import { UNDER_BOSS, startDrill } from "./drill";
import { loadPage } from "./page";

const A = tile(5, 2);
const B = tile(6, 2);
const MELEE = { A: tile(5, 3), B: tile(6, 3) };
const RANGED = { A, B };
const TEACHING = { focus: "rhythm-loop", tutorial: "on" } as const;

describe("guided rhythm cues", () => {
  test("cues describe the next tick, including the final pair and the next style", async () => {
    const drill = startDrill({ selection: TEACHING });
    const observed = [];
    for (const at of [3, 4, 5, 6, 33, 34, 35, 36, 38, 39, 40, 41, 69, 70]) {
      drill.tickTo(at);
      const cue = drill.region.tutorialStatus()?.cue;
      if (!cue) throw new Error(`no teaching cue at ${at}`);
      observed.push([at, cue.kind, cue.style, cue.kind === "step" ? cue.target : null]);
      if (at === 4) await drill.click(B);
      if (at === 35) await drill.click(MELEE.A);
      if (at === 39) await drill.click(MELEE.B);
    }
    drill.dispose();
    expect(observed).toEqual([
      [3, "prepare", "ranged", null],
      [4, "step", "ranged", "B"],
      [5, "attack", "ranged", null],
      [6, "step", "ranged", "B"],
      [33, "attack", "ranged", null],
      [34, "prepare", "melee", null],
      [35, "return-to-pair", "melee", null],
      [36, "prepare", "melee", null],
      [38, "prepare", "melee", null],
      [39, "step", "melee", "B"],
      [40, "attack", "melee", null],
      [41, "step", "melee", "B"],
      [69, "prepare", "ranged", null],
      [70, "return-to-pair", "ranged", null],
    ]);
  });

  test.each(["ranged", "melee"] as const)("%s-only keeps the same cue style over a set boundary", (mode) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    const styles = [4, 5, 33, 34, 39, 40, 41].map((at) => {
      drill.tickTo(at);
      return drill.region.tutorialStatus()?.cue.style;
    });
    drill.dispose();
    expect(styles).toEqual(Array(7).fill(mode));
  });

  test.each([
    { mode: "ranged", here: tile(9, 3), step: tile(10, 3) },
    { mode: "ranged", here: tile(3, 2), step: tile(4, 2) },
    { mode: "melee", here: tile(3, 3), step: tile(4, 3) },
    { mode: "melee", here: tile(7, 3), step: tile(6, 3) },
  ] as const)("$mode follows a safe manual position $here with a real adjacent dodge and attack", async ({ mode, here, step }) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    drill.tickTo(0);
    await drill.click(here);
    drill.tickTo(4);
    expect(drill.player().location).toEqual(here);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles: { A: here, B: step }, safeFloor: true, cue: { kind: "step", style: mode, beat: 1, target: "B", tile: step } });
    expect(drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile").map((marker) => marker.location)).toEqual([here, step]);
    await drill.click(step);
    drill.tickTo(5);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles: { A: step }, cue: { kind: "attack" } });
    await drill.click(UNDER_BOSS);
    drill.tickTo(6);
    expect(drill.region.tutorialStatus()).toMatchObject({ clean: 1, feedback: "clean-pair", safeFloor: true });
    expect(drill.events("floor-hit")).toEqual([]);
    drill.dispose();
  });

  test("style changes position near the actual player only after the current floor clears", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(0);
    await drill.click(tile(9, 3));
    drill.tickTo(34);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles: { A: tile(9, 3), B: tile(10, 3) }, cue: { kind: "prepare" } });
    drill.tickTo(35);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles: { A: tile(7, 3), B: tile(6, 3) }, cue: { kind: "return-to-pair", style: "melee", tile: tile(7, 3) } });
    await drill.click(tile(7, 3));
    drill.tickTo(36);
    expect(drill.player().location).toEqual(tile(7, 3));
    drill.tickTo(69);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles: { A: tile(7, 3), B: tile(6, 3) }, cue: { kind: "prepare" } });
    drill.tickTo(70);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles: { A: tile(7, 2), B: tile(8, 2) }, cue: { kind: "return-to-pair", style: "ranged", tile: tile(7, 2) } });
    await drill.click(tile(7, 2));
    drill.tickTo(71);
    expect(drill.player().location).toEqual(tile(7, 2));
    expect(drill.events("floor-hit")).toEqual([]);
    drill.dispose();
  });

  test("tutorial markers exist only for opted-in rhythm practice", () => {
    for (const selection of [{ focus: "rhythm-loop" }, TEACHING, { focus: "explosions", tutorial: "on" }] as const) {
      const drill = startDrill({ selection });
      const markers = drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile");
      expect(markers.map((marker) => marker.location)).toEqual(selection === TEACHING ? [A, B] : []);
      expect(drill.region.tutorialEnabled()).toBe(selection === TEACHING);
      drill.dispose();
    }
  });

  test.each([
    { movement: "one", attack: true, expected: "clean-pair", clean: 1 },
    { movement: "one", attack: false, expected: "dodge-without-attack", clean: 0 },
    { movement: "none", attack: false, expected: "hit", clean: 0 },
    { movement: "two", attack: false, expected: "moved-too-far", clean: 0 },
  ] as const)("real $movement-tile movement with attack=$attack gives $expected feedback", async ({ movement, attack, expected, clean }) => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(4);
    expect(drill.region.tutorialStatus()?.cue).toEqual({ kind: "step", style: "ranged", beat: 1, target: "B", tile: B });
    if (movement !== "none") await drill.click(movement === "one" ? B : tile(7, 2));
    drill.tickTo(5);
    if (attack) await drill.click(UNDER_BOSS);
    drill.tickTo(6);
    expect(drill.region.tutorialStatus()).toMatchObject({ feedback: expected, clean, attempts: 1, tick: 6 });
    drill.dispose();
  });

  test("following the live guide gives thirty real two-tick attacks across the odd-count style switch", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(0);
    await drill.click(tile(9, 2));
    for (const mark of [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68]) {
      if (mark === 40) {
        drill.tickTo(35);
        const position = drill.region.tutorialStatus()?.cue;
        expect(position).toEqual({ kind: "return-to-pair", style: "melee", target: "A", tile: tile(7, 3) });
        if (position?.kind !== "return-to-pair") throw new Error("no melee positioning cue");
        await drill.click(position.tile);
        drill.tickTo(38);
      }
      drill.tickTo(mark - 1);
      const cue = drill.region.tutorialStatus()?.cue;
      if (cue?.kind !== "step") throw new Error(`expected a step cue before mark ${mark}`);
      await drill.click(cue.tile);
      drill.tickTo(mark);
      expect(drill.region.tutorialStatus()?.cue.kind).toBe("attack");
      await drill.click(UNDER_BOSS);
      drill.tickTo(mark + 1);
      expect(drill.region.tutorialStatus()?.feedback).toBe("clean-pair");
      expect(drill.region.tutorialStatus()?.safeFloor).toBe(true);
    }
    expect(drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick)).toEqual([6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69]);
    expect(drill.region.tutorialStatus()).toMatchObject({ clean: 30, attempts: 30 });
    expect(drill.events("floor-hit")).toEqual([]);
    drill.tickTo(70);
    const position = drill.region.tutorialStatus()?.cue;
    expect(position).toEqual({ kind: "return-to-pair", style: "ranged", target: "A", tile: tile(6, 2) });
    if (position?.kind !== "return-to-pair") throw new Error("no ranged positioning cue");
    await drill.click(position.tile);
    drill.tickTo(71);
    expect(drill.region.tutorialStatus()?.safeFloor).toBe(true);
    expect(drill.events("floor-hit")).toEqual([]);
    drill.dispose();
  });

  test.each([
    { mode: "alternating", tiles: RANGED },
    { mode: "ranged", tiles: RANGED },
    { mode: "melee", tiles: MELEE },
  ] as const)("$mode starts and restarts on the first style's safe A", ({ mode, tiles }) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    expect(drill.player().location).toEqual(tiles.A);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles, safeFloor: true, clean: 0, attempts: 0 });
    drill.tickTo(40);
    drill.restart();
    expect(drill.player().location).toEqual(tiles.A);
    expect(drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile").map((marker) => marker.location)).toEqual([tiles.A, tiles.B]);
    expect(drill.region.tutorialStatus()).toMatchObject({ tiles, safeFloor: true, clean: 0, attempts: 0 });
    drill.dispose();
  });

  test.each(["alternating", "ranged", "melee"] as const)("%s markers stay on the safe floor through every tick and transition", (mode) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    const markers = drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile");
    for (let at = 0; at <= 75; at++) {
      drill.tickTo(at);
      const status = drill.region.tutorialStatus();
      if (!status) throw new Error(`no teaching status at ${at}`);
      const style = mode === "alternating" ? (Math.floor(at / 35) % 2 === 0 ? "ranged" : "melee") : mode;
      const expected = style === "ranged" ? RANGED : MELEE;
      expect(status.tiles).toEqual(expected);
      expect(markers.map((marker) => marker.location)).toEqual([expected.A, expected.B]);
      expect(drill.region.entities.filter((entity) => entity.constructor.name === "TutorialTile")).toEqual(markers);
      const phase = drill.row(at).phase.stage;
      for (const marker of markers) {
        const { x, y } = marker.location;
        const inCentralSquare = x >= 3 && x <= 7 && y >= 3 && y <= 7;
        if (phase === "inner-void") expect(inCentralSquare).toBe(false);
        if (phase === "outer-void") expect(inCentralSquare).toBe(true);
        expect(x >= 4 && x <= 6 && y >= 4 && y <= 6).toBe(false);
      }
      if (mode !== "alternating" && [35, 70].includes(at)) expect(status.cue.kind).toBe("prepare");
    }
    drill.dispose();
  });

  test.each([
    { mode: "ranged", unsafe: MELEE.A, void: "inner-void", firstHit: 7 },
    { mode: "melee", unsafe: A, void: "outer-void", firstHit: 10 },
  ] as const)("%s teaching applies real floor damage on the unsafe side", async ({ mode, unsafe, void: kind, firstHit }) => {
    const drill = startDrill({ selection: { ...TEACHING, rhythmMode: mode } });
    drill.tickTo(0);
    await drill.click(unsafe);
    drill.tickTo(firstHit);
    expect(drill.region.tutorialStatus()?.safeFloor).toBe(false);
    expect(drill.region.tutorialStatus()?.cue.kind).toBe("return-to-pair");
    expect(drill.events("floor-hit")).toMatchObject([{ at: firstHit, void: kind, tile: unsafe, receipt: { applied: expect.any(Number) } }]);
    expect(drill.events("floor-hit")[0].receipt.applied).toBeGreaterThan(0);
    drill.dispose();
  });

  test("ordinary rhythm keeps its original spawn and cosmetic floor", async () => {
    const drill = startDrill({ selection: { focus: "rhythm-loop" } });
    expect(drill.player().location).toEqual(MELEE.A);
    drill.tickTo(0);
    await drill.click(A);
    drill.tickTo(45);
    expect(drill.events("floor-hit")).toEqual([]);
    expect(drill.region.tutorialStatus()).toBeNull();
    drill.dispose();
  });

  test("the tutorial opens with a start instruction while ordinary practice has no intro", () => {
    const lesson = loadPage("/?focus=rhythm-loop&tutorial=on&seed=1");
    expect(lesson.element("tutorial_intro").textContent).toContain("Learn the two-tick rhythm");
    expect(lesson.element("tutorial_start").textContent).toContain("practice");
    lesson.close();
    const plain = loadPage("/?focus=rhythm-loop&seed=1");
    expect(() => plain.element("tutorial_intro")).toThrow("the page has no #tutorial_intro");
    plain.close();
  });
});
