# Archive Ocellus Trainer

A free practice simulator for phase 4 of the Ocellus fight in The Fractured Archive.

**Status: early development.** Mechanics come from the community wiki and release-day reports. Timings are unverified and will change.

Play it at https://archive-ocellus-trainer.raid-sims.workers.dev. Add `?invincible=on` to the link to practise without dying, or open **Settings** in the game and tick **Invincible**. Pick a single mechanic to drill from **Focus** in the same menu. Hold Control while clicking a tile to walk there instead of running, as in game.

Built on [osrs-sdk](https://github.com/OldSchoolSDK/osrs-sdk), following the layout of [ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer).

## Local rhythm practice

The version before the teaching aid is saved at Git tag `practice-v1-15-beats` on branch `codex/rhythm-practice`. A frozen playable copy is in the workspace's `saved-versions/rhythm-practice-v1/` folder. Open **Open saved practice v1.cmd** in the workspace to run that copy on port 8004.

Use the **Mode** button in the practice banner to cycle between **Alternating 15**, **Ranged only**, and **Melee only**. Changing mode restarts the drill. Each set has fifteen beats and the same short preparation window. **Restart** keeps your selected mode.

Double-click **Start rhythm practice.cmd** on Windows. It starts the local trainer and opens `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on`. The trainer alternates fifteen ranged explosion beats and fifteen melee beats, with a three-second preparation window before each set. The floor and gear change automatically. Mistakes do not end practice, and the boss cannot die.

Click an adjacent tile to step one tile as the explosion marks, then click Ocellus to attack. Repeat every two ticks. Movement and attacks remain manual. A two-tile move avoids damage but does not earn the attack-speed bonus. The floor is visual in this mode, so you can stay beside the boss for both weapons. The purple explosion draws 35% smaller while its marked tile and timing remain unchanged.

For a fresh Windows checkout, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1` once. This installs a project-local Node 22 runtime, the locked dependencies, the pinned SDK, and the public trainer's cache-2746 runtime assets. Git for Windows and npm must already be installed. Generated assets and the local runtime stay ignored. The asset checker fails if the public deployment no longer matches this checkout. The original cache-extraction workflow below remains available.

## Teaching version

Double-click **Start teaching version.cmd**, or open `http://127.0.0.1:8002/?focus=rhythm-loop&invincible=on&tutorial=on`. Read the short introduction and click **Start guided practice**. Follow the green STEP tile, then the gold ATTACK cue on the boss. The markers follow your current position and select a safe neighboring tile. Feedback reports actual successful step-and-attack pairs, missing attacks, late steps and moves that went too far. Pause and Resume let you stop to read. The mode button still selects alternating, ranged-only or melee-only practice.

Ranged steps stay outside the central square; melee steps stay on its safe inner rim. Between sets, the lesson waits on clear floor while you follow the blue positioning cue to a nearby safe tile. It starts the full count-in when you are ready. Leaving safe floor during the count-in resets it. Active sets run at normal speed with the existing floor-damage, movement and attack-delay rules.

The floor display replaces the millisecond bar. An amber TARGET preview counts toward your movement deadline; a red IMPACT border stays on the actual marked tile and counts toward the burst. Move on green STEP before the mark locks. If you are still on a locked tile, that hit is committed: follow the next STEP to recover.

After a mistake, the coach guides the next safe step and attack while the set continues. Reaching safe floor alone does not confirm recovery. **Back in rhythm** appears after an actual successful dodge-and-attack pair without floor damage. Click **Metronome: Off** to enable optional low STEP and high ATTACK tones. It starts off each time you open the lesson and stays silent while paused or positioning.

The compact panel keeps the current phase and beat visible. Its source is developed on `codex/rhythm-tutorial`. Ordinary practice remains available with `tutorial=off` or no tutorial option. Earlier lesson snapshots are saved at tags `teaching-v1`, `teaching-v2` and `teaching-v3`.

## Development

Requires Node 22.

```sh
npm ci
scripts/install-beta-sdk.sh     # beta osrs-sdk packages, installed without saving; rerun after any npm ci
npm run assets -- --cache-dir <openrs2 cache dir> --reader-path <osrscachereader checkout>
npm start                       # http://127.0.0.1:8002
```

`npm run assets` extracts models from OpenRS2 cache 2746 into `public/osrs-assets/`, which is never committed. It then draws an inventory icon for each of the trainer's own items, and for the Masori (f) pieces and Zaryte vambraces, from the item's model in the same cache, the way the game client draws it, into `public/osrs-assets/item-icons/`, and writes the boss's overhead icons from the cache's sprite index into `public/osrs-assets/sprites/`. `npm run item-icons` with the same two options redraws only the icons. `npm start` and `npm run build` first run `src/assetBundle/check.ts`, which fails and names each missing key when `public/osrs-assets/` comes from another cache or lacks an asset that `src/assets.ts` configures: in `build-info.json`, in `manifest.json`, as a payload file the manifest names, or in the sound pack. The page logs one `assets:` console error for each configured NPC, model or spotanim its served manifest lacks. The icon renderer in `src/itemIcons/` is ported from RuneLite's cache tool under its BSD 2-clause licence.

## Review

Read [CODE_REVIEW.md](CODE_REVIEW.md) before you review a change. It lists the performance red flags and explains `scripts/verify.sh perf`, which measures draw calls, canvas size, GPU resource growth, frame time and tick timing against the budgets in `src/perf/perfGate.json`.

## Releases

Each pull request that changes what players see adds one plain-language line to `src/content/ocellus/changelog.ts`. The line goes in the newest release if that release has not shipped yet. Otherwise it goes in a new release, versioned by the day it ships: `YYYY.MM.DD`, or `YYYY.MM.DD.2` for a second release that day. Players read the notes under **Settings**, then **What's new**, and `node scripts/release-notes.mjs` prints the newest release as Markdown for a GitHub release.

## Privacy

To find what causes lag, a sample of runs sends one anonymous performance summary when the run ends or the page is hidden mid-run. It holds the frame and tick timings, the view (always 3D), the screen scale and game size rounded to 50 pixels, the CPU core count, the graphics card family (such as `nvidia` or `apple`, never the full name), the browser family, the app version, the phase and how the run ended. It carries no ID, sets no cookie and stores nothing that identifies a player, and the trainer's code does not store IP addresses. Page views are counted with Cloudflare Web Analytics, which sets no cookies. Web Analytics loads on every page view unless you opt out. Only the performance summary is sampled. To turn both off, open **Settings** and untick **Send anonymous performance data**. The choice is saved in the browser. The summary stops at once, and page view counting stops from the next page load.

The share of runs that send a summary is `sampleRate` in `src/telemetry.json`, served as `/telemetry.json`. The Worker in `src/worker/worker.ts` accepts summaries at `/t` and writes each one to Workers Analytics Engine. `scripts/perf-report.mjs` summarises them.

Until the Analytics Engine dataset and Web Analytics are set up, releases send nothing. `sampleRate` is 0, the build runs without `CF_WEB_ANALYTICS_TOKEN`, and `npx wrangler deploy --config wrangler.release.jsonc` deploys the Worker without its `PERF` binding, so `/t` answers 204 and stores nothing.

## Credit

Made by Julian Dasilva / Moarhots ([@ShadowJdas](https://x.com/ShadowJdas) on X), with help from [Alessandro Rodi](https://github.com/alessandrorodi).

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

Game models are extracted, and item icons drawn, from the game cache at build time. Neither is stored in this repository.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
