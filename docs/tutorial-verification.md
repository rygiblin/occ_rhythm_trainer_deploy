# Teaching version verification

The saved original remains at tag `practice-v1-15-beats` and commit `1bd3ffcae0efc48c95c185430a185f425077724b`. Its frozen production build loads separately at `http://127.0.0.1:8004/?focus=rhythm-loop&invincible=on`. The saved browser preview loaded with the original mode button and no page errors. No generated assets were committed.

The teaching version is on `codex/rhythm-tutorial`, selected with `tutorial=on` on the development preview. It adds instructions and markers without changing the original movement, cooldown, explosion or invincibility rules.

## Behavioral evidence

The focused tutorial and existing rhythm/UI regression run passed all 32 tests. TypeScript and type discipline passed with zero findings. The production build and cache-header checks passed.

The real-input browser proof passed all of these checks:

- The introduction waited with the world paused and no encounter ticks advancing.
- Start, Pause and Resume used the visible buttons, and paused encounter time stayed fixed.
- Thirty live STEP cues guided actual one-tile clicks. Each gold boss label was clicked at the point actually painted on the canvas, rather than a guessed ground coordinate.
- All thirty pairs earned real `clean-pair` feedback, including the odd-count transition into melee.
- Deliberately omitting the attack produced `dodge-without-attack`.
- Deliberately omitting the next step produced `hit`.
- Moving two tiles produced `moved-too-far` and an instruction to return to tile A.
- Leaving the lesson restored ordinary practice and removed tutorial status.
- No page errors were recorded.

Screenshots, input-state snapshots and `verdict.json` are in `.verify/local-rhythm/tutorial/`. The reproducible driver is `scripts/verify-tutorial-browser.mjs`. Its only evaluated page code reads state and observes canvas text positions. Every movement, attack and lesson control uses real mouse input.

The final lesson display separates static mode controls from the fast action cue, preventing the older 300 ms rhythm banner from contradicting the next-tick instruction. Paused instructions explicitly ask the learner to Resume rather than continuing to say click now.

After that display cleanup, all 22 focused tutorial/navigation/release tests passed again, as did types, type discipline, the production build and both cache/phase checks. A real browser at 800 by 800 showed the STEP target and both labeled tiles clear of the responsive panels. The final paused panel displayed the Resume instruction correctly. Those additional captures are `narrow-step.png` and `final-ui-paused.png` in the tutorial evidence folder.

The wider repository's two Windows harness limits remain as recorded in `docs/local-rhythm-verification.md`. This version does not claim the full platform-specific suite is green.

## Design principles

Model the Domain keeps next-tick actions and actual feedback typed. Boundary Discipline reuses the URL parser and public trainer start/stop controls. Test Behavior, Not Implementation verifies clicks against real outcomes through the public region interface. Laziness Protocol reuses native marker geometry and the existing combat rules. The final implementation follows `docs/tutorial-design.md`.
