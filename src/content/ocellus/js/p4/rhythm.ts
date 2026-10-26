import type { Tick, TickSpan } from "../../../../sim/brands";
import { span, tick } from "../../../../sim/brands";
import type { Focus, Script, Slot } from "../../../../sim/schedule";
import { Schedule, slotTable } from "../../../../sim/schedule";
import type { ResolvedChoices, RhythmMode } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Beat, Mechanic, Phase, VoidKind } from "../P4Types";
import { floorRule } from "./floor";
import type { P4Schedule } from "./schedule";

const RECIPE = OCELLUS_P4.rhythm.value;
const ACTIVE = (RECIPE.count - 1) * RECIPE.period + RECIPE.impactAfterMark + 1;
const SECTION = RECIPE.prepare + ACTIVE;
const STYLES = { "inner-void": "ranged", "outer-void": "melee" } as const;

type SectionStyle = Readonly<{ void: VoidKind; style: "ranged" | "melee" }>;
export type RhythmSection = SectionStyle & (
  | Readonly<{ kind: "prepare"; remaining: TickSpan }>
  | Readonly<{ kind: "practice"; beat: number; count: number }>
);

export function rhythmSectionAt(at: Tick, mode: RhythmMode = OCELLUS_P4.choices.rhythmMode.default): RhythmSection {
  const order = OCELLUS_P4.choices.rhythmMode.options[mode].value;
  const kind = order[Math.floor(at / SECTION) % order.length];
  const within = at % SECTION;
  const style = STYLES[kind];
  return within < RECIPE.prepare
    ? { kind: "prepare", void: kind, style, remaining: span(RECIPE.prepare - within) }
    : { kind: "practice", void: kind, style, beat: Math.floor((within - RECIPE.prepare) / RECIPE.period) + 1, count: RECIPE.count };
}

export function compileRhythmSchedule(choices: ResolvedChoices): P4Schedule {
  const length = SECTION * choices.rhythmMode.option.value.length;
  const slots = Array.from({ length }, (_, offset): Slot<Phase, Beat> => {
    const section = rhythmSectionAt(tick(offset), choices.rhythmMode.key);
    const within = offset % SECTION;
    const beats: Beat[] = [];
    if (within === RECIPE.prepare - OCELLUS_P4.explosion.seriesStartsAfterHit.value) beats.push({ kind: "explosion-series-starts", void: section.void });
    if (section.kind === "practice") {
      const active = within - RECIPE.prepare;
      const pulse = Math.floor(active / RECIPE.period);
      if (active % RECIPE.period === 0) beats.push({ kind: "explosion-mark", void: section.void, pulse });
      if (active % RECIPE.period === RECIPE.impactAfterMark) beats.push({ kind: "explosion-impact", void: section.void, pulse });
      beats.push({ kind: "explosions-occurring", void: section.void });
      const floor = floorRule(section.void, choices);
      if (choices.tutorial.option.value && floor.kind === "damages" && active >= floor.afterOnset) beats.push({ kind: "floor-damage", void: section.void });
    }
    return {
      phase: (cycle): Phase => {
        if (section.kind === "prepare") return { stage: section.style === "ranged" ? "after-outer" : "after-inner", cycle, boss: "present-damageable", overhead: null };
        return section.void === "inner-void"
          ? { stage: "inner-void", cycle, boss: "present-out-of-melee-reach", overhead: "deflect-melee" }
          : { stage: "outer-void", cycle, boss: "present-damageable", overhead: "deflect-range" };
      },
      beats: beats.map((beat) => () => beat),
    };
  });
  const table = slotTable(slots, "rhythm cycle");
  const script: Script<"lead-in" | "cycle", Phase, Beat> = {
    first: "cycle",
    stages: {
      "lead-in": { slots: table, breakable: false, then: () => "cycle" },
      cycle: { slots: table, breakable: false, then: () => "cycle" },
    },
    breakpoints: [],
  };
  const focus: Focus<Mechanic> = choices.tutorial.option.value
    ? { kind: "drill", mechanics: ["explosions", "void-floor"] }
    : choices.focus.option.value;
  return new Schedule(script, (beat) => beat.kind === "floor-damage" ? "void-floor" : "explosions", focus, { kind: "cycle-start" }, tick(length));
}
