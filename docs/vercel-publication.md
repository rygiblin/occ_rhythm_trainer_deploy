# Vercel publication

This checkout publishes the rhythm-practice derivative to `ryansgiblin/occ_rhythm_trainer`. The original implementation and Git history are retained, with the original repository configured locally as `upstream`. The existing local preview and saved practice versions remain in their original checkout.

## Design and build contract

The delivered artifact is the static `dist/` directory. React and the simulator run in the browser. Vercel does not need a gameplay server, a function, Supabase, credentials or environment variables. Survival bests remain in each browser's local storage.

Two independent design reviews considered full cache extraction and downloading the original deployment's validated runtime bundle. The latter reuses the existing lightweight setup. The SDK installer still fetches and verifies its exact Git commit. `npm ci` runs before it because the three SDK packages are installed without saving them in the lockfile.

`vercel.json` records the install command, build command and output directory. The build downloads generated assets, checks types, validates required asset coverage, bundles the app and runs the existing bundle checks. Vercel headers separately express the content-hash caching rules; the Cloudflare `_headers` check alone does not verify Vercel behavior. There is no catch-all rewrite: missing assets must return a real missing-file response.

Only a URL without a query receives the default guided Unlimited ranged settings at the browser entry point. Explicit mode links keep their existing behavior. No fight timing or movement rules change.

## Throughput checkpoint

The blocking first steps were inspecting the empty target repository and checking a fresh dependency/SDK install. Independent workstreams covered build reproducibility and hosting/entry behavior. One implementation owner changes the Vercel configuration and browser entry; the parent owns repository metadata, documentation, workflows, verification and publication. All work happens in a separate publishing checkout. The original working preview is not shared mutable state.

The smallest safe decomposition is a single static build contract, a browser-entry default, and publication instructions. Existing asset/SDK installers and gameplay stay in place. The previous comprehensive workflows remain available manually; the new push/PR workflow exercises the Vercel build and unit suite.

## External asset dependency

`npm run practice:assets` downloads cache-2746 runtime files from the original trainer's public deployment. It checks cache identity, byte counts and content hashes for binary models; the production build checks configured asset coverage. These files are served from this site's own deployment at runtime, so players do not fetch models from the upstream host while playing.

The upstream download source is mutable. A future missing or incompatible bundle can break a new build, while an already-built deployment keeps its bundled files. For an independent rebuild, use the existing cache extraction process documented in the README, with OpenRS2 cache 2746 and the pinned SDK. Do not commit extracted assets or models.

## Principles

Laziness Protocol keeps the existing SDK and asset scripts. Boundary Discipline validates external build inputs before bundling. Minimize Reader Load keeps the hosting contract in `vercel.json` and the player settings in the entry point. Prove It Works requires a fresh install and a served production bundle before publishing.

## Publication verification

Verified from the separate checkout without existing dependencies or generated assets:

- Clean `npm ci` and a fresh build of all three SDK packages passed. The installer verified the exact pinned commit.
- The asset download wrote 117 generated runtime files and remained ignored by Git.
- Type checking passed with zero findings. The production build, configured asset guard, existing cache-header guard and disabled-phase bundle check passed.
- The configured fields validated against Vercel's official JSON schema. `@vercel/routing-utils` 6.6.0 transformed the header rules without errors; checking every generated file found 361 correctly immutable files and revalidating HTML/manifest/config routes. An explicit extension pattern covers JavaScript source maps across matcher versions.
- The static production bundle on a separate port opened the bare URL as guided Unlimited ranged practice. Starting the lesson loaded its positioning state. An explicit Survival melee URL retained its parameters and loaded the matching introduction. Runtime asset requests had no HTTP errors and the browser reported no page errors. The new source link points to this repository.
- The 22 affected entry, credit, release-note and telemetry tests passed after updating the telemetry fixture to the current release version.
- The broader Windows run reported 478 passing tests, two failing assertions and an asset-check suite setup failure. One assertion was the stale release fixture, now fixed and rechecked. The remaining limitations are the existing Windows symlink privilege requirement in `assetBundle/check.test.ts` and virtual-file path handling in the schedule type fixture. This is not a claim that the full Windows suite passed. The new GitHub workflow runs the full suite on Linux.
- Independent source review found a missing manual-workflow base reference; the dispatch now requires a base input and uses it consistently. The final review and whitespace check passed.

Evidence stays in ignored `.verify/` and verification logs. No extracted game assets, local runtime, dependency tree, browser captures or credentials are included in the published source.
