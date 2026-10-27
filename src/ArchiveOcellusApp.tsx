import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CacheRender, ControlPanelController, SETTINGS_STORAGE_KEY, Settings, SoundCache, TrainerInstance, TrainerLoadingState, Viewport } from "osrs-sdk";
import type { Item, SettingsState } from "osrs-sdk";
import { GameOverlay, TrainerApp, TrainerLoadingSplash, useSettingsSnapshot } from "osrs-sdk-react";
import { OcellusRegion } from "./content/ocellus/js/OcellusRegion";
import type { P3Region } from "./content/ocellus/js/P3Region";
import type { P1Region } from "./content/ocellus/js/P1Region";
import type { P2Region } from "./content/ocellus/js/P2Region";
import type { DrillConfig, LessonMode, P1Config, P2Config, P3Config, RhythmMode } from "./content/ocellus/js/OcellusTimings";
import { readSurvivalBest, rememberSurvivalBest } from "./survivalBest";
import { OCELLUS_P4, parseRequest } from "./content/ocellus/js/OcellusTimings";
import type { P3End, P3Log, P3Snapshot } from "./content/ocellus/js/P3Types";
import type { P2End, P2Log, P2Snapshot } from "./content/ocellus/js/P2Types";
import type { P1End, P1Log, P1Snapshot } from "./content/ocellus/js/P1Types";
import type { FightLog, FightSnapshot, RunEnd } from "./content/ocellus/js/P4Types";
import type { Tick } from "./sim/brands";
import type { BuildFlags } from "./flags";
import { onlyP4Playable, readBuildFlags } from "./flags";
import { CHANGELOG } from "./content/ocellus/changelog";
import type { ReleaseVersion } from "./releases";
import { releaseDate } from "./releases";
import { keepHoverTextOnCanvas } from "./hoverText";
import { loadWebAnalytics, perfDataAllowed, setPerfDataAllowed, startPerfTelemetry } from "./telemetry/perfTelemetry";
import { reportUnservedAssets } from "./assets";

keepHoverTextOnCanvas();
// Desktop browsers start the SDK's AudioContext suspended until a user gesture, and the SDK never resumes it.
window.addEventListener("pointerdown", () => void SoundCache.context?.resume(), { capture: true });
// Cache 2746 has no synth for three of phase 2's animation frame sounds (12814, 12825, 12832), and the SDK rejects a promise when a frame reaches one.
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason instanceof Error && /^Sound effect \d+ is not present in the runtime pack$/.test(event.reason.message)) event.preventDefault();
});

export const CREDIT_LINE =
  "Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.";
const MAKER = "Julian Dasilva / Moarhots";
const MAKER_LINKS: readonly Readonly<{ label: string; href: string }>[] = [
  { label: "GitHub", href: "https://github.com/Julian-Dasilva/ArchiveOcellusTrainer" },
  { label: "@ShadowJdas", href: "https://x.com/ShadowJdas" },
];
const CONTRIBUTOR: Readonly<{ name: string; href: string }> = { name: "Alessandro Rodi", href: "https://github.com/alessandrorodi" };

declare global {
  interface Window {
    __archiveOcellusProbe?: Readonly<{
      snapshot(): VerificationProbeSnapshot;
      log(): FightLog | P3Log | P2Log | P1Log;
      tileCentre(at: Readonly<{ x: number; y: number }>): Readonly<{ x: number; y: number }> | null;
    }>;
  }
}

type VerificationProbeSnapshot = Readonly<{
  ticking: boolean;
  tick: number;
  player: Readonly<{ x: number; y: number }> | null;
  destination: Readonly<{ x: number; y: number }> | null;
  fight: FightSnapshot | P3Snapshot | P2Snapshot | P1Snapshot | null;
  rejected: readonly string[];
  panel: Readonly<{ tab: string | null; keys: Readonly<Record<"inventory" | "spellbook" | "prayer" | "equipment" | "combat", string>> }>;
  menu: readonly string[] | null;
  icons: Readonly<Record<string, Readonly<{ path: string; size: string }>>>;
  tutorial: ReturnType<OcellusRegion["tutorialStatus"]>;
}>;

function drawnIcons(items: readonly (Item | null | undefined)[]): VerificationProbeSnapshot["icons"] {
  return Object.fromEntries(
    items.flatMap((item) => {
      if (!item || typeof item.cacheItemId !== "number" || !(item.inventorySprite instanceof HTMLImageElement)) return [];
      const { src, naturalWidth, naturalHeight } = item.inventorySprite;
      return [[item.cacheItemId, { path: new URL(src).pathname, size: `${naturalWidth}x${naturalHeight}` }]];
    }),
  );
}

type Drill =
  | Readonly<{ phase: "p4"; region: OcellusRegion; config: DrillConfig }>
  | Readonly<{ phase: "p3"; region: P3Region; config: P3Config }>
  | Readonly<{ phase: "p2"; region: P2Region; config: P2Config }>
  | Readonly<{ phase: "p1"; region: P1Region; config: P1Config }>;


function exposeVerificationProbe(trainer: TrainerInstance, region: Drill["region"], rejected: readonly string[]) {
  window.__archiveOcellusProbe = Object.freeze({
    snapshot(): VerificationProbeSnapshot {
      const { player, world } = trainer.getSnapshot();
      const { contextMenu } = Viewport.viewport;
      return {
        ticking: !world.isPaused,
        tick: world.globalTickCounter,
        player: player ? { x: player.location.x, y: player.location.y } : null,
        destination: player?.destinationLocation ? { x: player.destinationLocation.x, y: player.destinationLocation.y } : null,
        fight: region.snapshot(),
        rejected,
        panel: {
          tab: Object.entries(ControlPanelController.controls).find(([, control]) => control === ControlPanelController.controller.selectedControl)?.[0] ?? null,
          keys: { inventory: Settings.inventory_key, spellbook: Settings.spellbook_key, prayer: Settings.prayer_key, equipment: Settings.equipment_key, combat: Settings.combat_key },
        },
        menu: contextMenu.isActive ? contextMenu.menuOptions.map((option) => option.text.map((block) => `${block.text}`).join("")) : null,
        icons: player ? drawnIcons([...player.inventory, ...Object.values(player.equipment)]) : {},
        tutorial: region instanceof OcellusRegion ? region.tutorialStatus() : null,
      };
    },
    log: () => region.fightLog(),
    tileCentre: (at) => Viewport.viewport.projectTile(at, trainer.getSnapshot().world),
  });
}

const SOUNDS_START_ON = true;
const THREE_D_VIEW = { use3dView: true, rotated: "north" } as const;

type SoundChoice = Partial<Pick<SettingsState, "playsAudio" | "playsAreaAudio">>;

function savedSoundChoice(): SoundChoice {
  let stored: unknown;
  try {
    stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null");
  } catch {
    return {};
  }
  const values: unknown = typeof stored === "object" && stored !== null && "values" in stored ? stored.values : null;
  if (typeof values !== "object" || values === null) return {};
  return {
    ...("playsAudio" in values && typeof values.playsAudio === "boolean" && { playsAudio: values.playsAudio }),
    ...("playsAreaAudio" in values && typeof values.playsAreaAudio === "boolean" && { playsAreaAudio: values.playsAreaAudio }),
  };
}

function readSettings() {
  // The SDK saves its own off defaults on a first load and turns sound off on every mobile load, so the player's choice is read before it loads.
  const saved = savedSoundChoice();
  Settings.readFromStorage();
  Settings.set({ ...THREE_D_VIEW, playsAudio: saved.playsAudio ?? SOUNDS_START_ON, playsAreaAudio: saved.playsAreaAudio ?? SOUNDS_START_ON });
}

type Opened = Readonly<{ trainer: TrainerInstance; drill: Drill; flags: BuildFlags }>;
type Opening = Readonly<{ kind: "open"; opened: Opened }> | Readonly<{ kind: "loading"; opened: Promise<Opened> }>;

/** P1, P2 and P3 load behind a test of the raw build variable, which webpack folds, so a build with a phase off contains none of its modules. */
function openTrainer(): Opening {
  CacheRender.configure(new URL("osrs-assets/manifest.json", window.location.href).href);
  void CacheRender.bundle().then(({ manifest }) => reportUnservedAssets(manifest), (error: unknown) => console.error("assets: osrs-assets/manifest.json did not load", error));
  readSettings();
  const flags = readBuildFlags();
  const request = parseRequest(new URL(window.location.href), () => crypto.getRandomValues(new Uint32Array(1))[0], flags);
  const start = (drill: Drill): Opened => {
    drill.region.invincible = request.invincible;
    const trainer = new TrainerInstance(drill.region);
    if (process.env.NODE_ENV !== "production") exposeVerificationProbe(trainer, drill.region, request.rejected);
    loadWebAnalytics();
    if (drill.phase === "p4") void startPerfTelemetry(drill.region);
    return { trainer, drill, flags };
  };
  switch (request.phase) {
    case "p4":
      return { kind: "open", opened: start({ phase: "p4", region: new OcellusRegion(request.config), config: request.config }) };
    case "p3":
      return {
        kind: "loading",
        opened:
          process.env.ARCHIVE_P3 === "on"
            ? import("./content/ocellus/js/P3Region").then(({ P3Region }) => start({ phase: "p3", region: new P3Region(request.config), config: request.config }))
            : Promise.reject(new Error("this build has ARCHIVE_P3 off")),
      };
    case "p2":
      return {
        kind: "loading",
        opened:
          process.env.ARCHIVE_P2 === "on"
            ? import("./content/ocellus/js/P2Region").then(({ P2Region }) => start({ phase: "p2", region: new P2Region(request.config), config: request.config }))
            : Promise.reject(new Error("this build has ARCHIVE_P2 off")),
      };
    case "p1":
      return {
        kind: "loading",
        opened:
          process.env.ARCHIVE_P1 === "on"
            ? import("./content/ocellus/js/P1Region").then(({ P1Region }) => start({ phase: "p1", region: new P1Region(request.config), config: request.config }))
            : Promise.reject(new Error("this build has ARCHIVE_P1 off")),
      };
    default: {
      const unhandled: never = request;
      return unhandled;
    }
  }
}

const SETUP_KEYS = Object.keys(OCELLUS_P4.choices.setup.options);
const FOCUS_KEYS = Object.keys(OCELLUS_P4.choices.focus.options);
const label = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ");

const PHASES: readonly Readonly<{ phase: Drill["phase"]; label: string; shown: (flags: BuildFlags) => boolean }>[] = [
  { phase: "p4", label: "Phase 4", shown: () => true },
  { phase: "p3", label: "Phase 3", shown: (flags) => flags.p3 },
  { phase: "p2", label: "Phase 2", shown: (flags) => flags.p2 },
  { phase: "p1", label: "Phase 1", shown: (flags) => flags.p1 },
];

const phaseOf = (value: string): Drill["phase"] => PHASES.find(({ phase }) => phase === value)?.phase ?? "p4";

type RunRequest = Readonly<{ setup: string; seed: string | null; invincible: boolean }> &
  (Readonly<{ phase: "p4"; focus: string }> | Readonly<{ phase: "p3" }> | Readonly<{ phase: "p2"; skipTiles: boolean }> | Readonly<{ phase: "p1" }>);

function startRun(request: RunRequest) {
  const { setup, seed, invincible } = request;
  const url = new URL(window.location.href);
  url.searchParams.set("setup", setup);
  if (request.phase === "p4") url.searchParams.set("focus", request.focus);
  if (request.phase === "p2" && request.skipTiles) url.searchParams.set("markers", "skip-tiles");
  else if (request.phase === "p2") url.searchParams.delete("markers");
  if (seed !== null) url.searchParams.set("seed", seed);
  else url.searchParams.delete("seed");
  if (invincible) url.searchParams.set("invincible", "on");
  else url.searchParams.delete("invincible");
  window.location.assign(url.href);
}

/** The same phase again, keeping the setup, Invincible and the phase's own options; `focus` replaces P4's. */
function rerun(drill: Drill, setup: string, seed: string | null, focus: string | null = null): RunRequest {
  const { invincible } = drill.region;
  switch (drill.phase) {
    case "p4":
      return { phase: "p4", setup, focus: focus ?? drill.config.choices.focus.key, seed, invincible };
    case "p3":
      return { phase: "p3", setup, seed, invincible };
    case "p2":
      return { phase: "p2", setup, seed, invincible, skipTiles: drill.region.skipTilesShown() };
    case "p1":
      return { phase: "p1", setup, seed, invincible };
    default: {
      const unhandled: never = drill;
      return unhandled;
    }
  }
}

function startPhase(phase: Drill["phase"], setup: string, invincible: boolean) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("phase", phase);
  url.searchParams.set("setup", setup);
  if (invincible) url.searchParams.set("invincible", "on");
  window.location.assign(url.href);
}

const [LATEST_RELEASE] = CHANGELOG;
const SEEN_RELEASE_KEY = "archive-ocellus:seen-release";

function seenRelease(): string | null {
  try {
    return localStorage.getItem(SEEN_RELEASE_KEY);
  } catch {
    return null;
  }
}

function rememberSeenRelease(version: ReleaseVersion) {
  try {
    localStorage.setItem(SEEN_RELEASE_KEY, version);
  } catch {}
}

const UnseenDot = () => <span className="unseen_dot" role="img" aria-label="new" />;

type MenuView = "closed" | "settings" | "whats-new";

function DrillControls({ drill, flags }: Readonly<{ drill: Drill; flags: BuildFlags }>) {
  const { config, region } = drill;
  const [setup, setSetup] = useState<string>(config.choices.setup.key);
  const [typedSeed, setTypedSeed] = useState<string | null>(null);
  const [view, setView] = useState<MenuView>("closed");
  const [unseen, setUnseen] = useState(() => seenRelease() !== LATEST_RELEASE.version);
  const [sendsPerfData, setSendsPerfData] = useState(perfDataAllowed);
  const form = useRef<HTMLFormElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const whatsNewTitle = useRef<HTMLHeadingElement>(null);
  const { playsAudio, playsAreaAudio } = useSettingsSnapshot();
  const restart = (focus: string | null) => startRun(rerun(drill, setup, typedSeed?.trim() || null, focus));
  const phases = PHASES.filter(({ shown }) => shown(flags));
  const currentFocus = drill.phase === "p4" ? drill.config.choices.focus.key : null;

  const openWhatsNew = () => {
    rememberSeenRelease(LATEST_RELEASE.version);
    flushSync(() => {
      setView("whats-new");
      setUnseen(false);
    });
    whatsNewTitle.current?.focus();
  };

  const closeWhatsNew = () => {
    setView("closed");
    settingsButton.current?.focus();
  };

  useEffect(() => {
    if (view === "closed") return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (view === "whats-new") closeWhatsNew();
      else setView("closed");
    };
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !form.current?.contains(event.target)) setView("closed");
    };
    // Capture, because the seed box and the SDK canvas stop their events from bubbling.
    document.addEventListener("keydown", closeOnEscape, true);
    document.addEventListener("pointerdown", closeOutside, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape, true);
      document.removeEventListener("pointerdown", closeOutside, true);
    };
  }, [view]);

  return (
    <form id="drill_controls" ref={form} onSubmit={(event) => { event.preventDefault(); restart(currentFocus); }}>
      <div id="settings_menu" hidden={view !== "settings"}>
        {phases.length > 1 && (
          <label>
            Phase{" "}
            <select id="phase" value={drill.phase} onChange={(event) => startPhase(phaseOf(event.target.value), setup, region.invincible)}>
              {phases.map(({ phase, label: name }) => <option key={phase} value={phase}>{name}</option>)}
            </select>
          </label>
        )}
        <label>
          Setup{" "}
          <select id="setup" value={setup} onChange={(event) => setSetup(event.target.value)}>
            {SETUP_KEYS.map((key) => <option key={key} value={key}>{label(key)}</option>)}
          </select>
        </label>
        {currentFocus !== null && (
          <label>
            Focus{" "}
            <select id="focus" value={currentFocus} onChange={(event) => restart(event.target.value)}>
              {FOCUS_KEYS.map((key) => <option key={key} value={key}>{label(key)}</option>)}
            </select>
          </label>
        )}
        {drill.phase === "p2" && (
          <label>
            Skip tiles <input id="skip_tiles" type="checkbox" defaultChecked={drill.config.choices.markers.key === "skip-tiles"} onChange={(event) => drill.region.showSkipTiles(event.target.checked)} />
          </label>
        )}
        <label>
          Seed <input id="seed" inputMode="numeric" value={typedSeed ?? String(config.seed)} onInput={(event) => setTypedSeed(event.currentTarget.value)} onKeyDown={(event) => event.stopPropagation()} />
        </label>
        <button id="keybinds" type="button" onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>Keybinds</button>
        <label>
          Sound effects <input id="sound" type="checkbox" checked={playsAudio} onChange={(event) => Settings.set({ playsAudio: event.target.checked })} />
        </label>
        <label>
          Area sounds <input id="area_sound" type="checkbox" checked={playsAreaAudio} onChange={(event) => Settings.set({ playsAreaAudio: event.target.checked })} />
        </label>
        <label>
          Invincible <input id="invincible" type="checkbox" defaultChecked={region.invincible} disabled={currentFocus === "rhythm-loop"} onChange={(event) => { region.invincible = event.target.checked; }} />
        </label>
        <label>
          Send anonymous performance data <input id="perf_data" type="checkbox" checked={sendsPerfData} onChange={(event) => { setPerfDataAllowed(event.target.checked); setSendsPerfData(event.target.checked); }} />
        </label>
        <button id="whats_new" type="button" onClick={openWhatsNew}>What's new{unseen && <UnseenDot />}</button>
      </div>
      <section id="whats_new_panel" role="dialog" aria-labelledby="whats_new_title" hidden={view !== "whats-new"}>
        <h2 id="whats_new_title" ref={whatsNewTitle} tabIndex={-1}>What's new</h2>
        {CHANGELOG.map(({ version, notes }) => (
          <article key={version}>
            <h3><time dateTime={releaseDate(version)}>{version}</time></h3>
            <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </article>
        ))}
        <button id="whats_new_close" type="button" onClick={closeWhatsNew}>Close</button>
      </section>
      <button id="settings" ref={settingsButton} type="button" aria-expanded={view !== "closed"} aria-controls="settings_menu" onClick={() => setView((shown) => (shown === "closed" ? "settings" : "closed"))}>
        ⚙ Settings{unseen && <UnseenDot />}
      </button>
      <button id="restart" type="submit">Restart</button>
    </form>
  );
}

const SECONDS_TENTHS_PER_TICK = 6;

function gameTime(ticks: number): string {
  const tenths = ticks * SECONDS_TENTHS_PER_TICK;
  const minutes = Math.floor(tenths / 600);
  const seconds = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  return `${minutes}:${seconds}`;
}

type DrillOutcome =
  | Readonly<{ phase: "p4"; at: Tick; reason: RunEnd; invincible: boolean }>
  | Readonly<{ phase: "p3"; at: Tick; reason: P3End; invincible: boolean }>
  | Readonly<{ phase: "p2"; at: Tick; reason: P2End; invincible: boolean; bossMaxHp: number }>
  | Readonly<{ phase: "p1"; at: Tick; reason: P1End; invincible: boolean }>;

type InvincibleRegion = Readonly<{ invincible: boolean; fightLog(): Readonly<{ rows: readonly Readonly<{ events: readonly Readonly<{ kind: string }>[] }>[] }> }>;

const invincibleWasOn = (region: InvincibleRegion) => region.invincible || region.fightLog().rows.some((row) => row.events.some((event) => event.kind === "death-prevented"));

function outcome(drill: Drill): DrillOutcome | null {
  switch (drill.phase) {
    case "p4": {
      const run = drill.region.snapshot()?.run;
      if (run?.kind !== "ended") return null;
      return { phase: "p4", at: run.at, reason: run.reason, invincible: invincibleWasOn(drill.region) };
    }
    case "p3": {
      const run = drill.region.snapshot()?.run;
      if (run?.kind !== "ended") return null;
      return { phase: "p3", at: run.at, reason: run.reason, invincible: invincibleWasOn(drill.region) };
    }
    case "p2": {
      const run = drill.region.snapshot()?.run;
      if (run?.kind !== "ended") return null;
      return { phase: "p2", at: run.at, reason: run.reason, invincible: invincibleWasOn(drill.region), bossMaxHp: drill.config.choices.bossMaxHp.option.value };
    }
    case "p1": {
      const run = drill.region.snapshot()?.run;
      if (run?.kind !== "ended") return null;
      return { phase: "p1", at: run.at, reason: run.reason, invincible: invincibleWasOn(drill.region) };
    }
    default: {
      const unhandled: never = drill;
      return unhandled;
    }
  }
}

function RunTime({ phase, at, invincible }: Readonly<{ phase: "P1" | "P2" | "P3" | "P4"; at: Tick; invincible: boolean }>) {
  return (
    <>
      <p id="run_result_time">{phase} time: {at} ticks ({gameTime(at)})</p>
      {invincible && <p id="run_result_note">Invincible was on.</p>}
    </>
  );
}

function RunResultText({ result }: Readonly<{ result: DrillOutcome }>) {
  if (result.phase === "p2") {
    switch (result.reason.kind) {
      case "phase-cleared":
        return (
          <>
            <h2 id="run_result_title">Phase 2 cleared (interim end)</h2>
            <RunTime phase="P2" at={result.at} invincible={result.invincible} />
            <p id="run_result_boss">Ocellus goes into phase 3 at {result.reason.bossHp} / {result.bossMaxHp}.</p>
          </>
        );
      case "death":
        return (
          <>
            <h2 id="run_result_title">You died</h2>
            <p id="run_result_time">on P2 tick {result.at}</p>
          </>
        );
      default: {
        const unhandled: never = result.reason;
        return unhandled;
      }
    }
  }
  if (result.phase === "p1") {
    switch (result.reason.kind) {
      case "phase-cleared":
        return (
          <>
            <h2 id="run_result_title">Phase 1 cleared (interim end)</h2>
            <RunTime phase="P1" at={result.at} invincible={result.invincible} />
          </>
        );
      case "death":
        return (
          <>
            <h2 id="run_result_title">You died</h2>
            <p id="run_result_time">on P1 tick {result.at}</p>
          </>
        );
      default: {
        const unhandled: never = result.reason;
        return unhandled;
      }
    }
  }
  if (result.phase === "p3") {
    switch (result.reason.kind) {
      case "quadrant-cleared":
        return (
          <>
            <h2 id="run_result_title">Quadrant 1 cleared (interim end)</h2>
            <RunTime phase="P3" at={result.at} invincible={result.invincible} />
          </>
        );
      case "death":
        return (
          <>
            <h2 id="run_result_title">You died</h2>
            <p id="run_result_time">on P3 tick {result.at}</p>
          </>
        );
      default: {
        const unhandled: never = result.reason;
        return unhandled;
      }
    }
  }
  const { reason } = result;
  switch (reason) {
    case "kill":
      return (
        <>
          <h2 id="run_result_title">Ocellus defeated</h2>
          <RunTime phase="P4" at={result.at} invincible={result.invincible} />
        </>
      );
    case "death":
      return (
        <>
          <h2 id="run_result_title">You died</h2>
          <p id="run_result_time">on P4 tick {result.at}</p>
        </>
      );
    default: {
      const unhandled: never = reason;
      return unhandled;
    }
  }
}

const RESULT_POLL_MS = 300;

type InterimEnd = Readonly<{ repeat: string; next: Readonly<{ phase: Drill["phase"]; label: string }> | null }>;

/** A hidden drill that reaches its end offers the drill again and, when the build has it, the phase after. */
function interimEnd(result: DrillOutcome, flags: BuildFlags): InterimEnd | null {
  switch (result.phase) {
    case "p4":
      return null;
    case "p3":
      return result.reason.kind === "quadrant-cleared" ? { repeat: "Repeat P3", next: { phase: "p4", label: "Start P4" } } : null;
    case "p2":
      return result.reason.kind === "phase-cleared" ? { repeat: "Repeat P2", next: flags.p3 ? { phase: "p3", label: "Start P3" } : null } : null;
    case "p1":
      return result.reason.kind === "phase-cleared" ? { repeat: "Repeat P1", next: flags.p2 ? { phase: "p2", label: "Start P2" } : null } : null;
    default: {
      const unhandled: never = result;
      return unhandled;
    }
  }
}

function RunResultPanel({ drill, flags }: Readonly<{ drill: Drill; flags: BuildFlags }>) {
  const [result, setResult] = useState<DrillOutcome | null>(null);
  useEffect(() => {
    if (result) return;
    const poll = window.setInterval(() => {
      const ended = outcome(drill);
      if (ended) setResult(ended);
    }, RESULT_POLL_MS);
    return () => window.clearInterval(poll);
  }, [drill, result]);

  if (!result) return null;
  const { config, region } = drill;
  const setup = config.choices.setup.key;
  const again = (seed: string | null) => startRun(rerun(drill, setup, seed));
  const interim = interimEnd(result, flags);
  const next = interim?.next ?? null;
  return (
    <section id="run_result" role="dialog" aria-labelledby="run_result_title">
      <RunResultText result={result} />
      <button id="result_restart" type="button" onClick={() => again(null)}>{interim?.repeat ?? "Restart"}</button>
      <button id="result_retry" type="button" onClick={() => again(String(config.seed))}>Retry seed</button>
      {next !== null && <button id={`result_start_${next.phase}`} type="button" onClick={() => startPhase(next.phase, setup, region.invincible)}>{next.label}</button>}
    </section>
  );
}

const CHAT_LINES_SHOWN = 5;
const CHAT_POLL_MS = 300;

const RHYTHM_MODES: Readonly<Record<RhythmMode, Readonly<{ label: string; next: RhythmMode }>>> = {
  alternating: { label: "Alternating 15", next: "ranged" },
  ranged: { label: "Ranged only", next: "melee" },
  melee: { label: "Melee only", next: "alternating" },
};

function RhythmModeButton({ mode, continuous = false }: Readonly<{ mode: RhythmMode; continuous?: boolean }>) {
  const currentMode = RHYTHM_MODES[mode];
  const style = mode === "melee" ? "Melee" : "Ranged";
  const switchMode = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("rhythmMode", continuous ? mode === "melee" ? "ranged" : "melee" : currentMode.next);
    window.location.assign(url.href);
  };
  return <button id="rhythm_mode" type="button" onClick={switchMode} aria-label={continuous ? `Style: ${style}. Switch to ${style === "Ranged" ? "Melee" : "Ranged"}.` : `Practice mode: ${currentMode.label}. Switch to ${RHYTHM_MODES[currentMode.next].label}.`} title="Switching style starts fresh.">{continuous ? `Style: ${style}` : `Mode: ${currentMode.label}`}</button>;
}

const LESSON_MODES: Readonly<Record<LessonMode, Readonly<{ label: string; next: LessonMode }>>> = {
  sets: { label: "15-hit sets", next: "unlimited" },
  unlimited: { label: "Unlimited", next: "survival" },
  survival: { label: "Survival", next: "sets" },
};

function LessonModeButton({ mode, style }: Readonly<{ mode: LessonMode; style: RhythmMode }>) {
  const switchMode = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("lessonMode", LESSON_MODES[mode].next);
    if (LESSON_MODES[mode].next !== "sets" && style === "alternating") url.searchParams.set("rhythmMode", "ranged");
    window.location.assign(url.href);
  };
  return <button id="lesson_mode" type="button" onClick={switchMode}>Session: {LESSON_MODES[mode].label}</button>;
}

function RhythmBanner({ region, mode }: Readonly<{ region: OcellusRegion; mode: RhythmMode }>) {
  const [section, setSection] = useState(() => region.rhythmStatus());
  useEffect(() => {
    const poll = window.setInterval(() => setSection(region.rhythmStatus()), CHAT_POLL_MS);
    return () => window.clearInterval(poll);
  }, [region]);
  const style = section?.style === "melee" ? "Melee" : "Ranged";
  return (
    <div id="rhythm_banner" data-style={section?.style ?? "ranged"}>
      <strong>{section === null ? "Rhythm practice · Get ready" : section.kind === "prepare" ? `Next: ${style} · ${section.remaining} ticks` : `${style} · ${section.beat} / ${section.count}`}</strong>
      <span>Step one tile, then click Ocellus. Repeat every 2 ticks. Gear switches automatically.</span>
      <RhythmModeButton mode={mode} />
    </div>
  );
}

type TeachingStatus = NonNullable<ReturnType<OcellusRegion["tutorialStatus"]>>;

const TEACHING_FEEDBACK: Readonly<Record<NonNullable<TeachingStatus["feedback"]>, string>> = {
  "clean-pair": "Good: one-tile dodge and attack together.",
  "dodge-without-attack": "Good step. Click Ocellus on the gold ATTACK cue.",
  hit: "The step was missed or late. Move on green STEP, before the burst.",
  "moved-too-far": "You moved too far. Click the highlighted neighboring tile on green STEP.",
};

function teachingInstruction(cue: TeachingStatus["cue"]): string {
  switch (cue.kind) {
    case "prepare": return "GET READY";
    case "step": return "STEP ONE TILE";
    case "attack": return "ATTACK OCELLUS";
    case "return-to-pair": return "MOVE TO SAFE TILE";
    default: {
      const unhandled: never = cue;
      return unhandled;
    }
  }
}

function teachingHint(status: TeachingStatus): string {
  if (!status.safeFloor) return "Safe floor first. Click blue POSITION, then follow the next STEP.";
  if (status.threat.kind === "locked" && status.threat.playerOnMark) return "Too late for this hit—follow the next STEP. The red tile is already locked.";
  switch (status.cue.kind) {
    case "step": return "Click the green neighboring tile before the amber TARGET border runs out.";
    case "attack": return "Click the gold label on Ocellus. The red IMPACT tile is fixed until the burst.";
    case "return-to-pair": return `Click blue POSITION for ${status.lesson.style}: ${status.lesson.style === "ranged" ? "outside the central square" : "on the inner rim"}.`;
    case "prepare": return "Wait for TARGET, then STEP. The lesson counts in after safe positioning.";
    default: {
      const unhandled: never = status.cue;
      return unhandled;
    }
  }
}

function recoveryInstruction(status: TeachingStatus): string {
  if (!status.safeFloor) return "RECOVER · SAFE FLOOR FIRST";
  if (status.threat.kind === "locked" && status.threat.playerOnMark) return "HIT COMMITTED · PREPARE THE NEXT STEP";
  switch (status.recovery.kind) {
    case "recovered": return "Back in rhythm · successful dodge and attack";
    case "steady": return status.threat.kind === "preview" ? "Amber = move deadline · Red = impact" : "One safe step, then one attack.";
    case "recovering": return status.cue.kind === "return-to-pair" ? "RECOVER · SAFE POSITION FIRST" : status.cue.kind === "step" ? "RECOVER · STEP ONE TILE NOW" : status.cue.kind === "attack" ? "RECOVER · ATTACK NOW" : "RECOVER · FOLLOW THE NEXT STEP";
    default: {
      const unhandled: never = status.recovery;
      return unhandled;
    }
  }
}

function metronomeClick(action: "step" | "attack"): void {
  const context = SoundCache.context;
  if (!context || context.state !== "running") return;
  const sound = OCELLUS_P4.teaching.value.metronome;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = action === "step" ? sound.stepHz : sound.attackHz;
  gain.gain.setValueAtTime(sound.volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + sound.seconds);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start();
  oscillator.stop(context.currentTime + sound.seconds);
}

function RhythmTutorial({ trainer, region, ready, mode }: Readonly<{ trainer: TrainerInstance; region: OcellusRegion; ready: boolean; mode: RhythmMode }>) {
  const [lesson, setLesson] = useState<"intro" | "running" | "paused">("intro");
  const [metronome, setMetronome] = useState(false);
  const [status, setStatus] = useState(() => region.tutorialStatus());
  const selectedStyle = mode === "melee" ? "melee" : "ranged";
  const [best, setBest] = useState(() => readSurvivalBest(selectedStyle));
  const profile = status?.lessonMode ?? "sets";
  const attempt = status?.attempt;
  const failed = attempt?.kind === "failed";
  useEffect(() => {
    if (profile === "survival" && attempt?.kind === "failed") setBest(rememberSurvivalBest(selectedStyle, attempt.elapsed));
  }, [profile, attempt, selectedStyle]);
  useEffect(() => {
    if (ready) trainer.world.startLoop();
  }, [ready, trainer]);
  useEffect(() => {
    let lastTick = trainer.world.globalTickCounter;
    const poll = window.setInterval(() => {
      const current = region.tutorialStatus();
      setStatus(current);
      const worldTick = trainer.world.globalTickCounter;
      if (worldTick === lastTick) return;
      lastTick = worldTick;
      if (!metronome || lesson !== "running" || trainer.world.isPaused) return;
      if (current?.cue.kind === "step" || current?.cue.kind === "attack") metronomeClick(current.cue.kind);
    }, 25);
    return () => window.clearInterval(poll);
  }, [region, trainer, metronome, lesson]);
  const start = () => {
    if (!ready || failed) return;
    trainer.start();
    setLesson("running");
  };
  const pause = () => {
    if (failed) return;
    if (lesson === "paused") start();
    else {
      trainer.stop();
      setLesson("paused");
    }
  };
  const retry = () => {
    trainer.reset();
    setStatus(region.tutorialStatus());
    trainer.start();
    setLesson("running");
  };
  const leave = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("tutorial");
    window.location.assign(url.href);
  };
  const cue = status?.cue;
  const stage = status?.lesson;
  const style = stage?.style === "melee" ? "Melee" : "Ranged";
  const progress = stage?.kind === "practice" ? `${style} · Beat ${stage.beat}${stage.count === null ? "" : ` / ${stage.count}`}` : stage?.kind === "count-in" ? `${style} · Starts in ${stage.remaining}` : `${style} · Positioning · Floor clear`;
  return (
    <>
      {lesson === "intro" && (
        <div id="tutorial_intro" role="dialog" aria-modal="true" aria-labelledby="tutorial_title">
          <section>
            <p className="tutorial_eyebrow">GUIDED PRACTICE</p>
            <h2 id="tutorial_title">Learn the two-tick rhythm</h2>
            <p>{profile === "sets" ? "Fifteen-hit sets with breaks between styles." : profile === "unlimited" ? "Unlimited keeps your chosen style going without breaks and continues after hits." : "Survival ends on your first impact-tile hit. Try to beat your best time."}</p>
            <p>The guide follows your position. Ranged stays outside the central square; melee stays on its inner rim, beside Ocellus.</p>
            <ol>
              <li><b className="tutorial_step_colour">Green STEP:</b> click the highlighted tile to move one tile.</li>
              <li><b className="tutorial_attack_colour">Gold ATTACK:</b> click Ocellus's body.</li>
              <li>Repeat from wherever you stand safely. One click per tick: step, attack, step, attack.</li>
              <li><b className="tutorial_position_colour">Blue POSITION:</b> move to safe floor. The lesson waits, then counts into the next set.</li>
            </ol>
            <p>The amber TARGET border drains to your movement deadline. After the tile locks, its red IMPACT border drains to the burst; that countdown is already too late to escape from the marked tile.</p>
            <p>After a mistake, follow the next safe STEP, then ATTACK. A real successful pair confirms you are back in rhythm. The optional metronome uses low STEP and high ATTACK tones.</p>
            <LessonModeButton mode={profile} style={mode} />
            <RhythmModeButton mode={mode} continuous={profile !== "sets"} />
            <button id="tutorial_start" type="button" disabled={!ready} onClick={start}>{ready ? "Start guided practice" : "Loading practice…"}</button>
          </section>
        </div>
      )}
      {lesson !== "intro" && (
        <section id="tutorial_panel" data-action={failed ? "failed" : lesson === "paused" ? "paused" : cue?.kind ?? "prepare"}>
          <p className="tutorial_eyebrow">GUIDED PRACTICE</p>
          <LessonModeButton mode={profile} style={mode} />
          <RhythmModeButton mode={mode} continuous={profile !== "sets"} />
          <strong id="tutorial_cue">{failed ? "IMPACT HIT — RUN OVER" : lesson === "paused" ? "PAUSED" : cue ? teachingInstruction(cue) : "GET READY"}</strong>
          <p id="tutorial_progress">{progress}</p>
          {attempt && <p id="tutorial_attempt">Time {gameTime(attempt.kind === "waiting" ? 0 : attempt.elapsed)} · {attempt.kind === "waiting" ? 0 : attempt.survivedImpacts} impacts avoided · {attempt.kind === "waiting" ? 0 : attempt.cleanPairs} clean pairs</p>}
          {profile === "survival" && <p id="tutorial_best">Best {gameTime(best)} · {style}</p>}
          {profile !== "sets" && <p id="tutorial_session_hint">{profile === "survival" ? "An impact-tile hit ends the attempt." : "Unlimited continues after hits."}</p>}
          {failed && <p id="tutorial_failure">Impact hit—run over. Your score is saved; retry when ready.</p>}
          <p id="tutorial_recovery" data-recovery={failed ? "failed" : lesson === "paused" ? "paused" : status?.safeFloor === false || (status?.threat.kind === "locked" && status.threat.playerOnMark) ? "warning" : status?.recovery.kind}>{failed ? "Attempt finished" : lesson === "paused" ? "Cues paused" : status ? recoveryInstruction(status) : "Follow the next step."}</p>
          <p id="tutorial_hint">{failed ? "Press Retry survival to start a fresh count-in." : lesson === "paused" ? "Read the pattern, then press Resume when ready." : status ? teachingHint(status) : "Wait for the next cue."}</p>
          <div className="tutorial_beat"><span data-active={!failed && lesson === "running" && cue?.kind === "step"}>1 · STEP</span><span data-active={!failed && lesson === "running" && cue?.kind === "attack"}>2 · ATTACK</span></div>
          <p id="tutorial_feedback">{status?.safeFloor === false ? "You are on the damaging void floor. Move to blue POSITION." : status?.feedback ? TEACHING_FEEDBACK[status.feedback] : "Follow the cues. Feedback appears after each explosion."}</p>
          {profile === "sets" && <p id="tutorial_score">{status?.clean ?? 0} clean pairs / {status?.attempts ?? 0} attempts</p>}
          <div className="tutorial_controls">
            {failed ? <button id="tutorial_retry" type="button" onClick={retry}>Retry survival</button> : <button id="tutorial_pause" type="button" onClick={pause}>{lesson === "paused" ? "Resume" : "Pause"}</button>}
            <button id="tutorial_metronome" type="button" aria-pressed={metronome} onClick={() => setMetronome((on) => !on)}>Metronome: {metronome ? "On" : "Off"}</button>
            <button id="tutorial_leave" type="button" onClick={leave}>Practice without guides</button>
          </div>
        </section>
      )}
    </>
  );
}

function GameChat({ region }: Readonly<{ region: Readonly<{ chat(): readonly string[] }> }>) {
  const [lines, setLines] = useState<readonly string[]>([]);
  useEffect(() => {
    const poll = window.setInterval(() => setLines((shown) => {
      const latest = region.chat();
      return latest.length === shown.length ? shown : latest;
    }), CHAT_POLL_MS);
    return () => window.clearInterval(poll);
  }, [region]);

  return (
    <ol id="game_chat">
      {lines.slice(-CHAT_LINES_SHOWN).map((line, index) => <li key={index}>{line}</li>)}
    </ol>
  );
}

export function ArchiveOcellusApp() {
  const [opening, setOpening] = useState(openTrainer);
  useEffect(() => {
    if (opening.kind === "loading") void opening.opened.then((opened) => setOpening({ kind: "open", opened }));
  }, [opening]);
  return opening.kind === "open" ? <TrainerPage {...opening.opened} /> : null;
}

function TrainerPage({ trainer, drill, flags }: Opened) {
  const [loading, setLoading] = useState<TrainerLoadingState>();
  const teaching = drill.phase === "p4" && drill.region.tutorialEnabled();

  return (
    <TrainerApp trainer={trainer} autoStart={!teaching} onLoadingStateChange={setLoading}>
      <GameOverlay>
        <TrainerLoadingSplash state={loading} />
        {drill.phase === "p4" && drill.config.choices.focus.key === "rhythm-loop" && !teaching && <RhythmBanner region={drill.region} mode={drill.config.choices.rhythmMode.key} />}
        {drill.phase === "p4" && teaching && <RhythmTutorial trainer={trainer} region={drill.region} ready={loading?.status === "ready"} mode={drill.config.choices.rhythmMode.key} />}
        <div id="hud_corner">
          <GameChat region={drill.region} />
          <DrillControls drill={drill} flags={flags} />
          <footer id="credits">
            {onlyP4Playable(flags) && <p id="coming_soon">Phases 1 to 3 coming soon.</p>}
            <p id="maker_credit">
              Made by {MAKER}{" "}
              <span id="maker_links">
                {MAKER_LINKS.map((link, i) => (
                  <React.Fragment key={link.href}>
                    {i > 0 && " · "}
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  </React.Fragment>
                ))}
              </span>
              <span id="contributor_credit">
                With help from{" "}
                <a href={CONTRIBUTOR.href} target="_blank" rel="noopener noreferrer">
                  {CONTRIBUTOR.name}
                </a>
              </span>
            </p>
            <p id="trainer_source">
              <a href="https://github.com/rygiblin/occ_rhythm_trainer_deploy" target="_blank" rel="noopener noreferrer">Trainer source</a>
            </p>
            <p id="credit_line">{CREDIT_LINE}</p>
            <p id="app_version">v{LATEST_RELEASE.version}</p>
          </footer>
        </div>
        <RunResultPanel drill={drill} flags={flags} />
      </GameOverlay>
    </TrainerApp>
  );
}
