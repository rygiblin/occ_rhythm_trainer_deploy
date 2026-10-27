import { span } from "./sim/brands";
import { readSurvivalBest, rememberSurvivalBest } from "./survivalBest";

describe("saved survival records", () => {
  beforeEach(() => localStorage.clear());

  test("completed records persist by style and shorter retries do not replace them", () => {
    expect(rememberSurvivalBest("ranged", span(40))).toBe(40);
    expect(rememberSurvivalBest("melee", span(20))).toBe(20);
    expect(rememberSurvivalBest("ranged", span(10))).toBe(40);
    expect(readSurvivalBest("ranged")).toBe(40);
    expect(readSurvivalBest("melee")).toBe(20);
    expect(localStorage.getItem("archive-ocellus:survival-best:ranged")).toBe("40");
  });

  test.each(["broken", "-1", "1.5", "Infinity"])("invalid stored record %s falls back to zero", (stored) => {
    localStorage.setItem("archive-ocellus:survival-best:ranged", stored);
    expect(readSurvivalBest("ranged")).toBe(0);
  });
});
