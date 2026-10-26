import { CollisionType, Entity, LineOfSightMask } from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import * as THREE from "three";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Tile } from "../../../../sim/brands";
import type { VoidKind } from "../P4Types";
import { SpotAnimModel } from "./P4Views";

const CUE = { spotAnim: OCELLUS_P4.explosion.spotAnim.value, loops: false } as const;
const scaledGeometry = new WeakSet<THREE.BufferGeometry>();

class ExplosionScene extends THREE.Scene {
  override add(...objects: THREE.Object3D[]): this {
    for (const object of objects) {
      if (object instanceof THREE.InstancedMesh && !scaledGeometry.has(object.geometry)) {
        object.geometry.scale(OCELLUS_P4.explosion.visualScale.value, OCELLUS_P4.explosion.visualScale.value, OCELLUS_P4.explosion.visualScale.value);
        scaledGeometry.add(object.geometry);
      }
    }
    return super.add(...objects);
  }
}

class ExplosionModel extends SpotAnimModel {
  constructor(view: Entity, private readonly effects: ExplosionScene) {
    super(view, () => CUE);
  }

  override draw(scene: THREE.Scene, clockDelta: number, tickPercent: number, location: Location3, angleRadians: number, pitchRadians: number, visible: boolean, modelOffsets: Location3[]): void {
    if (this.effects.parent !== scene) scene.add(this.effects);
    super.draw(this.effects, clockDelta, tickPercent, location, angleRadians, pitchRadians, visible, modelOffsets);
  }

  override destroy(_scene: THREE.Scene): void {
    super.destroy(this.effects);
  }
}

type Blast = "marked" | "detonated";

class ExplosionView extends Entity {
  private blast: Blast = "marked";

  constructor(region: Region, at: Tile, private readonly effects: ExplosionScene) {
    super(region, { x: at.x, y: at.y });
  }

  detonate(): void {
    this.blast = "detonated";
  }

  override tick(): void {
    if (this.blast === "detonated") this.dying = 0;
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.NONE;
  }

  protected override create3dModel(): Model {
    return new ExplosionModel(this, this.effects);
  }
}

export class ExplosionViews {
  private readonly live = new Map<string, ExplosionView>();
  private readonly effects = new ExplosionScene();

  constructor(private readonly region: Region) {}

  mark(kind: VoidKind, pulse: number, at: Tile): void {
    const view = new ExplosionView(this.region, at, this.effects);
    this.region.addEntity(view);
    this.live.set(`${kind}:${pulse}`, view);
  }

  detonate(kind: VoidKind, pulse: number): void {
    this.live.get(`${kind}:${pulse}`)?.detonate();
    this.live.delete(`${kind}:${pulse}`);
  }

  retire(): void {
    this.live.forEach((view) => {
      view.dying = 0;
    });
    this.live.clear();
  }
}
