# Guided rhythm tutorial

The opt-in teaching aid marks the player's current safe tile and a safe neighboring STEP tile, adapting after manual movement. It alternates STEP and ATTACK prompts at real game speed. An introduction waits for the learner to start. Feedback comes from actual explosion outcomes and attack launches.

## Sub-features

- `teaching-start` holds the lesson before Start guided practice.
- `teaching-markers` moves HERE and STEP markers with the actual player position, highlighting a safe neighboring step.
- `teaching-floor` keeps ranged markers outside the central square and melee markers on its safe inner rim; blue positioning cues choose a nearby safe tile during clear-floor pauses.
- `teaching-readiness` waits indefinitely on clear floor until the learner reaches the next style's safe area, then runs the full count-in. Leaving safe floor during count-in resets it.
- `teaching-threat` previews the movement deadline on the current tile, then locks the actual dangerous tile with an impact countdown. A committed hit does not imply a late escape window.
- `teaching-recovery` guides the next step and attack after a real mistake. Only an actual successful pair without floor damage confirms recovery; another clean pair returns to steady.
- `teaching-metronome` uses optional low STEP and high ATTACK tones, initially disabled and silent while paused or positioning.
- `teaching-attack` puts the attack cue on the visible boss body.
- `teaching-feedback` distinguishes a clean pair, a missing attack, a missed or late step, and moving too far.
- `teaching-pause` freezes encounter ticks until Resume.
- `teaching-exit` returns to ordinary practice without markers.
- `teaching-unlimited` runs the selected style continuously after one count-in, with unique pulses and no fifteen-hit breaks. Mistakes keep the lesson running.
- `teaching-survival` ends on the first actual impact-tile hit, freezes the completed score and offers Retry. Preparation and paused time are excluded. Completed bests persist separately for ranged and melee.

## How to get to it (user POV)

Open `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&tutorial=on` or double-click **Start teaching version.cmd**. Read the introduction, then press **Start guided practice**. The mode button retains ranged-only, melee-only and alternating sets.

The launcher now selects Unlimited ranged practice. For Survival use `lessonMode=survival&rhythmMode=ranged` or its visible session control; continuous styles are ranged or melee. Older links without a session choice retain fifteen-hit sets.

## Driving it with agent-browser

Preconditions: this checkout's development server is running on port 8002, with its local runtime assets. Project-local Node and agent-browser are installed.

- Run `.local-tools/node_modules/node/bin/node.exe scripts/verify-tutorial-browser.mjs`.
- Add `--endurance` for continuous-mode verification. It plays forty ranged and twenty melee Unlimited pairs, verifies Unlimited continues after a hit, then plays twenty Survival pairs before deliberately taking the first impact hit. It verifies frozen scores, elapsed timing, pause, Retry, reload persistence and separate style records. Evidence is in `.verify/local-rhythm/tutorial-v5/`.
- The proof waits on the actual enabled Start button and verifies that the intro does not advance world ticks.
- It clicks Start, pauses and resumes, then follows all thirty live guide targets. Tile clicks use the highlighted tile. Boss clicks use the actual painted gold label position, recorded by a read-only canvas observer.
- It holds positioning for ten ticks, then five ticks in the other direction. Those rows must stay clear of explosions and floor damage. Moving to blue must unlock the full five-tick count-in.
- It checks both markers and the player's actual floor safety, requires zero floor-hit events across the thirty pairs, and verifies no inactive STEP label is drawn during positioning.
- It checks preview deadlines, the fixed actual marked tile after movement, disappearance after impact, and the committed-hit warning after deliberately missing a step. Inactive STEP must remain hidden during the locked interval.
- It observes actual oscillator starts: disabled and paused are silent; enabled has distinct tones with at most one per tick.
- It deliberately misses an attack, misses a step and moves too far. Each outcome must produce the corresponding feedback. The next marker follows the new position; an actual clean pair confirms recovery and a second returns to steady.
- Screenshots and read-only snapshots are in `.verify/local-rhythm/tutorial-v4/`. `verdict.json` records the result. Uncaught page errors fail the proof.

## Gotchas

At the initial safe spawn, encounter tick 4 prompts STEP for mark tick 5 and tick 5 prompts ATTACK for impact tick 6. Later sets use readiness-dependent encounter times; drive them from public lesson state. The GET READY countdown is not the encounter clock. The suggested neighboring tile follows the player's actual position. Do not slow only server ticks because client animation keeps its own timing. The frozen original practice build remains separate on port 8004.
