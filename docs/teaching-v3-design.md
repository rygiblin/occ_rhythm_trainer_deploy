# Teaching v3

The user approved four changes after a hands-on review: clearer action markers, a visible tick countdown with optional metronome, safe positioning before each count-in, and a smaller HUD with truthful phase and beat information. Earlier teaching snapshots remain at tags `teaching-v1` and `teaching-v2`; the original practice snapshot remains at `practice-v1-15-beats`.

## Runtime grounding

The SDK world opens an encounter tick before the NPC judges incoming projectiles and emits mechanic beats. Player movement resolves later in the same world tick. The encounter then records a trace row. Stopping the world also stops input and movement, so a positioning gate cannot pause the whole world. The player must be able to walk while the lesson withholds attacks and floor hazards.

The boss also looks up past phases when a projectile lands. A single mutable time offset would reinterpret those past launches after a later positioning wait. The selected design keeps encounter ticks monotonic and retains each tick's emitted lesson moment.

## Selected shape

One tutorial-only timeline owns `positioning`, `count-in`, and `practice` states. It advances once in the tick-opened hook, before incoming damage judgments. Positioning emits neutral floor and no damaging beats. A valid position starts the existing full five-tick count-in. Leaving safe floor during count-in returns to positioning. Practice runs the existing fifteen marks and impacts at the normal 600 ms tick, then enters the next selected style's positioning state.

One boss moment boundary reads this adapter for teaching and the original schedule otherwise. All phase, attack-block, equipment, damage-judgment and log consumers use that same lesson state. Historical moments remain stable. Read-only projectile previews may project within the known set and clamp at the next neutral positioning slot.

Public tutorial status separates current lesson state from the next action cue. The HUD shows current style, phase and beat during recovery. Fractional countdown comes from the SDK world's tick progress. Optional audio emits once per new tick, without catch-up bursts, and is silent when disabled or paused. POSITION hides the inactive STEP marker. Ordinary practice keeps its existing schedule and controls.

## Alternatives and synthesis

Two independent explorations converged on the timeline adapter. A separate cross-review found no blocker and identified pre-tick rendering, future projectile previews, and one-time equipment changes as integration requirements. Whole-world pause was rejected because movement stops. Repeated `Schedule.cut` calls were rejected because their bounded history can remove a past projectile's launch phase. The adapter hides these rules behind one authoritative state.

## Throughput checkpoint

- Blocking first steps: inspect tick ordering, movement, projectile history and display clock before implementation.
- Independent workstreams: one implementation owner handles the coupled runtime, markers, HUD and behavior tests; the lead handles documentation, release notes and the browser driver.
- Shared mutable state: only the lesson timeline advances lesson state. Other consumers observe it. Source ownership is disjoint during implementation.
- Smallest safe decomposition: keep gameplay and its cue consumers together because they must agree on the same upcoming tick. Separate implementation from review and real-input verification.

Model the Domain selects the lesson state machine. Boundary Discipline keeps one moment adapter and public status boundary. Type System Discipline keeps ticks and tiles branded. Foundational Thinking preserves historical projectile semantics. Minimize Reader Load keeps timing decisions in one owner. Laziness Protocol reuses the existing schedule and explosion rules. Test Behavior, Not Implementation requires actual movement and attacks to earn results.
