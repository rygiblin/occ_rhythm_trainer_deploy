import type { Tick, TickSpan, Tile } from "../../../../sim/brands";
import { tick } from "../../../../sim/brands";
import type { RhythmMode } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { TickRow } from "../P4Types";
import { rhythmSectionAt } from "./rhythm";

export type TeachingTile = keyof typeof OCELLUS_P4.teaching.value.tiles;
type Style = "ranged" | "melee";
export type TutorialCue =
  | Readonly<{ kind: "prepare"; style: Style; remaining: TickSpan }>
  | Readonly<{ kind: "step"; style: Style; beat: number; target: TeachingTile; tile: Tile }>
  | Readonly<{ kind: "attack"; style: Style; beat: number }>
  | Readonly<{ kind: "return-to-pair"; style: Style; target: "A"; tile: Tile }>;
export type TutorialFeedback = "clean-pair" | "dodge-without-attack" | "hit" | "moved-too-far";
export type TutorialStatus = Readonly<{ cue: TutorialCue; feedback: TutorialFeedback | null; clean: number; attempts: number; tick: Tick | null }>;

const TILES = OCELLUS_P4.teaching.value.tiles;
export const sameTile = (left: Tile, right: Tile): boolean => left.x === right.x && left.y === right.y;

export function tutorialCue(at: Tick | null, player: Tile, mode: RhythmMode): TutorialCue {
  const current = rhythmSectionAt(at ?? tick(0), mode);
  if (!sameTile(player, TILES.A) && !sameTile(player, TILES.B)) return { kind: "return-to-pair", style: current.style, target: "A", tile: TILES.A };
  if (at === null) return { kind: "prepare", style: current.style, remaining: OCELLUS_P4.rhythm.value.prepare };
  const next = rhythmSectionAt(tick(at + 1), mode);
  if (next.kind === "prepare") return { kind: "prepare", style: next.style, remaining: next.remaining };
  if (current.kind === "prepare" || current.beat !== next.beat) {
    const target = sameTile(player, TILES.A) ? "B" : "A";
    return { kind: "step", style: next.style, beat: next.beat, target, tile: TILES[target] };
  }
  return { kind: "attack", style: next.style, beat: next.beat };
}

export function tutorialFeedback(row: TickRow): TutorialFeedback | null {
  const impact = row.events.find((event) => event.kind === "explosion-resolved");
  if (!impact || impact.kind !== "explosion-resolved") return null;
  switch (impact.outcome.kind) {
    case "dodged": return row.combatDraws > 0 ? "clean-pair" : "dodge-without-attack";
    case "hit": return "hit";
    case "avoided": return "moved-too-far";
    default: {
      const unhandled: never = impact.outcome;
      return unhandled;
    }
  }
}
