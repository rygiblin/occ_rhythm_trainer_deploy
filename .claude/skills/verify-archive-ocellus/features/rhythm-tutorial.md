# Guided rhythm tutorial

The opt-in teaching aid marks the player's current safe tile and a safe neighboring STEP tile, adapting after manual movement. It alternates STEP and ATTACK prompts at real game speed. An introduction waits for the learner to start. Feedback comes from actual explosion outcomes and attack launches.

## Sub-features

- `teaching-start` holds the lesson before Start guided practice.
- `teaching-markers` moves HERE and STEP markers with the actual player position, highlighting a safe neighboring step.
- `teaching-floor` keeps ranged markers outside the central square and melee markers on its safe inner rim; blue positioning cues choose a nearby safe tile during clear-floor pauses.
- `teaching-attack` puts the attack cue on the visible boss body.
- `teaching-feedback` distinguishes a clean pair, a missing attack, a missed or late step, and moving too far.
- `teaching-pause` freezes encounter ticks until Resume.
- `teaching-exit` returns to ordinary practice without markers.

## How to get to it (user POV)

Open `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&tutorial=on` or double-click **Start teaching version.cmd**. Read the introduction, then press **Start guided practice**. The mode button retains ranged-only, melee-only and alternating sets.

## Driving it with agent-browser

Preconditions: this checkout's development server is running on port 8002, with its local runtime assets. Project-local Node and agent-browser are installed.

- Run `.local-tools/node_modules/node/bin/node.exe scripts/verify-tutorial-browser.mjs`.
- The proof waits on the actual enabled Start button and verifies that the intro does not advance world ticks.
- It clicks Start, pauses and resumes, then follows all thirty live guide targets. Tile clicks use the highlighted tile. Boss clicks use the actual painted gold label position, recorded by a read-only canvas observer.
- It follows blue positioning cues in both directions between sets, checks both markers and the player's actual floor safety, and requires zero floor-hit events across the thirty pairs.
- It deliberately misses an attack, misses a step and moves too far. Each outcome must produce the corresponding feedback. The next marker must follow the new position and support another clean pair there.
- Screenshots and read-only snapshots are in `.verify/local-rhythm/tutorial/`. `verdict.json` records the result. Uncaught page errors fail the proof.

## Gotchas

After encounter tick 4, STEP queues movement on mark tick 5. After tick 5, ATTACK queues the launch on impact tick 6. The GET READY countdown is not the encounter clock. Fifteen is odd, so the suggested next tile must follow the player's actual position rather than a reset left-right counter. Do not slow only server ticks because client animation keeps its own timing. The frozen original practice build remains separate on port 8004.
