# Teaching version verification

The saved original remains at tag `practice-v1-15-beats` and commit `1bd3ffcae0efc48c95c185430a185f425077724b`. Its frozen production build loads separately at `http://127.0.0.1:8004/?focus=rhythm-loop&invincible=on`. The saved browser preview loaded with the original mode button and no page errors. No generated assets were committed.

The teaching version is on `codex/rhythm-tutorial`, selected with `tutorial=on` on the development preview. It adds dynamic safe-floor guidance and enables the existing floor-damage rule for this lesson. Original movement, cooldown, explosion and invincibility rules are reused. The saved practice version remains unchanged.

## Teaching v4: current verification

The spatial threat display and recovery coach pass all 84 focused tutorial, rhythm, mode, floor, explosion, attack-speed, invincibility and release tests. The final label correction also passes all 27 tutorial tests. TypeScript and type discipline report zero findings. The production build, cache-header validation and phase-code check pass.

Public behavior tests establish the exact recovery sequence in both styles: miss the mark-tick move at 5, take the hit at 6, move on 7, attack on 8, and confirm recovered only after tick 8 resolves. The following clean pair returns to steady. Missed attacks and moves that went too far recover through the next dynamically selected pair. Floor damage overrides an otherwise clean pair, and safe positioning alone cannot confirm recovery.

The browser driver earns thirty ordinary clean pairs across ranged and melee, then deliberately misses an attack, misses a step and moves too far. It verifies the committed-hit warning, recovers with a real clean pair, and earns a second pair to return to steady: 32 clean pairs total. No floor-hit events occur on this guided path; the deliberate missed explosion step does apply its normal damage. Existing readiness waits, full count-ins, optional metronome, pause and leaving the tutorial remain covered.

Before each mark, the public preview points to the player's actual tile and exposes the movement deadline separately from impact time. After the move, the locked threat remains on the original marked tile until resolution. Native screenshots capture the amber preview, red locked border, and a later fraction of the same committed impact. The numeric bar is absent. STEP is hidden during the locked interval; HERE is also hidden when the player remains on the dangerous tile. That last overlap was found in independent review and corrected before saving this version.

Current evidence is `.verify/local-rhythm/tutorial-v4/`, including `verdict.json`, public state snapshots, the actual fight trace and JPEG screenshots. Run `scripts/verify-tutorial-browser.mjs` with the project-local Node runtime to reproduce it. The driver uses real browser mouse events and observes public state, canvas labels and oscillator starts; it does not drive the simulation through internal APIs. The implementation follows [Teaching v4](teaching-v4-design.md).

The Windows harness limitations below still apply; the full repository suite is not claimed green.

## Teaching v3: historical verification

The approved readiness, pulse, metronome, marker and compact-display changes pass all 77 focused tutorial, rhythm, mode, floor, explosion, attack-speed, invincibility and release tests. TypeScript and type discipline report zero findings. The production build, cache-header validation and phase-code check pass. Independent source review found no actionable issues.

The real-input browser proof earns fifteen ranged and fifteen melee clean pairs, then another clean pair after manual relocation. Both marker tiles and the player remain on safe floor; no floor-hit events occur. The proof deliberately misses an attack and a step, and moves too far, to verify all four feedback outcomes.

During transitions, the proof holds positioning for ten ticks and then five ticks in the other direction. The world keeps advancing, the floor stays clear, no explosion or floor-hit event occurs, and attempts stay fixed. A real click to the blue target unlocks a fresh full five-tick count-in. No inactive STEP text is drawn while POSITION is active.

The pulse reports fractional SDK tick progress. The optional metronome emits 60 real oscillator tones across the two sets, with distinct frequencies and no duplicate tick identities. It is silent while disabled or paused. Start, Pause, Resume and leaving the tutorial all work; ordinary practice resumes without tutorial state. No page errors are recorded. Visual review covers the compact panel, clear-floor positioning, active melee markers, and the paused 800-by-800 layout.

Current evidence is `.verify/local-rhythm/tutorial-v3/verdict.json`, the trace and JSON snapshots, and the JPEG screenshots in that folder. The reproducible driver remains `scripts/verify-tutorial-browser.mjs`. It uses the repository's browser CLI and a persistent CDP connection for genuine mouse input and screenshots. Earlier CLI-only capture attempts delayed some clicks past the input window; their failure traces remain in the folder. The completed proof removes that command startup delay without changing the simulation clock or gameplay state.

The implementation follows [Teaching v3](teaching-v3-design.md). The wider Windows harness limitations below remain unchanged; the full repository suite is not claimed green.

## Teaching v2: historical evidence

The safe-floor and dynamic-marker correction passed all 81 focused tutorial, rhythm, mode, floor, explosion, attack-speed, invincibility and release tests. TypeScript and type discipline passed with zero findings. The production build, cache-header checks and phase-code check passed.

Behavior tests manually move to ranged positions `(9,3)` and `(3,2)`, and melee positions `(3,3)` and `(7,3)`. Each receives a neighboring safe STEP from its actual location and earns a clean dodge/attack pair. Native marker positions match public guide observations. Tests cover every tick through both style changes in all modes, nearest positioning from an alternate location, restart, real floor damage on unsafe tiles, and ordinary practice behavior.

The real-input browser proof passed all of these checks:

- The introduction waited with the world paused and no encounter ticks advancing.
- Start, Pause and Resume used the visible buttons, and paused encounter time stayed fixed.
- Thirty live STEP cues guided actual one-tile clicks. Each gold boss label was clicked at the point actually painted on the canvas, rather than a guessed ground coordinate.
- All thirty pairs earned real `clean-pair` feedback, including the odd-count transition into melee.
- Blue positioning cues moved between the current location and a nearby safe tile in both directions at ticks 35 and 70.
- Both marker tiles and the player's position stayed on the correct safe side. No floor-hit events occurred through the loop or subsequent recovery.
- Deliberately omitting the attack produced `dodge-without-attack`.
- Deliberately omitting the next step produced `hit`.
- Moving too far produced `moved-too-far`. The next STEP followed the new player location; following it and clicking the actual boss label earned another clean pair, for 31 clean pairs total.
- Leaving the lesson restored ordinary practice and removed tutorial status.
- No page errors were recorded.

Screenshots, input-state snapshots and `verdict.json` are in `.verify/local-rhythm/tutorial/`. The reproducible driver is `scripts/verify-tutorial-browser.mjs`. Its only evaluated page code reads state and observes canvas text positions. Every movement, attack and lesson control uses real mouse input.

The final lesson display separates static mode controls from the fast action cue, preventing the older 300 ms rhythm banner from contradicting the next-tick instruction. Paused instructions explicitly ask the learner to Resume rather than continuing to say click now.

Current visual review checked ranged markers outside the central void, melee markers on the safe rim, and the changed HERE/STEP positions after manual movement. The original tutorial's narrower-screen review is historical evidence in `narrow-step.png` and `final-ui-paused.png`; the correction's live captures include `pair-2-step.png`, `pair-17-step.png` and `dynamic-step-after-moving-away.png`.

The wider repository's two Windows harness limits remain as recorded in `docs/local-rhythm-verification.md`. This version does not claim the full platform-specific suite is green.

## Design principles

Model the Domain keeps next-tick actions and actual feedback typed. Boundary Discipline reuses the URL parser and public trainer start/stop controls. Test Behavior, Not Implementation verifies clicks against real outcomes through the public region interface. Laziness Protocol reuses native marker geometry and the existing combat rules. The final implementation follows `docs/tutorial-design.md`.
