import { tile } from "../../../sim/brands";
import { UNDER_BOSS, startDrill } from "./drill";
import { loadPage } from "./page";

const A = tile(5, 3);
const B = tile(6, 3);
const TEACHING = { focus: "rhythm-loop", tutorial: "on" } as const;

describe("guided rhythm cues", () => {
  test("cues describe the next tick, including the final pair and the next style", async () => {
    const drill = startDrill({ selection: TEACHING });
    const observed = [];
    for (const at of [3, 4, 5, 6, 33, 34, 38, 39, 40, 41]) {
      drill.tickTo(at);
      const cue = drill.region.tutorialStatus()?.cue;
      if (!cue) throw new Error(`no teaching cue at ${at}`);
      observed.push([at, cue.kind, cue.style, cue.kind === "step" ? cue.target : null]);
      if (at === 4) await drill.click(B);
      if (at === 39) await drill.click(A);
    }
    drill.dispose();
    expect(observed).toEqual([
      [3, "prepare", "ranged", null],
      [4, "step", "ranged", "B"],
      [5, "attack", "ranged", null],
      [6, "step", "ranged", "A"],
      [33, "attack", "ranged", null],
      [34, "prepare", "melee", null],
      [38, "prepare", "melee", null],
      [39, "step", "melee", "A"],
      [40, "attack", "melee", null],
      [41, "step", "melee", "B"],
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

  test("a player outside the pair gets recovery rather than a faraway one-tile cue", async () => {
    const drill = startDrill({ selection: TEACHING });
    drill.tickTo(0);
    await drill.click(tile(9, 3));
    drill.tickTo(4);
    expect(drill.region.tutorialStatus()?.cue).toEqual({ kind: "return-to-pair", style: "ranged", target: "A", tile: A });
    await drill.click(B);
    drill.tickTo(39);
    expect(drill.region.tutorialStatus()?.cue).toEqual({ kind: "step", style: "melee", beat: 1, target: "A", tile: A });
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
    if (movement !== "none") await drill.click(movement === "one" ? B : tile(7, 3));
    drill.tickTo(5);
    if (attack) await drill.click(UNDER_BOSS);
    drill.tickTo(6);
    expect(drill.region.tutorialStatus()).toMatchObject({ feedback: expected, clean, attempts: 1, tick: 6 });
    drill.dispose();
  });

  test("following the live guide gives thirty real two-tick attacks across the odd-count style switch", async () => {
    const drill = startDrill({ selection: TEACHING });
    for (const mark of [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68]) {
      drill.tickTo(mark - 1);
      const cue = drill.region.tutorialStatus()?.cue;
      if (cue?.kind !== "step") throw new Error(`expected a step cue before mark ${mark}`);
      await drill.click(cue.tile);
      drill.tickTo(mark);
      expect(drill.region.tutorialStatus()?.cue.kind).toBe("attack");
      await drill.click(UNDER_BOSS);
      drill.tickTo(mark + 1);
      expect(drill.region.tutorialStatus()?.feedback).toBe("clean-pair");
    }
    expect(drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick)).toEqual([6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69]);
    expect(drill.region.tutorialStatus()).toMatchObject({ clean: 30, attempts: 30 });
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
