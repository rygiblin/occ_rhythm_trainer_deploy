import { Collision, Player } from "osrs-sdk";
import type { Location, MovePace, Region, Unit } from "osrs-sdk";
import type { InputObservation, PlayerObservation } from "./P4Types";
import { tile } from "../../../sim/brands";
import { protectionOf } from "../../../sim/sdk/EncounterBinding";

export type PlayerHost = Readonly<{
  input(observed: InputObservation): void;
  playerHitsSettled(): void;
  playerMovement(resolve: () => void): void;
  combat(step: () => void): void;
}>;

export type MeleeGuard = (target: Unit) => boolean;

export class OcellusPlayer extends Player {
  constructor(region: Region, location: Location, private readonly host: () => PlayerHost, private readonly meleeBlocked: MeleeGuard, private readonly attackBlocked: () => boolean = () => false) {
    super(region, location);
  }

  observe(): PlayerObservation {
    return { tile: tile(this.location.x, this.location.y), hp: this.currentStats.hitpoint, prayer: protectionOf(this) };
  }

  override moveTo(x: number, y: number, pace: MovePace = "run-setting"): void {
    super.moveTo(x, y, pace);
    this.host().input({ kind: "walk-ordered", destination: tile(x, y), pace });
  }

  /** The SDK redirects a blocked tile only when it is ordered, and a walk stops dead when its tile becomes blocked later. */
  override determineDestination(): void {
    super.determineDestination();
    const to = this.destinationLocation;
    if (to && Collision.collideableEntitiesAtPoint(this.region, to.x, to.y, 1).length > 0) super.moveTo(to.x, to.y, this.pace);
  }

  override pretick(): void {
    const before = protectionOf(this);
    super.pretick();
    const after = protectionOf(this);
    if (after !== before) this.host().input({ kind: "prayer-published", prayer: after });
  }

  override postAttacksEvent(): void {
    super.postAttacksEvent();
    this.host().playerHitsSettled();
  }

  override movementStep(): void {
    this.host().playerMovement(() => super.movementStep());
  }

  override attack(): boolean {
    if (this.attackBlocked()) return false;
    const swingsMelee = !this.manualSpellCastSelection && this.equipment.weapon?.isMeleeAttack === true;
    if (swingsMelee && this.aggro && this.meleeBlocked(this.aggro)) return false;
    return super.attack();
  }

  override attackStep(): void {
    this.host().combat(() => super.attackStep());
  }
}
