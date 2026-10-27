import type { Tick, TickSpan } from "../../../../sim/brands";
import { cycle, span, tick } from "../../../../sim/brands";
import type { Focus, Script, Slot } from "../../../../sim/schedule";
import { Schedule, slotTable } from "../../../../sim/schedule";
import type { LessonMode, ResolvedChoices, RhythmMode } from "../OcellusTimings";
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
  | Readonly<{ kind: "practice"; beat: number; count: number | null }>
);

export function lessonModeOf(choices: ResolvedChoices): LessonMode {
  return choices.focus.key === "rhythm-loop" && choices.tutorial.option.value ? choices.lessonMode.key : "sets";
}

export function rhythmSectionAt(at: Tick, mode: RhythmMode = OCELLUS_P4.choices.rhythmMode.default, lessonMode: LessonMode = "sets"): RhythmSection {
  const order = OCELLUS_P4.choices.rhythmMode.options[mode].value;
  if (lessonMode !== "sets") {
    const kind = order[0];
    return at < RECIPE.prepare
      ? { kind: "prepare", void: kind, style: STYLES[kind], remaining: span(RECIPE.prepare - at) }
      : { kind: "practice", void: kind, style: STYLES[kind], beat: Math.floor((at - RECIPE.prepare) / RECIPE.period) + 1, count: null };
  }
  const kind = order[Math.floor(at / SECTION) % order.length];
  const within = at % SECTION;
  const style = STYLES[kind];
  return within < RECIPE.prepare
    ? { kind: "prepare", void: kind, style, remaining: span(RECIPE.prepare - within) }
    : { kind: "practice", void: kind, style, beat: Math.floor((within - RECIPE.prepare) / RECIPE.period) + 1, count: RECIPE.count };
}

export function compileRhythmSchedule(choices: ResolvedChoices): P4Schedule {
  if (lessonModeOf(choices) !== "sets") return continuousSchedule(choices);
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

function continuousSchedule(choices: ResolvedChoices): P4Schedule {
  const kind = choices.rhythmMode.option.value[0];
  const style = STYLES[kind];
  const neutral: Phase = { stage: style === "ranged" ? "after-outer" : "after-inner", cycle: cycle(1), boss: "present-damageable", overhead: null };
  const prepare = slotTable(Array.from({ length: RECIPE.prepare }, (_, offset): Slot<Phase, Beat> => ({
    phase: () => neutral,
    beats: offset === RECIPE.prepare - OCELLUS_P4.explosion.seriesStartsAfterHit.value ? [() => ({ kind: "explosion-series-starts", void: kind })] : [],
  })), "continuous count-in");
  const floor = floorRule(kind, choices);
  const active = slotTable(Array.from({ length: RECIPE.period }, (_, offset): Slot<Phase, Beat> => ({
    phase: (cycle): Phase => kind === "inner-void"
      ? { stage: kind, cycle, boss: "present-out-of-melee-reach", overhead: "deflect-melee" }
      : { stage: kind, cycle, boss: "present-damageable", overhead: "deflect-range" },
    beats: [
      (visit) => offset === 0 ? { kind: "explosion-mark", void: kind, pulse: visit - 1 } : null,
      (visit) => offset === RECIPE.impactAfterMark ? { kind: "explosion-impact", void: kind, pulse: visit - 1 } : null,
      () => ({ kind: "explosions-occurring", void: kind }),
      (_visit, start) => floor.kind === "damages" && start + offset - RECIPE.prepare >= floor.afterOnset ? { kind: "floor-damage", void: kind } : null,
    ],
  })), "continuous rhythm");
  const script: Script<"lead-in" | "cycle", Phase, Beat> = {
    first: "lead-in",
    stages: {
      "lead-in": { slots: prepare, breakable: false, then: () => "cycle" },
      cycle: { slots: active, breakable: false, then: () => "cycle" },
    },
    breakpoints: [],
  };
  return new Schedule(script, (beat) => beat.kind === "floor-damage" ? "void-floor" : "explosions", { kind: "drill", mechanics: ["explosions", "void-floor"] }, { kind: "cycle-start" }, tick(RECIPE.prepare + RECIPE.period));
}
