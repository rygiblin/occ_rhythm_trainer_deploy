import { captureNavigation, loadPage } from "./page";

describe("rhythm mode button", () => {
  test.each([
    { query: "", label: "Alternating 15", next: "ranged" },
    { query: "&rhythmMode=ranged", label: "Ranged only", next: "melee" },
    { query: "&rhythmMode=melee", label: "Melee only", next: "alternating" },
  ])("$label switches to $next while preserving the practice link's other choices", ({ query, label, next }) => {
    const navigation = captureNavigation();
    const page = loadPage(`/?focus=rhythm-loop&seed=99&invincible=on&bosshp=1${query}`);
    expect(page.element("rhythm_mode").textContent).toBe(`Mode: ${label}`);
    expect(page.element("rhythm_mode").getAttribute("aria-label")).toContain(label);
    page.click("rhythm_mode");
    page.close();
    navigation.restore();
    expect(navigation.assigned).toHaveLength(1);
    const destination = new URL(navigation.assigned[0] ?? "http://localhost/");
    expect(Object.fromEntries(destination.searchParams)).toEqual({ focus: "rhythm-loop", seed: "99", invincible: "on", bosshp: "1", rhythmMode: next });
  });

  test("Restart keeps melee-only mode", () => {
    const navigation = captureNavigation();
    const page = loadPage("/?focus=rhythm-loop&rhythmMode=melee&seed=7");
    page.click("restart");
    page.close();
    navigation.restore();
    expect(navigation.assigned).toHaveLength(1);
    const destination = new URL(navigation.assigned[0] ?? "http://localhost/");
    expect(destination.searchParams.get("rhythmMode")).toBe("melee");
    expect(destination.searchParams.get("focus")).toBe("rhythm-loop");
  });

  test("an invalid mode falls back to the alternating button", () => {
    const page = loadPage("/?focus=rhythm-loop&rhythmMode=unknown");
    expect(page.element("rhythm_mode").textContent).toBe("Mode: Alternating 15");
    page.close();
  });
});
