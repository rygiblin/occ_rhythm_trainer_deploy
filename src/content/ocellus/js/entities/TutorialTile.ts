import { TileMarker } from "osrs-sdk";
import type { Region, UILayerProjector } from "osrs-sdk";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { TeachingTile, TutorialCue } from "../p4/tutorial";

const LOOK = OCELLUS_P4.teaching.value;

export class TutorialTile extends TileMarker {
  constructor(region: Region, private readonly label: TeachingTile, private readonly guide: () => TutorialCue | null) {
    super(region, LOOK.tiles[label], LOOK.colours.idle, 1, false);
  }

  override get color(): string {
    const cue = this.guide();
    return (cue?.kind === "step" || cue?.kind === "return-to-pair") && cue.target === this.label ? LOOK.colours.step : LOOK.colours.idle;
  }

  override drawUILayer(_tickPercent: number, projector: UILayerProjector, context: OffscreenCanvasRenderingContext2D, _scale: number): void {
    if (!projector.visible) return;
    const at = projector.atHeight(0);
    const cue = this.guide();
    const active = (cue?.kind === "step" || cue?.kind === "return-to-pair") && cue.target === this.label;
    context.save();
    context.font = "bold 15px sans-serif";
    context.textAlign = "center";
    context.lineWidth = 4;
    context.strokeStyle = "#111";
    context.fillStyle = active ? LOOK.colours.step : "#dce3ea";
    const text = active ? `${this.label} · ${cue?.kind === "return-to-pair" ? "RETURN" : "STEP"}` : this.label;
    context.strokeText(text, at.x, at.y - 8);
    context.fillText(text, at.x, at.y - 8);
    context.restore();
  }
}
