# Local rhythm practice

The player practises fifteen ranged explosion beats and fifteen melee beats repeatedly, separated by five preparation ticks. Gear switches automatically, the floor changes with the style, and mistakes do not end practice.

## Sub-features

- `rhythm-loop` alternates fifteen ranged and fifteen melee explosion opportunities.
- `rhythm-prepare` clears the floor, switches gear and blocks filler attacks during preparation.
- `rhythm-cadence` preserves the original one-tile dodge reward and two-tick attack cadence.
- `rhythm-endless` prevents player and boss death from ending practice.
- `rhythm-mode` cycles the banner button through alternating fifteen-beat sets, ranged only and melee only. Restart keeps the selected mode.

## How to get to it (user POV)

Open `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on`, select **Rhythm Loop** in **Settings**, or double-click **Start rhythm practice.cmd** on Windows.

Click **Mode: Alternating 15** in the banner to select **Ranged only**, click again for **Melee only**, and click again to restore the default. A mode change starts fresh preparation. Links also accept `rhythmMode=ranged` or `rhythmMode=melee`.

## Driving it with agent-browser

Preconditions: this checkout's local server is running on port 8002 and the public P4 asset bundle passes the real asset check. The project-local Node and agent-browser are installed.

- Run `.local-tools/node_modules/node/bin/node.exe scripts/verify-rhythm-browser.mjs`. It opens an isolated named browser, sends real mouse input, and writes screenshots, read-only snapshots and a fight log to `.verify/local-rhythm/browser/`.
- Each mark tick gets a one-tile step followed by a click on the visible boss body. The expected ranged launch ticks are `[6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34]`. The expected melee launch ticks are `[41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69]`.
- Read `verdict.json` and `page-errors.json`. A pass requires all thirty impacts to report `dodged`, the exact launch ticks above and no page errors.
- Run `.local-tools/node_modules/node/bin/node.exe scripts/verify-rhythm-modes-browser.mjs` to click all three mode states, watch each single style repeat through the next set, and verify Restart retains melee-only mode. Captures and the verdict are in `.verify/local-rhythm/modes/`.

## Gotchas

The hovering boss's ground tile is not a reliable click target in 3D. Click the visible body. The floor is visual in this mode. Both weapons can reach from the initial north edge. The fifteen opportunities continue even if the player misses an attack. Two-tile movement avoids the hit without granting the speed bonus.
