import * as THREE from "three";
import { CollisionType, Entity, GROUND_OVERLAY_Y, LineOfSightMask } from "osrs-sdk";
import type { Location3, Model, Region, UILayerProjector } from "osrs-sdk";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { TutorialStatus, TutorialThreat } from "../p4/tutorial";

const LOOK = OCELLUS_P4.teaching.value.threat;
type Observation = () => TutorialStatus | null;

function perimeter(dashed: boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  const low = LOOK.inset;
  const high = 1 - low;
  const length = high - low;
  const quad = (x1: number, z1: number, x2: number, z2: number) => positions.push(x1, 0, z1, x2, 0, z1, x2, 0, z2, x1, 0, z1, x2, 0, z2, x1, 0, z2);
  for (let side = 0; side < 4; side++) {
    for (let segment = 0; segment < LOOK.segmentsPerSide; segment++) {
      if (dashed && segment % 2 === 1) continue;
      const from = low + length * segment / LOOK.segmentsPerSide;
      const to = low + length * (segment + 1) / LOOK.segmentsPerSide;
      switch (side) {
        case 0: quad(from, -high, to, -high + LOOK.width); break;
        case 1: quad(high - LOOK.width, -high + from - low, high, -high + to - low); break;
        case 2: quad(1 - to, -low - LOOK.width, 1 - from, -low); break;
        case 3: quad(low, -from, low + LOOK.width, -to); break;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

class ThreatModel implements Model {
  private readonly group = new THREE.Group();
  private readonly outlineGeometry = perimeter(false);
  private readonly solid = perimeter(false);
  private readonly dashed = perimeter(true);
  private readonly outlineMaterial = new THREE.MeshBasicMaterial({ color: LOOK.locked, transparent: true, opacity: LOOK.outlineOpacity, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly activeMaterial = new THREE.MeshBasicMaterial({ color: LOOK.locked, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  private readonly active = new THREE.Mesh(this.solid, this.activeMaterial);

  constructor(private readonly read: Observation, private readonly region: Region) {
    const outline = new THREE.Mesh(this.outlineGeometry, this.outlineMaterial);
    outline.renderOrder = 90;
    this.active.renderOrder = 91;
    this.group.add(outline, this.active);
  }

  draw(scene: THREE.Scene, _clockDelta: number, _tickPercent: number, _location: Location3, _angleRadians: number, _pitchRadians: number, visible: boolean): void {
    if (this.group.parent !== scene) scene.add(this.group);
    const status = this.read();
    this.group.visible = visible && status !== null && status.threat.kind !== "none";
    if (!status || status.threat.kind === "none") return;
    const threat = status.threat;
    this.group.position.set(threat.tile.x, GROUND_OVERLAY_Y + LOOK.lift, threat.tile.y);
    const paused = this.region.world.isPaused;
    const color = paused ? OCELLUS_P4.teaching.value.colours.idle : threat.kind === "preview" ? LOOK.preview : LOOK.locked;
    this.outlineMaterial.color.set(color);
    this.activeMaterial.color.set(color);
    const geometry = threat.kind === "preview" ? this.dashed : this.solid;
    this.active.geometry = geometry;
    const end = threat.kind === "preview" ? threat.moveAt : threat.impactAt;
    const start = threat.kind === "preview" ? threat.moveAt - 1 : threat.markedAt;
    const progress = Math.max(0, Math.min(1, ((status.tick ?? start) + status.tickProgress - start) / (end - start)));
    const segments = geometry.getAttribute("position").count / 6;
    geometry.setDrawRange(0, Math.ceil((1 - progress) * segments) * 6);
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.outlineGeometry.dispose();
    this.solid.dispose();
    this.dashed.dispose();
    this.outlineMaterial.dispose();
    this.activeMaterial.dispose();
  }

  getWorldPosition(): THREE.Vector3 { return this.group.getWorldPosition(new THREE.Vector3()); }
  async preload(): Promise<void> {}
}

export class TutorialThreatTile extends Entity {
  constructor(region: Region, private readonly read: Observation) { super(region, { x: 0, y: 0 }); }

  show(threat: TutorialThreat): void {
    if (threat.kind !== "none") this.location = { ...threat.tile };
  }

  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override visible(tickPercent: number): boolean {
    const status = this.read();
    return super.visible(tickPercent) && status !== null && status.threat.kind !== "none";
  }

  protected override create3dModel(): Model { return new ThreatModel(this.read, this.region); }

  override drawUILayer(tickPercent: number, projector: UILayerProjector, context: OffscreenCanvasRenderingContext2D, _scale: number): void {
    if (!projector.visible || !this.visible(tickPercent)) return;
    const status = this.read();
    if (!status || status.threat.kind === "none") return;
    const at = projector.atHeight(0);
    const text = status.threat.kind === "preview" ? "TARGET" : "IMPACT";
    context.save();
    context.font = "bold 12px sans-serif";
    context.textAlign = "center";
    context.lineWidth = 4;
    context.strokeStyle = "#111";
    context.fillStyle = this.region.world.isPaused ? OCELLUS_P4.teaching.value.colours.idle : status.threat.kind === "preview" ? LOOK.preview : LOOK.locked;
    context.strokeText(text, at.x, at.y - 8);
    context.fillText(text, at.x, at.y - 8);
    context.restore();
  }
}
