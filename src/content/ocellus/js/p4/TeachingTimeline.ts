import type { Tick, TickSpan, Tile } from "../../../../sim/brands";
import { tick } from "../../../../sim/brands";
import type { Moment } from "../../../../sim/schedule";
import type { LessonMode, RhythmMode } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Beat, Phase } from "../P4Types";
import type { P4Schedule } from "./schedule";
import { rhythmSectionAt } from "./rhythm";
import { sameTile, teachingTilesAt } from "./tutorial";

type Style = "ranged" | "melee";
export type TeachingLesson =
  | Readonly<{ kind: "positioning"; style: Style }>
  | Readonly<{ kind: "count-in"; style: Style; remaining: TickSpan }>
  | Readonly<{ kind: "practice"; style: Style; beat: number; count: number | null }>;

export class TeachingTimeline {
  private cursor = tick(0);
  private positioning = true;
  private last: Tick | null = null;
  private readonly history = new Map<Tick, Moment<Phase, Beat>>();

  constructor(private readonly schedule: P4Schedule, private readonly mode: RhythmMode, private readonly holes: readonly Tile[], private readonly lessonMode: LessonMode = "sets") {}

  get virtualTick(): Tick { return this.cursor; }

  lesson(): TeachingLesson {
    const section = rhythmSectionAt(this.cursor, this.mode, this.lessonMode);
    if (this.positioning) return { kind: "positioning", style: section.style };
    return section.kind === "prepare"
      ? { kind: "count-in", style: section.style, remaining: section.remaining }
      : { kind: "practice", style: section.style, beat: section.beat, count: section.count };
  }

  advance(at: Tick, player: Tile): boolean {
    const first = this.last === null;
    let entered = first;
    if (!first && !this.positioning) {
      const current = rhythmSectionAt(this.cursor, this.mode, this.lessonMode);
      const next = rhythmSectionAt(tick(this.cursor + 1), this.mode, this.lessonMode);
      if (current.kind === "practice" && next.kind === "prepare") {
        this.cursor = tick(this.cursor + 1);
        this.positioning = true;
        entered = true;
      } else if (current.kind === "prepare" && !this.ready(player)) {
        this.cursor = tick(this.cursor - (OCELLUS_P4.rhythm.value.prepare - current.remaining));
        this.positioning = true;
      } else this.cursor = tick(this.cursor + 1);
    } else if (this.ready(player)) this.positioning = false;
    this.last = at;
    this.history.set(at, this.moment(at, this.cursor, this.positioning));
    return entered;
  }

  at(at: Tick): Moment<Phase, Beat> {
    const recorded = this.history.get(at);
    if (recorded) return recorded;
    if (this.last === null) return this.moment(at, this.cursor, true);
    if (at < this.last) throw new RangeError(`no teaching moment for tick ${at}`);
    let cursor = this.cursor;
    let positioning = this.positioning;
    for (let offset = 0; offset < at - this.last && !positioning; offset++) {
      const current = rhythmSectionAt(cursor, this.mode, this.lessonMode);
      cursor = tick(cursor + 1);
      if (current.kind === "practice" && rhythmSectionAt(cursor, this.mode, this.lessonMode).kind === "prepare") positioning = true;
    }
    return this.moment(at, cursor, positioning);
  }

  private ready(player: Tile): boolean {
    return sameTile(player, teachingTilesAt(this.cursor, player, this.mode, this.holes, this.lessonMode).A);
  }

  private moment(at: Tick, cursor: Tick, positioning: boolean): Moment<Phase, Beat> {
    const moment = this.schedule.at(cursor);
    return { tick: at, phase: moment.phase, beats: positioning ? [] : moment.beats };
  }
}
