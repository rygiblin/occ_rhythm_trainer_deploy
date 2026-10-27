import type { ResolvedChoices } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Seed, Tick, Tile } from "../../../../sim/brands";
import type { HitReceipt } from "../../../../sim/combat";
import { cutAttackDelay } from "../../../../sim/combat";
import type { AttackDelayCut, HitRequest, Logged } from "../../../../sim/sdk/EncounterBinding";
import type { Beat, FightEvent, PlayerHit, VoidKind } from "../P4Types";
import { reach } from "../../../../sim/tiles";
import { FOOTPRINT } from "./floor";
import { rollInt } from "../roll";

type Mark = Readonly<{ void: VoidKind; pulse: number; tile: Tile; markedAt: Tick }>;
type Impact = Extract<PlayerHit, { kind: "explosion-resolved" }>;

export type Marks = readonly Mark[];
export type ExplosionBeat = Extract<Beat, { kind: "explosion-series-starts" | "explosion-mark" | "explosion-impact" | "explosions-occurring" }>;
export type ExplosionStep = Readonly<{ marks: Marks; outputs: readonly (Logged<FightEvent> | HitRequest<PlayerHit> | AttackDelayCut)[] }>;
export type ExplosionRules = Readonly<{ seed: Seed; choices: ResolvedChoices }>;
export type Reduction = Readonly<{ outcome: "passed" }> | Readonly<{ outcome: "reduced"; percentLess: number }>;

export const NO_MARKS: Marks = [];

const { radius, attackDelayCut } = OCELLUS_P4.explosion.dodge.value;

function detonate({ seed, choices }: ExplosionRules, marks: Marks, kind: VoidKind, pulse: number, at: Tick, player: Readonly<{ tile: Tile; attackDelay: number }>): ExplosionStep {
  const mark = marks.find((pending) => pending.void === kind && pending.pulse === pulse);
  if (!mark) return { marks, outputs: [] };
  const left = marks.filter((pending) => pending !== mark);
  const impact: Impact = { kind: "explosion-resolved", at, void: kind, pulse, tile: mark.tile, underBoss: FOOTPRINT.contains(mark.tile) };
  const distance = reach(mark.tile, player.tile);
  if (distance > radius) return { marks: left, outputs: [{ kind: "event", event: { ...impact, outcome: { kind: "avoided" } } }] };
  if (distance > 0) {
    const attackDelay = { before: player.attackDelay, after: cutAttackDelay(player.attackDelay, attackDelayCut) };
    return { marks: left, outputs: [{ kind: "cut-attack-delay", by: attackDelayCut }, { kind: "event", event: { ...impact, outcome: { kind: "dodged", attackDelay } } }] };
  }
  const damage = rollInt(seed, "explosionDamage", at, choices.explosions.option.value.damage, 0);
  return { marks: left, outputs: [{ kind: "hit", damage: { kind: "fixed", amount: damage }, cause: impact }] };
}

export function explode(rules: ExplosionRules, marks: Marks, beat: ExplosionBeat, at: Tick, player: Readonly<{ tile: Tile; attackDelay: number }>): ExplosionStep {
  switch (beat.kind) {
    case "explosion-series-starts":
      return { marks, outputs: [{ kind: "event", event: { kind: "explosion-series-started", at, void: beat.void } }] };
    case "explosion-mark":
      return {
        marks: [...marks, { void: beat.void, pulse: beat.pulse, tile: player.tile, markedAt: at }],
        outputs: [{ kind: "event", event: { kind: "explosion-marked", at, void: beat.void, pulse: beat.pulse, tile: player.tile } }],
      };
    case "explosion-impact":
      return detonate(rules, marks, beat.void, beat.pulse, at, player);
    case "explosions-occurring":
      return { marks, outputs: [] };
    default: {
      const unhandled: never = beat;
      return unhandled;
    }
  }
}

export function explosionHit(impact: Impact, receipt: HitReceipt): FightEvent {
  return { ...impact, outcome: { kind: "hit", receipt } };
}

export function damageReduction(choices: ResolvedChoices, beats: readonly Beat[]): Reduction {
  if (!beats.some((beat) => beat.kind === "explosions-occurring")) return { outcome: "passed" };
  return { outcome: "reduced", percentLess: choices.explosionDamageReduction.option.value };
}
