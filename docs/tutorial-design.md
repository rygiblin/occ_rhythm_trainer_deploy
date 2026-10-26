# Teach the two-tick rhythm

The teaching aid is an opt-in version of the fifteen-beat trainer. The original is saved at tag `practice-v1-15-beats`, commit `1bd3ffcae0efc48c95c185430a185f425077724b`, and as a frozen playable build in the workspace's `saved-versions/rhythm-practice-v1/` folder. The tutorial is developed on `codex/rhythm-tutorial`. Normal practice remains available without tutorial guidance.

## Teaching flow

An introduction explains the neighboring A and B tiles before the lesson starts. The learner clicks Start guided practice when ready. A green tile says where to step. A gold label on the boss's visible body says when to attack. The lesson keeps the existing fifteen-beat sets, style choices, short preparation windows and smaller explosion animation.

Feedback describes actual results. A successful dodge and an attack launch on the impact tick form a clean pair. A dodge without a launch means the step was correct but the attack was missed. Standing on the mark means the step was absent or late. Moving too far avoids damage without earning the attack-speed bonus. A learner outside the teaching pair is directed back to it.

Pause and Resume let the learner read the instructions. Real game speed stays unchanged. Slowing the server tick without slowing client animation would misalign the explosion cue and its impact, so this version does not introduce a slow-speed setting.

## Timing contract

The prompt describes the next encounter tick. It never uses the world's GET READY countdown as the fight clock.

| Last completed tick | Prompt | Result on next tick |
| --- | --- | --- |
| 0 through 3 | Get ready | Preparation |
| 4 | Step from A to B | Move on mark tick 5 |
| 5 | Attack Ocellus | Launch on impact tick 6 |
| 6 | Step from B to A | Move on mark tick 7 |
| 7 | Attack Ocellus | Launch on impact tick 8 |
| 33 | Attack Ocellus | Final ranged impact at 34 |
| 34 through 38 | Prepare for next set | No step instruction |
| 39 | Step to the opposite teaching tile | Move on melee mark tick 40 |
| 40 | Attack Ocellus | Launch on melee impact tick 41 |

The next tile depends on the player's actual position. Fifteen is odd, so restarting left-right parity at every style change gives the wrong instruction.

## Architecture and alternatives

Two independent design explorations checked mechanics and visuals. The selected design adds a pure cue/feedback module and a typed `tutorial=on` URL choice. The region owns observable results. The UI uses the SDK's fixed `autoStart=false` path, then starts and pauses the same trainer instance through its public API. Changing autoStart after mount would rebuild the trainer and is excluded.

Native TileMarker entities mark A at `(5,3)` and B at `(6,3)`. Their dynamic colors reuse the existing marker geometry. Canvas labels use UILayerProjector, so they follow camera movement and resizing without intercepting clicks. The boss's ATTACK cue uses its actual model height rather than a guessed pixel offset or its ground tile.

A DOM projection overlay was rejected because projectTile returns a clickable floor point rather than tile corners or the hovering boss body. A separate simulation was rejected because it could teach a different cooldown or movement rule.

## Work checkpoint

- Blocking first steps. Save the original source and production build before tutorial edits. Ground cue timing against actual mark, movement and impact ordering.
- Independent workstreams. One owner changes gameplay, native markers, lesson UI and tests. The lead owns saved-version launchers, documentation, release notes and browser proof.
- Shared mutable state. Owners edit disjoint files. Feedback comes from actual encounter rows. No second fight timer is introduced.
- Smallest safe decomposition. Keep cue generation, its world markers and UI consumers with one owner so the visual prompt and actual mechanic share one definition.

Model the Domain keeps tutorial cues and feedback as typed states. Boundary Discipline reuses the URL parser and public trainer controls. Test Behavior, Not Implementation requires real steps and boss clicks to earn feedback. Laziness Protocol reuses the existing arena, markers, movement, explosion resolver and cooldown rules.
