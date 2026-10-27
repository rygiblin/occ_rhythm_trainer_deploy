import type { Changelog } from "../../releases";

export const CHANGELOG: Changelog = [
  {
    version: "2026.10.26.7",
    notes: [
      "The site opens guided unlimited ranged practice by default while keeping the options in existing practice links.",
      "The footer links to this rhythm trainer's source alongside the original simulator credits.",
    ],
  },
  {
    version: "2026.10.26.6",
    notes: [
      "Unlimited practice keeps your selected ranged or melee rhythm running without fifteen-hit breaks.",
      "Survival training ends on the first impact-tile hit and tracks your time, avoided impacts and best completed run for each style.",
      "Choose continuous practice or the original fifteen-hit sets, and retry a Survival attempt from its result panel.",
    ],
  },
  {
    version: "2026.10.26.5",
    notes: [
      "Teaching mode shows the next target and locked impact directly on the floor instead of a millisecond bar.",
      "Recovery cues guide the next safe step and attack after a mistake, and confirm recovery from actual successful pairs.",
      "Inactive step markers disappear during impact so they cannot point back onto the dangerous tile.",
    ],
  },
  {
    version: "2026.10.26.4",
    notes: [
      "Guided sets wait on clear floor until you are safely positioned, then count into fifteen attacks at normal speed.",
      "A smaller teaching panel shows the current phase, beat and tick countdown, with an optional metronome.",
      "Positioning shows only the blue target, keeping inactive step labels out of the way.",
    ],
  },
  {
    version: "2026.10.26.3",
    notes: [
      "The teaching version labels two practice tiles and shows when to step and when to attack Ocellus.",
      "Start when ready, pause to read, and use feedback from your actual dodges and attacks to learn the rhythm.",
      "Teaching markers follow your position and point to a safe neighboring step, with a blue positioning cue when you need to change sides of the floor.",
    ],
  },
  {
    version: "2026.10.26.2",
    notes: [
      "Local rhythm practice repeats fifteen ranged beats and fifteen melee beats, with automatic gear changes and a short pause between sets.",
      "The purple explosion effect is 35% smaller, so the marked tile and your character are easier to see.",
      "The practice-mode button switches between alternating fifteen-beat sets, ranged only, and melee only.",
      "Windows players can open the local rhythm trainer with a double-click launcher after the local setup.",
    ],
  },
  {
    version: "2026.10.26",
    notes: [
      "The 2D view is gone, and the 3D view draws each frame in about 14 draw calls instead of about 550. Gear switches after your first hitch far less. A typical switch's slowest frame drops from about 50 ms to one frame at 60 Hz.",
      "The void shards of each explosion now come in high over your head, from the game's own effect, so you can see the cue to step while you move.",
      "Change your mind before the tick, like in game. Whatever you click last before the tick is what you do, even a click made right before it.",
      "Ocellus takes damage as soon as he is back on the platform, and standing on your lifeforce orb as it glows gives your HP back that tick.",
      "A void rift left alive bursts 30 ticks after it appears and hits you once for 28 to 41, and destroying a rift resets your attack timer.",
    ],
  },
  {
    version: "2026.10.25.1",
    notes: [
      "Melee attacks always hit a void rift for your max hit, as ranged attacks already did.",
      "A special attack, such as Ralos's Division, still rolls its damage against a void rift.",
    ],
  },
  {
    version: "2026.10.24",
    notes: [
      "Ocellus has 5,250 HP for a solo or duo team, as the wiki lists, so phase 4 starts at 1,312.",
      "While the void explosions are going off, Ocellus takes 60% less damage, as the wiki describes.",
      "The back wall by the brazier is one smooth diagonal up to the jut, so you walk along it instead of around each corner.",
    ],
  },
  {
    version: "2026.10.23",
    notes: [
      "Hold Control and click a tile to walk there instead of running, like in game.",
      "Healing orbs never form on void puddles. The outer orb forms opposite where you entered the 5x5, and the inner orb lingers into the attack you pray against.",
      "In the melee phase you path around Ocellus instead of running under him.",
      "The east edge by the brazier gets its extra tile: 3 straight tiles, then the diagonal.",
      "Void puddles start stacked in the same corner tiles you'd use in game.",
    ],
  },
];
