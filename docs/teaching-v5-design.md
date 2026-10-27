# Teaching v5: continuous practice and survival

The user confirmed continuous practice in one selected style. Unlimited continues after mistakes. Survival ends on the first actual impact-tile hit and records the attempt's duration and best completed run. The existing fifteen-hit sets remain available.

## Schedule and lesson state

Two independent explorations and cross-review selected a separate continuous schedule: the existing five-tick preparation stage runs once, followed by a two-slot mark/impact cycle forever. Explosion pulses use the cycle visit number so identities remain unique past fifteen, thirty and sixty pairs. Floor grace applies only after the initial onset. Skipping preparation slots in the old fifteen-hit table was rejected because it would reuse pulses, renew floor grace, and produce false preparation cues.

The central `lessonMode` choice selects sets, unlimited or survival. Its parser default preserves existing links and tests. The teaching launcher and new preview explicitly select Unlimited with ranged style. Continuous modes offer ranged and melee; sets retain the existing alternating option. Shared section, guide, threat and timeline consumers use the same profile, so the active phase and beat never return to preparation during a continuous run.

## Attempt ownership

The Region owns a typed waiting/running/failed attempt reducer over completed encounter rows. Timing begins on the first active mark. Elapsed time is the actual encounter tick minus that first mark tick, so preparation, positioning and paused time add nothing. A hit on the first impact lasts one tick, or 0.6 seconds.

Only an actual `explosion-resolved` outcome of `hit` ends Survival. Missing an attack, moving too far or receiving floor damage retains the existing coaching without ending the attempt. Avoided impacts and clean dodge-and-attack pairs are counted separately. Unlimited keeps running after a hit.

The failure result is latched after its real row completes, then the world stops. This is a training result rather than a fabricated boss death. Finished status suppresses actionable threat cues and Resume. Retry uses the SDK's public reset and start controls to reconstruct the boss, clock, overlays and attempt while preserving selected controls. The personal best stays visible.

A validated UI storage boundary keeps completed Survival bests separately for ranged and melee. Combat getters do not read or write storage. Only a completed improving result updates its best.

## Throughput checkpoint

- Blocking first steps: confirm continuous-style preference, inspect schedule visits, tick order, failure events and SDK reset APIs before implementation.
- Independent workstreams: one owner handles the coupled profile, clock, attempt, HUD and behavior tests. The lead owns documentation, release notes, launcher and browser proof.
- Shared mutable state: the lesson clock owns progression, the Region owns attempt results, and the UI owns persistence. Source writers remain disjoint.
- Smallest safe decomposition: keep all profile consumers together so a new endless phase cannot disagree with its floor, equipment or threat cues. Review and real-input verification remain independent.

Model the Domain selects profile and attempt unions. Boundary Discipline keeps persistence outside gameplay. Type System Discipline preserves branded elapsed ticks and explicit endless limits. Foundational Thinking keeps pulse identities and historical projectile phases correct. Minimize Reader Load gives each fact one owner. Laziness Protocol reuses the existing timeline, movement, explosion resolver and teaching overlays. Test Behavior, Not Implementation proves long runs and real first-hit failures through public controls.
