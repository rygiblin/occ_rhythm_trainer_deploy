import type { TickSpan } from "./sim/brands";
import { span } from "./sim/brands";

type SurvivalStyle = "ranged" | "melee";
const key = (style: SurvivalStyle) => `archive-ocellus:survival-best:${style}`;

export function readSurvivalBest(style: SurvivalStyle): TickSpan {
  try {
    const stored = localStorage.getItem(key(style));
    const value = stored === null ? 0 : Number(stored);
    return span(Number.isSafeInteger(value) && value >= 0 ? value : 0);
  } catch {
    return span(0);
  }
}

export function rememberSurvivalBest(style: SurvivalStyle, elapsed: TickSpan): TickSpan {
  const previous = readSurvivalBest(style);
  if (elapsed <= previous) return previous;
  const best = elapsed;
  try { localStorage.setItem(key(style), String(best)); } catch {}
  return best;
}
