# Local rhythm practice

The player practises fifteen ranged explosion beats and fifteen melee explosion beats in a repeating loop. A short preparation window separates sets. Equipment switches automatically and the floor changes with the style. Mistakes give feedback without ending practice.

## Architecture

The existing flow is `compileSchedule` to `Ocellus.turn` to the shared `explode` rule. `EncounterBinding` applies damage and cooldown changes before player combat. `OcellusRegion.postTick` presents the resulting events and chooses the floor from the phase. A one-tile dodge cuts the attack delay by three ticks. A two-tile move avoids damage without the cut.

Use a new `focus=rhythm-loop` option and a specialized P4 schedule. Keep the existing phase and explosion event types. Put practice timing and count in `OcellusTimings.ts`, marked as a practice choice. Derive the schedule and a compact progress display from the same typed rhythm model. Switch equipment before player combat. Pauses suppress boss attacks. Preserve movement, the camera, targeting inputs and actual explosion resolution. Start beside the boss where both weapons can reach.

Practice must prevent the SDK from latching either participant's death. Cap lethal boss damage at the judgement boundary and retain normal explosion hit outcomes with automatic player recovery. Do not change full-fight behavior.

## Alternatives

Resetting the existing drill between sets reconstructs entities, countdown and targeting. A separate region duplicates combat and presentation ownership. A separate plain canvas trainer loses the original movement and attack feel. The specialized schedule retains the useful simulator behavior with the smallest new surface.

## Contract sketch

The mode button selects a typed `rhythmMode` URL choice. Its readonly style order is both styles for `alternating`, inner void for `ranged`, or outer void for `melee`. `rhythmSectionAt(at, mode)` is shared by scheduling, attack gating, equipment and the banner. The existing choice parser validates the mode, and the existing restart URL preserves it. A mode change reloads with a clean preparation window. Additional focus variants were rejected because they would duplicate every rhythm-only identity guard.

For this follow-up, one owner changes schedule, equipment and UI together. The lead owns documentation, release notes and real-browser verification. Those file sets are disjoint. The blocking check is agreement on the readonly style order. The smallest safe decomposition keeps all consumers of section state with one owner. No separate state timer or live schedule mutation is introduced.

The smaller effect uses an explosion-only scene and a weak set of already-scaled frame geometries. The SDK has no public effect-scale option. Scaling cached geometry once preserves the tile transforms and avoids new geometry or a repeated shrink on later frames. Other effect models draw in the original scene. No camera change is needed.

`compileRhythmSchedule(choices: ResolvedChoices): P4Schedule` returns a repeating fifteen-beat ranged and melee timeline.

`rhythmSectionAt(at: Tick)` returns a discriminated union describing preparation or practice, style, and visible progress. Its state is derived from encounter time rather than another timer.

Equipment synchronization occurs in the boss turn before player combat. The fifteenth impact finishes before the next preparation window. The floor uses the existing inner and outer void phases. Preparation clears it.

## Workflow and checkpoint

1. `how` over the affected subsystem. Complete through source inspection and the two architecture explorations.
2. `architect` for parallel design exploration. Compare a specialized P4 schedule with reset-based and separate-region alternatives.
3. Write the throughput checkpoint as four todo items.
   - Blocking first steps. Install the pinned SDK and acquire a compatible local asset bundle before runtime proof.
   - Independent workstreams. One owner implements gameplay and tests. The lead owns local setup, launch scripts and asset compatibility.
   - Shared mutable state. Owners edit disjoint files. Verification waits until dependency installation and code writes finish.
   - Smallest safe decomposition. One gameplay owner keeps timeline, equipment and cooldown behavior coherent.
4. Delegate code-writing to a subagent. The lead reviews the completed diff and runtime behavior.
5. Verify on the matching surface. Run types, behavior tests, asset validation, build and real browser input.
6. Rebase into small, ordered commits. Skip commits and rebase because this is a local deliverable without a requested upstream change.
7. If the design is contested, `interrogate` before shipping. Skip if the two explorations agree and review finds no contested design.
8. Run Opening a PR. Skip publishing because the user requested a local trainer.

## Verification

Prove alternating sets over multiple loops, fifteen resolutions per set, automatic gear, floor changes, correct pause behavior and no unrelated attacks. Drive real tile and boss clicks to prove two-tick attack gaps for both weapons. Keep the standing-still and two-tile controls. Prove practice survives enough damage to kill either participant normally. Run the existing verification workflow and record any platform limits explicitly.
