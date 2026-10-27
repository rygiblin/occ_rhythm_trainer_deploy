# Teaching v4: threats and recovery

The user approved replacing the numeric tick bar with a spatial threat display and recovery coach. The goal is to see where the burst will land, recognize the movement deadline, and rejoin the next step-and-attack pair after a mistake. Saved versions through `teaching-v3` remain available.

## Threat timing

The simulator records the player's tile before movement on a mark tick. Impact resolves before movement on the following tick. A countdown to impact alone would therefore imply an escape window that no longer exists.

Before the mark, an amber preview follows the player's current tile and counts toward the earlier movement deadline. The green neighboring STEP destination remains the valid move. After marking, a red countdown stays fixed on the actual marked tile until impact. Remaining on that tile shows that the current hit is committed; the lesson then guides the next valid step. The fight continues at normal speed.

## Ownership and architecture

Two independent designs compared a Region-owned display projection of trace events with a readonly projection of the boss's actual pending marks. Cross-review selected the actual marks as the source: add their creation tick to the existing private mark data, then expose typed preview/locked/none presentation states. This avoids duplicating the mark lifecycle or scanning accumulated logs. Preview reads the next lesson moment and respects count-in readiness.

Recovery remains in the Region, which already owns actual feedback. Its typed states are steady, recovering, and recovered. A floor hit or unsuccessful pair enters recovery. Only an actual one-tile dodge and attack launch, with safe floor and no floor hit that row, confirms recovery. A second clean pair returns to steady. Clicking a destination, reaching safe floor, changing phase, or restarting cannot count as a successful recovery.

The native threat entity uses cached square-perimeter geometry and the SDK tick fraction. It has no collision or line-of-sight effect. The preview and locked countdown have distinct colors and labels. Inactive STEP disappears during ATTACK because that tile commonly holds the pending explosion. HERE disappears where it would overlap the preview. Pausing freezes and dims the presentation. The millisecond bar is removed; optional metronome and existing inter-set readiness remain.

## Throughput checkpoint

- Blocking first steps: establish mark, movement and impact ordering; compare threat ownership and native rendering options before implementation.
- Independent workstreams: one owner handles the coupled threat data, recovery, native overlay, HUD and behavior tests. The lead owns documentation, release notes and the real-input driver.
- Shared mutable state: combat remains the only owner of pending marks. The Region owns recovery results. Consumers observe typed projections; they do not advance another timer.
- Smallest safe decomposition: keep the cue and its floor rendering together so the visible target and valid input deadline agree. Review and browser verification stay independent.

Model the Domain selects explicit threat and recovery unions. Boundary Discipline exposes presentation states rather than raw combat storage. Type System Discipline preserves branded tick and tile values. Foundational Thinking separates impact time from movement deadline. Minimize Reader Load keeps one lifecycle for each fact. Laziness Protocol reuses the existing mark resolver, timeline and guidance. Test Behavior, Not Implementation requires real mistakes and successful recovery pairs.
