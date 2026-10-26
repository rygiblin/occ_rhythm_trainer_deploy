import type { Tick, TickSpan, Tile } from "../../../../sim/brands";
import { tick } from "../../../../sim/brands";
import { beside } from "../../../../sim/tiles";
import type { RhythmMode } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { TickRow } from "../P4Types";
import { rhythmSectionAt } from "./rhythm";
import { FOOTPRINT, PLATFORM, VOID_MASKS } from "./floor";

type Style = "ranged" | "melee";
export type TeachingPair = Readonly<{ A: Tile; B: Tile }>;
export type TeachingTile = keyof TeachingPair;
export type TutorialCue =
  | Readonly<{ kind: "prepare"; style: Style; remaining: TickSpan }>
  | Readonly<{ kind: "step"; style: Style; beat: number; target: TeachingTile; tile: Tile }>
  | Readonly<{ kind: "attack"; style: Style; beat: number }>
  | Readonly<{ kind: "return-to-pair"; style: Style; target: "A"; tile: Tile }>;
export type TutorialFeedback = "clean-pair" | "dodge-without-attack" | "hit" | "moved-too-far";
export type TutorialStatus = Readonly<{ cue: TutorialCue; tiles: TeachingPair; safeFloor: boolean; feedback: TutorialFeedback | null; clean: number; attempts: number; tick: Tick | null }>;
export type TutorialGuide = Readonly<{ cue: TutorialCue; tiles: TeachingPair }>;

export const sameTile = (left: Tile, right: Tile): boolean => left.x === right.x && left.y === right.y;

function teachingTilesAt(at: Tick | null, player: Tile, mode: RhythmMode, holes: readonly Tile[]): TeachingPair {
  const section = rhythmSectionAt(at ?? tick(0), mode);
  const safe = (at: Tile): boolean => PLATFORM.contains(at) && !FOOTPRINT.contains(at) && !VOID_MASKS[section.void].contains(at) && !holes.some((hole) => sameTile(at, hole));
  const pairAt = (anchor: Tile): TeachingPair | null => {
    if (!safe(anchor)) return null;
    const horizontal = anchor.x % 2 === 1 ? "east" : "west";
    const neighbors = [beside(anchor, horizontal), beside(anchor, horizontal === "east" ? "west" : "east"), beside(anchor, "north"), beside(anchor, "south")];
    const step = neighbors.find(safe);
    return step ? { A: anchor, B: step } : null;
  };
  const here = pairAt(player);
  if (here) return here;
  const distance = (at: Tile): number => Math.abs(at.x - player.x) + Math.abs(at.y - player.y);
  const candidates = [...PLATFORM.tiles()].sort((left, right) => distance(left) - distance(right) || left.y - right.y || left.x - right.x);
  for (const candidate of candidates) {
    const pair = pairAt(candidate);
    if (pair) return pair;
  }
  throw new RangeError(`the ${section.style} tutorial has no safe neighboring tiles`);
}

export function tutorialGuide(at: Tick | null, player: Tile, mode: RhythmMode, holes: readonly Tile[]): TutorialGuide {
  const current = rhythmSectionAt(at ?? tick(0), mode);
  const tiles = teachingTilesAt(at, player, mode, holes);
  if (!sameTile(player, tiles.A)) return { tiles, cue: { kind: "return-to-pair", style: current.style, target: "A", tile: tiles.A } };
  if (at === null) return { tiles, cue: { kind: "prepare", style: current.style, remaining: OCELLUS_P4.rhythm.value.prepare } };
  const next = rhythmSectionAt(tick(at + 1), mode);
  if (next.kind === "prepare") return { tiles, cue: { kind: "prepare", style: next.style, remaining: next.remaining } };
  if (current.kind === "prepare" || current.beat !== next.beat) {
    return { tiles, cue: { kind: "step", style: next.style, beat: next.beat, target: "B", tile: tiles.B } };
  }
  return { tiles, cue: { kind: "attack", style: next.style, beat: next.beat } };
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
