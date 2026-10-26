import type { At } from "./drill";
import { RING_NORTH, UNDER_BOSS, startDrill } from "./drill";

const RHYTHM = { focus: "rhythm-loop" } as const;
const BESIDE: At = { x: 6, y: 3 };
const TWO_AWAY: At = { x: 7, y: 3 };
const RANGED_MARKS = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33] as const;
const MELEE_MARKS = [40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68] as const;
type Drill = ReturnType<typeof startDrill>;

async function dodgeSet(drill: Drill, marks: readonly number[], side: At): Promise<void> {
  for (const mark of marks) {
    drill.tickTo(mark - 1);
    await drill.click(drill.player().location.x === RING_NORTH.x ? side : RING_NORTH);
    drill.tickTo(mark);
    await drill.click(UNDER_BOSS);
  }
  drill.tickTo(marks[marks.length - 1] + 1);
}

const attacks = (drill: Drill) => drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick);

describe("rhythm practice", () => {
  test.each([
    { mode: "ranged", style: "inner-void", weapon: 20997, preparation: "after-outer" },
    { mode: "melee", style: "outer-void", weapon: 22325, preparation: "after-inner" },
  ] as const)("$mode-only repeats the selected style, floor and gear after each preparation window", ({ mode, style, weapon, preparation }) => {
    const drill = startDrill({ selection: { ...RHYTHM, rhythmMode: mode } });
    expect(drill.region.snapshot()?.player.equipped.weapon).toBe(weapon);
    const observed = [];
    for (const at of [0, 5, 34, 35, 40, 69, 70]) {
      drill.tickTo(at);
      observed.push([at, drill.row(at).phase.stage, drill.region.snapshot()?.player.equipped.weapon, drill.region.rhythmStatus()?.kind]);
    }
    expect(observed).toEqual([
      [0, preparation, weapon, "prepare"], [5, style, weapon, "practice"], [34, style, weapon, "practice"],
      [35, preparation, weapon, "prepare"], [40, style, weapon, "practice"], [69, style, weapon, "practice"],
      [70, preparation, weapon, "prepare"],
    ]);
    expect(drill.events("explosion-resolved").map((event) => [event.at, event.void, event.pulse])).toEqual([
      ...[6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34].map((at, pulse) => [at, style, pulse]),
      ...[41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69].map((at, pulse) => [at, style, pulse]),
    ]);
    drill.restart();
    drill.tickTo(0);
    expect(drill.region.snapshot()?.player.equipped.weapon).toBe(weapon);
    expect(drill.row(0).phase.stage).toBe(preparation);
    drill.dispose();
  });

  test.each(["ranged", "melee"] as const)("$mode-only preserves two-tick attacks through repeated fifteen-beat sets", async (rhythmMode) => {
    const drill = startDrill({ selection: { ...RHYTHM, rhythmMode } });
    await dodgeSet(drill, RANGED_MARKS, BESIDE);
    await dodgeSet(drill, MELEE_MARKS, BESIDE);
    expect(attacks(drill)).toEqual([6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69]);
    expect(drill.events("explosion-resolved").map((event) => event.outcome.kind)).toEqual(Array(30).fill("dodged"));
    drill.dispose();
  });

  test("fifteen ranged and fifteen melee beats repeat with neutral preparation and automatic gear", () => {
    const drill = startDrill({ selection: { ...RHYTHM, setup: "melee" } });
    expect(drill.player().location).toEqual(RING_NORTH);
    const observed = [];
    for (const at of [0, 5, 34, 35, 40, 69, 70, 75, 104, 105, 110, 139]) {
      drill.tickTo(at);
      observed.push([at, drill.row(at).phase.stage, drill.region.snapshot()?.player.equipped.weapon, drill.region.rhythmStatus()?.kind]);
    }
    expect(observed).toEqual([
      [0, "after-outer", 20997, "prepare"], [5, "inner-void", 20997, "practice"], [34, "inner-void", 20997, "practice"],
      [35, "after-inner", 22325, "prepare"], [40, "outer-void", 22325, "practice"], [69, "outer-void", 22325, "practice"],
      [70, "after-outer", 20997, "prepare"], [75, "inner-void", 20997, "practice"], [104, "inner-void", 20997, "practice"],
      [105, "after-inner", 22325, "prepare"], [110, "outer-void", 22325, "practice"], [139, "outer-void", 22325, "practice"],
    ]);
    expect(drill.events("explosion-resolved").map((event) => [event.at, event.void, event.pulse])).toEqual([
      ...[6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34].map((at, pulse) => [at, "inner-void", pulse]),
      ...[41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69].map((at, pulse) => [at, "outer-void", pulse]),
      ...[76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104].map((at, pulse) => [at, "inner-void", pulse]),
      ...[111, 113, 115, 117, 119, 121, 123, 125, 127, 129, 131, 133, 135, 137, 139].map((at, pulse) => [at, "outer-void", pulse]),
    ]);
    expect([...new Set(drill.rows().flatMap((row) => row.beats.map((beat) => beat.kind)))]).toEqual([
      "explosion-series-starts", "explosion-mark", "explosions-occurring", "explosion-impact",
    ]);
    drill.dispose();
  });

  test("one-tile dodges give fifteen two-tick bow shots and fifteen two-tick scythe swings", async () => {
    const drill = startDrill({ selection: RHYTHM });
    await dodgeSet(drill, RANGED_MARKS, BESIDE);
    await dodgeSet(drill, MELEE_MARKS, BESIDE);
    expect(attacks(drill)).toEqual([6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69]);
    expect(drill.events("explosion-resolved").map((event) => event.outcome.kind)).toEqual(Array(30).fill("dodged"));
    drill.dispose();
  });

  test("attacks stay blocked during the preparation gap even with Ocellus targeted", async () => {
    const drill = startDrill({ selection: RHYTHM });
    drill.tickTo(0);
    await drill.click(UNDER_BOSS);
    drill.tickTo(4);
    expect(attacks(drill)).toEqual([]);
    drill.tickTo(35);
    expect(attacks(drill)).toEqual([5, 10, 15, 20, 25, 30]);
    drill.tickTo(39);
    expect(attacks(drill)).toEqual([5, 10, 15, 20, 25, 30]);
    drill.dispose();
  });

  test("standing still gets hit and retains ordinary attack timing", async () => {
    const drill = startDrill({ selection: RHYTHM });
    drill.tickTo(0);
    await drill.click(UNDER_BOSS);
    drill.tickTo(34);
    expect(attacks(drill)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(drill.events("explosion-resolved").map((event) => event.outcome.kind)).toEqual(Array(15).fill("hit"));
    drill.dispose();
  });

  test("moving two tiles avoids ranged explosions without the two-tick attack reward", async () => {
    const drill = startDrill({ selection: RHYTHM });
    await dodgeSet(drill, RANGED_MARKS, TWO_AWAY);
    expect(attacks(drill)).toEqual([6, 12, 18, 24, 30]);
    expect(drill.events("explosion-resolved").map((event) => event.outcome.kind)).toEqual(Array(15).fill("avoided"));
    drill.dispose();
  });

  test("practice survives mistakes and lethal boss hits, and restart returns to ranged preparation", async () => {
    const drill = startDrill({ selection: RHYTHM, bossHp: 1 });
    drill.region.invincible = false;
    drill.tickTo(0);
    await drill.click(UNDER_BOSS);
    drill.tickTo(160);
    expect(drill.region.invincible).toBe(true);
    expect(drill.events("death-prevented").length).toBeGreaterThan(0);
    expect(drill.events("run-ended")).toEqual([]);
    expect(drill.region.snapshot()?.boss.hp).toBe(1);
    expect(drill.region.snapshot()?.run.kind).toBe("running");
    drill.restart();
    drill.tickTo(0);
    expect(drill.region.snapshot()?.player.equipped.weapon).toBe(20997);
    expect(drill.region.rhythmStatus()).toEqual({ kind: "prepare", void: "inner-void", style: "ranged", remaining: 5 });
    drill.dispose();
  });
});
