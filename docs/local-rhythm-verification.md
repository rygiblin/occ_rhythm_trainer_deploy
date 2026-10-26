# Local rhythm practice verification

The local trainer alternates fifteen ranged explosion opportunities and fifteen melee opportunities. Five preparation ticks separate sets. Gear switches automatically. The floor changes with the active style and clears during preparation. Movement and attacks stay manual. Mistakes and boss damage cannot end practice.

Open `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on`, or double-click `Start rhythm practice.cmd`. The server binds only to the local machine. The launcher verifies the recorded process, start time and checkout before reusing a server.

## Passed checks

The mode-button follow-up passes all 24 focused gameplay, navigation, restart and UI tests, plus type checks and the production build. Real browser clicks cycled from **Alternating 15** to **Ranged only**, then **Melee only**, then back to alternating. Each single style repeated into its second set with the correct weapon and floor. Restart retained melee-only mode. No page errors were recorded. Evidence is in `.verify/local-rhythm/modes/`.

The fifteen-beat follow-up passes build, type checks, 17 focused timing and UI tests, and both rendering-allocation checks. Real browser clicks produce thirty successful one-tile dodges with ranged launches at ticks 6 through 34 every two ticks and melee launches at ticks 41 through 69 every two ticks. The browser reports no page errors. The purple explosion geometry now draws at 65% of its authored dimensions, centered on the original tile. The camera, boss size, collision and attack timing remain unchanged.

The broader results below record the original six-beat version.

- The production build, cache-header validation and phase-code check passed.
- TypeScript and the repository's type-discipline check passed with zero findings.
- All 24 seeded ordinary fights matched the original checkout exactly. The base and modified dumps were produced with Windows-native Node commands and checked with the repository's parity judge.
- All 40 focused tests passed across rhythm practice, explosion timing, two-tick attack speed, invincibility and release-note UI.
- The broader Windows regression run passed 425 tests. Two test files had the platform limitations below.
- Real browser mouse clicks produced twelve successful one-tile dodges. Bow attacks launched at ticks 6, 8, 10, 12, 14 and 16. Scythe attacks launched at 23, 25, 27, 29, 31 and 33. The browser reported no page errors.
- The rendered browser showed the automatic bow-to-Scythe switch, the inner and outer floor changes, preparation, and progress. The banner sits beside the boss rather than over the boss's health bar.
- Code review found one launcher ownership issue. The launcher now verifies the running server's process and checkout. Review found no gameplay issue or new comment suppression.

Browser captures, input snapshots, the fight log and its verdict are in `.verify/local-rhythm/browser/`. Run the same real-input check with the project-local Node executable and `scripts/verify-rhythm-browser.mjs`. That script requires agent-browser 0.34 or later installed in `.local-tools/`.

## Windows verification limits

The original `scripts/verify.sh t0` recipe was attempted. Its parity stage invokes an npm shell shim through `node`, which fails on Windows, and Git Bash lacks `shasum` here. Native Windows commands cover build, types, tests and the passing 24-fight parity check instead.

`src/assetBundle/check.test.ts` cannot create its temporary `node_modules` symlink under this Windows account. The actual downloaded bundle passes the real asset checker and the production build. `src/sim/schedule.test.ts` has one failure in its generated TypeScript stage-name fixture. Its runtime schedule tests pass. The modified schedule and all rhythm behavior are covered by passing dedicated tests and the browser proof. The full suite is not claimed green.

## Design decisions

Model the Domain keeps preparation, style and beat progress derived from one timeline. Laziness Protocol keeps the original explosion resolver, movement and attack cooldown rules. Boundary Discipline keeps the Windows asset-path correction in configuration. Test Behavior, Not Implementation uses actual tile and boss clicks to prove attack cadence. The implementation follows the agreed design in `docs/local-rhythm-design.md`.

The mode button also follows Model the Domain by deriving schedule, gear and status from one readonly style order. Boundary Discipline uses the existing URL choice parser for mode validation. Mode selection restarts through navigation, avoiding mutable state inside an active explosion series.

The explosion renderer groups only explosion meshes under one shared scene. It scales each cached animation-frame geometry once, so repeated effects and restarts cannot shrink it again. This reduces the effect's dimensions without changing the world coordinates or camera.
