import type { Tick, TickSpan } from "../../../../sim/brands";
import { span } from "../../../../sim/brands";
import type { LessonMode } from "../OcellusTimings";
import type { TickRow } from "../P4Types";
import { tutorialFeedback } from "./tutorial";

type Score = Readonly<{ startedAt: Tick; elapsed: TickSpan; survivedImpacts: number; cleanPairs: number }>;
export type TeachingAttempt =
  | Readonly<{ kind: "waiting" }>
  | (Readonly<{ kind: "running" }> & Score)
  | (Readonly<{ kind: "failed"; endedAt: Tick }> & Score);

export function advanceAttempt(previous: TeachingAttempt, row: TickRow, mode: LessonMode): TeachingAttempt {
  if (previous.kind === "failed") return previous;
  const start = previous.kind === "waiting" ? row.events.find((event) => event.kind === "explosion-marked") : null;
  if (previous.kind === "waiting" && !start) return previous;
  const startedAt = previous.kind === "waiting" ? row.tick : previous.startedAt;
  const impact = row.events.find((event) => event.kind === "explosion-resolved");
  const survived = impact?.kind === "explosion-resolved" && impact.outcome.kind !== "hit";
  const score: Score = {
    startedAt,
    elapsed: span(row.tick - startedAt),
    survivedImpacts: (previous.kind === "waiting" ? 0 : previous.survivedImpacts) + (survived ? 1 : 0),
    cleanPairs: (previous.kind === "waiting" ? 0 : previous.cleanPairs) + (tutorialFeedback(row) === "clean-pair" ? 1 : 0),
  };
  return mode === "survival" && impact?.kind === "explosion-resolved" && impact.outcome.kind === "hit"
    ? { kind: "failed", endedAt: row.tick, ...score }
    : { kind: "running", ...score };
}
