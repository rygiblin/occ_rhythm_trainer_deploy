import { tile } from "../../../sim/brands";
import { UNDER_BOSS, startDrill } from "./drill";
import { captureNavigation, loadPage } from "./page";

type Drill = ReturnType<typeof startDrill>;
const TEACHING = { focus: "rhythm-loop", tutorial: "on" } as const;

function status(drill: Drill) {
  const current = drill.region.tutorialStatus();
  if (!current) throw new Error("no public lesson status");
  return current;
}

async function follow(drill: Drill, target: number) {
  for (let guard = 0; status(drill).clean < target; guard++) {
    if (guard > 200) throw new Error("continuous practice stopped advancing");
    const current = status(drill);
    if (current.cue.kind === "step" || current.cue.kind === "return-to-pair") await drill.click(current.cue.tile);
    if (current.cue.kind === "attack") await drill.click(UNDER_BOSS);
    drill.tickTo((current.tick ?? -1) + 1);
  }
}

describe("continuous teaching sessions", () => {
  test.each(["ranged", "melee"] as const)("%s keeps sixty-five pairs in one uninterrupted phase", async (style) => {
    const drill = startDrill({ selection: { ...TEACHING, lessonMode: "unlimited", rhythmMode: style } });
    await follow(drill, 65);
    expect(status(drill)).toMatchObject({ lessonMode: "unlimited", lesson: { kind: "practice", style, beat: 65, count: null }, attempt: { kind: "running", startedAt: 5, elapsed: 129, survivedImpacts: 65, cleanPairs: 65 } });
    const marks = drill.events("explosion-marked");
    const impacts = drill.events("explosion-resolved");
    expect(marks.map((mark) => mark.pulse)).toEqual(Array.from({ length: 65 }, (_, index) => index));
    expect(impacts.map((impact) => impact.pulse)).toEqual(marks.map((mark) => mark.pulse));
    expect(impacts.every((impact) => impact.outcome.kind === "dodged")).toBe(true);
    const attacks = drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick);
    expect(attacks.slice(1).map((at, index) => at - attacks[index])).toEqual(Array(64).fill(2));
    expect(drill.rows().filter((row) => row.tick >= 5).every((row) => row.phase.stage === (style === "ranged" ? "inner-void" : "outer-void"))).toBe(true);
    expect(drill.events("floor-hit")).toEqual([]);
    drill.dispose();
  });

  test("Unlimited keeps running after a hit and recovers on the next pair", async () => {
    const drill = startDrill({ selection: { ...TEACHING, lessonMode: "unlimited" } });
    drill.tickTo(6);
    expect(status(drill)).toMatchObject({ attempt: { kind: "running", elapsed: 1, survivedImpacts: 0 }, feedback: "hit" });
    await follow(drill, 1);
    expect(status(drill)).toMatchObject({ attempt: { kind: "running", survivedImpacts: 1, cleanPairs: 1 }, recovery: { kind: "recovered" }, lesson: { style: "ranged" } });
    drill.dispose();
  });

  test("Survival stops on the first real impact hit and latches its result", () => {
    const drill = startDrill({ selection: { ...TEACHING, lessonMode: "survival" } });
    drill.tickTo(4);
    expect(status(drill).attempt).toEqual({ kind: "waiting" });
    drill.tickTo(5);
    expect(status(drill).attempt).toMatchObject({ kind: "running", startedAt: 5, elapsed: 0 });
    drill.region.world.startTicking();
    expect(drill.region.world.isPaused).toBe(false);
    drill.tickTo(6);
    const failed = status(drill).attempt;
    expect(failed).toEqual({ kind: "failed", startedAt: 5, endedAt: 6, elapsed: 1, survivedImpacts: 0, cleanPairs: 0 });
    expect(drill.region.world.isPaused).toBe(true);
    expect(status(drill).threat).toEqual({ kind: "none" });
    expect(status(drill).cue.kind).toBe("prepare");
    drill.tickTo(12);
    expect(status(drill).attempt).toEqual(failed);
    drill.restart();
    expect(status(drill)).toMatchObject({ attempt: { kind: "waiting" }, threat: { kind: "none" }, recovery: { kind: "steady" }, virtualTick: 0 });
    expect(drill.region.entities.filter((entity) => entity.constructor.name === "TutorialThreatTile")).toHaveLength(1);
    drill.dispose();
  });

  test.each([
    { destination: tile(6, 2), feedback: "dodge-without-attack" },
    { destination: tile(7, 2), feedback: "moved-too-far" },
  ] as const)("Survival continues after $feedback", async ({ destination, feedback }) => {
    const drill = startDrill({ selection: { ...TEACHING, lessonMode: "survival" } });
    drill.tickTo(4);
    await drill.click(destination);
    drill.tickTo(6);
    expect(status(drill)).toMatchObject({ feedback, attempt: { kind: "running", survivedImpacts: 1, cleanPairs: 0, elapsed: 1 } });
    drill.dispose();
  });

  test("floor-only damage neither ends Survival nor renews its initial grace at pair sixteen", async () => {
    const drill = startDrill({ selection: { ...TEACHING, lessonMode: "survival", rhythmMode: "ranged" } });
    drill.tickTo(4);
    await drill.click(tile(5, 3));
    drill.tickTo(5);
    await drill.click(tile(6, 3));
    drill.tickTo(6);
    for (let at = 6; at < 38; at++) {
      const next = at % 2 === 0 ? tile(drill.player().location.x === 5 ? 6 : 5, 3) : UNDER_BOSS;
      await drill.click(next);
      drill.tickTo(at + 1);
    }
    expect(status(drill).attempt?.kind).toBe("running");
    expect(drill.events("floor-hit").some((event) => event.at === 35)).toBe(true);
    expect(drill.events("floor-hit").some((event) => event.at === 36)).toBe(true);
    expect(drill.events("explosion-resolved").every((event) => event.outcome.kind !== "hit")).toBe(true);
    drill.dispose();
  });

  test("session and style controls preserve the chosen practice link", () => {
    const navigation = captureNavigation();
    const page = loadPage("/?focus=rhythm-loop&tutorial=on&lessonMode=unlimited&rhythmMode=ranged&seed=7");
    expect(page.element("lesson_mode").textContent).toBe("Session: Unlimited");
    expect(page.element("rhythm_mode").textContent).toBe("Style: Ranged");
    page.click("lesson_mode");
    page.click("rhythm_mode");
    page.close();
    navigation.restore();
    expect(new URL(navigation.assigned[0]).searchParams.get("lessonMode")).toBe("survival");
    expect(new URL(navigation.assigned[1]).searchParams.get("rhythmMode")).toBe("melee");
    expect(new URL(navigation.assigned[1]).searchParams.get("lessonMode")).toBe("unlimited");
  });
});
