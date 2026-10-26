# Teach the two-tick rhythm

The teaching aid is an opt-in version of the fifteen-beat trainer. The original is saved at tag `practice-v1-15-beats`, commit `1bd3ffcae0efc48c95c185430a185f425077724b`, and as a frozen playable build in the workspace's `saved-versions/rhythm-practice-v1/` folder. The tutorial is developed on `codex/rhythm-tutorial`. Normal practice remains available without tutorial guidance.

## Teaching flow

An introduction explains the moving HERE and STEP markers before the lesson starts. The learner clicks Start guided practice when ready. A green neighboring tile says where to step from the actual player position. A gold label on the boss's visible body says when to attack. The lesson keeps the existing fifteen-beat sets, style choices, short preparation windows and smaller explosion animation.

Feedback describes actual results. A successful dodge and an attack launch on the impact tick form a clean pair. A dodge without a launch means the step was correct but the attack was missed. Standing on the mark means the step was absent or late. Moving too far avoids damage without earning the attack-speed bonus. After manual movement, the next marker follows the player's new location. An unsafe location receives a blue positioning cue to the nearest valid safe tile.

Pause and Resume let the learner read the instructions. Real game speed stays unchanged. Slowing the server tick without slowing client animation would misalign the explosion cue and its impact, so this version does not introduce a slow-speed setting.

## Timing contract

The prompt describes the next encounter tick. It never uses the world's GET READY countdown as the fight clock.

| Last completed tick | Prompt | Result on next tick |
| --- | --- | --- |
| 0 through 3 | Get ready | Preparation |
| 4 | Step to the green neighboring tile | Move on mark tick 5 |
| 5 | Attack Ocellus | Launch on impact tick 6 |
| 6 | Step to the green neighboring tile | Move on mark tick 7 |
| 7 | Attack Ocellus | Launch on impact tick 8 |
| 33 | Attack Ocellus | Final ranged impact at 34 |
| 34 | Prepare for next set | Keep ranged markers until the floor clears |
| 35 through 38 | Move to the nearby blue melee positioning tile, then wait | Reposition during clear floor |
| 39 | Step to the green neighboring tile | Move on melee mark tick 40 |
| 40 | Attack Ocellus | Launch on melee impact tick 41 |

The next tile depends on the player's actual position and the current safe-floor mask. A deterministic neighbor preference permits back-and-forth steps while adapting immediately when the player moves elsewhere.

## Architecture and alternatives

Two independent design explorations checked mechanics and visuals. The selected design adds a pure cue/feedback module and a typed `tutorial=on` URL choice. The region owns observable results. The UI uses the SDK's fixed `autoStart=false` path, then starts and pauses the same trainer instance through its public API. Changing autoStart after mount would rebuild the trainer and is excluded.

Two native TileMarker entities move with the actual player position. HERE marks the current safe tile; STEP selects a traversable one-tile neighbor on the same safe floor. Ranged candidates lie outside the central 5x5; melee candidates lie on the inner rim, outside the boss footprint. Invalid candidates exclude arena edges and holes. If the player is on the wrong side, a blue POSITION marker selects a nearby valid safe tile. Current-section floor rules keep the final ranged markers outside through tick 34; the melee positioning cue begins at 35 after the floor clears. Green stays reserved for the timed one-tile step. The tutorial uses the existing floor-damage rules, so an unsafe route produces real floor-hit events. Ordinary rhythm practice keeps its existing schedule.

The markers' dynamic colors reuse the existing geometry. Canvas labels use UILayerProjector, so they follow camera movement and resizing without intercepting clicks. The boss's ATTACK cue uses its actual model height rather than a guessed pixel offset or its ground tile.

A DOM projection overlay was rejected because projectTile returns a clickable floor point rather than tile corners or the hovering boss body. A separate simulation was rejected because it could teach a different cooldown or movement rule.

## Work checkpoint

- Blocking first steps. Save the original source and production build before tutorial edits. Ground cue timing against actual mark, movement and impact ordering.
- Independent workstreams. One owner changes gameplay, native markers, lesson UI and tests. The lead owns saved-version launchers, documentation, release notes and browser proof.
- Shared mutable state. Owners edit disjoint files. Feedback comes from actual encounter rows. No second fight timer is introduced.
- Smallest safe decomposition. Keep cue generation, its world markers and UI consumers with one owner so the visual prompt and actual mechanic share one definition.

Model the Domain keeps tutorial cues and feedback as typed states. Boundary Discipline reuses the URL parser and public trainer controls. Test Behavior, Not Implementation requires real steps and boss clicks to earn feedback, including after manual relocation. Laziness Protocol reuses the existing arena, floor masks, markers, movement, explosion resolver and cooldown rules. Type System Discipline keeps tiles branded and state readonly. Foundational Thinking derives safe steps from actual arena geometry. Minimize Reader Load keeps one shared guide definition for native markers, instructions and public status.
