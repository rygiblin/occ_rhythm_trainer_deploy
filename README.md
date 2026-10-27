# Ocellus Rhythm Trainer

Free two-tick ranged and melee practice for the final phase of Ocellus in The Fractured Archive. This is a rhythm-focused derivative of [ArchiveOcellusTrainer](https://github.com/Julian-Dasilva/ArchiveOcellusTrainer), with guided tile markers, recovery feedback, Unlimited practice and Survival attempts.

**Mechanics and timings are unverified approximations.** Use this to practise movement and attack rhythm.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project**, then import [`rygiblin/occ_rhythm_trainer_deploy`](https://github.com/rygiblin/occ_rhythm_trainer_deploy).
2. Keep the repository root as the Root Directory and select **Other** for Framework Preset. Node.js must be **22.x**.
3. Keep the commands supplied by `vercel.json`, then deploy. No environment variables or database are required.

| Setting | Value |
| --- | --- |
| Install Command | `npm ci --no-audit --no-fund && bash scripts/install-beta-sdk.sh` |
| Build Command | `npm run practice:assets && npm run typecheck && npm run build` |
| Output Directory | `dist` |

Share the resulting Vercel URL. Opening it without query parameters starts the guided **Unlimited / Ranged** introduction. Change **Session** and **Style** in the trainer; the URL records the selected mode so it can be shared. Later pushes to `main` deploy automatically once the Vercel Git integration is connected.

This is a static browser application. Vercel hosts the built files; there is no gameplay backend and no Supabase requirement. Survival bests are saved separately for ranged and melee in each browser.

## Practice

Read the introduction and click **Start guided practice**. Follow the blue positioning marker to safe floor, then the green **STEP** tile and gold **ATTACK** cue on Ocellus. Movement and attacks remain manual. Step exactly one tile to earn the attack-speed bonus; moving two tiles can avoid damage but does not earn that bonus. Hold Control while clicking to walk.

- **Unlimited:** one selected style continues without set breaks. Mistakes do not end the session.
- **Survival:** the same continuous rhythm, ending on the first impact-tile hit. Retry keeps your style and best completed time. The timer excludes positioning, count-in and pauses.
- **15-hit sets:** alternate fifteen ranged and fifteen melee beats, or keep a single style, with a preparation window between sets.

The amber **TARGET** preview shows when your current tile will be marked. The red **IMPACT** border stays on the locked tile until its burst. A locked hit is already committed; follow the next safe step and attack to recover. **Back in rhythm** confirms an actual successful dodge-and-attack pair without floor damage. Optional metronome tones distinguish the step and attack beats.

Ranged steps stay outside the central square; melee steps stay on its safe inner rim. Damage from the wrong floor still matters for coaching, but only impact-tile damage ends Survival. Avoided impacts and successful step-and-attack pairs have separate counters.

Explicit query links remain supported, for example:

```text
/?focus=rhythm-loop&invincible=on&tutorial=on&lessonMode=survival&rhythmMode=melee
/?focus=rhythm-loop&invincible=on&tutorial=on&lessonMode=unlimited&rhythmMode=ranged
/?focus=rhythm-loop&invincible=on&lessonMode=sets&rhythmMode=alternating
```

## Local development

Requires Node 22, npm and Git with Bash. From a fresh checkout:

```sh
npm ci --no-audit --no-fund
bash scripts/install-beta-sdk.sh
npm run practice:assets
npm start
```

Open `http://127.0.0.1:8002/`. On Windows, `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1` installs a project-local Node 22 runtime as well. Then double-click **Start teaching version.cmd** or **Start rhythm practice.cmd**.

```sh
npm run typecheck
npm test
npm run build
```

The SDK is pinned to an exact Git commit in `scripts/install-beta-sdk.sh`; its three packages are installed without saving them. Rerun that installer after every `npm ci`.

Generated models, icons, sounds and bundles are excluded from Git. `practice:assets` downloads cache-2746 runtime assets from the [original public trainer](https://archive-ocellus-trainer.raid-sims.workers.dev). It validates cache identity, file sizes and binary content hashes; the build then checks the configured asset requirements. The finished deployment serves these files itself. A future change to the original asset host can break a new build; existing deployments keep their bundled files.

For independent asset extraction, use OpenRS2 cache 2746 and a cache reader with the `EntityOpsDecoder.decodeSubOp` fix:

```sh
npm run assets -- --cache-dir <cache-directory> --reader-path <osrscachereader-checkout>
```

`scripts/netlify-build.sh` retains the upstream full-cache build recipe and pinned reader revision as a reference. Do not commit extracted assets or models.

## Project layout and verification

`src/` contains the browser app and simulator, `scripts/` contains setup and verification, `public/osrs-assets/` is generated, and `dist/` is the deployable static site. `vercel.json` is the hosting configuration. The original Cloudflare and Netlify files remain as upstream references; Vercel does not use them.

The **Vercel build** GitHub Actions workflow runs the hosting build and unit suite on pushes and pull requests. The original comprehensive and performance workflows are manual-only. Read [CODE_REVIEW.md](CODE_REVIEW.md), the [verification skill](.claude/skills/verify-archive-ocellus/SKILL.md), and the [publication design](docs/vercel-publication.md) for the broader checks and build limitations.

Historical checkpoints remain available as Git tags: `practice-v1-15-beats` and `teaching-v1` through `teaching-v5`. The current teaching implementation includes the Unlimited and Survival modes from `teaching-v5`.

## Privacy

This Vercel configuration has anonymous performance sampling disabled (`src/telemetry.json` sets `sampleRate` to 0), no Cloudflare analytics token and no telemetry backend. It does not send gameplay performance summaries or load Cloudflare Web Analytics. Settings and Survival bests are stored locally in your browser. Vercel may maintain its standard hosting request logs.

## Credit and licence

Original trainer made by Julian Dasilva / Moarhots ([@ShadowJdas](https://x.com/ShadowJdas)), with help from [Alessandro Rodi](https://github.com/alessandrorodi). This repository adapts it for focused rhythm practice and teaching.

Built on [osrs-sdk](https://github.com/OldSchoolSDK/osrs-sdk), following the layout of [ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer). The inventory icon renderer is ported from RuneLite's cache tool under its BSD 2-clause licence.

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

Keep this project free: no ads, donations or paid features. Game models are extracted, and item icons drawn, from the game cache at build time. Neither is stored in this repository.

GPL-3.0-only. See [LICENSE](LICENSE). The original Git history and attribution are retained.
