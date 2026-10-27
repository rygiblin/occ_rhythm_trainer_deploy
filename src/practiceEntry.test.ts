import { practiceEntry } from "./practiceEntry";

test("the bare site opens guided unlimited ranged practice and keeps its fragment", () => {
  const entry = practiceEntry(new URL("https://trainer.example/#help"));
  expect(entry.href).toBe("https://trainer.example/?focus=rhythm-loop&invincible=on&tutorial=on&lessonMode=unlimited&rhythmMode=ranged#help");
});

test.each([
  "https://trainer.example/?focus=rhythm-loop&tutorial=on&lessonMode=survival&rhythmMode=melee",
  "https://trainer.example/?seed=1",
  "https://trainer.example/?tutorial=off#settings",
  "https://trainer.example/other",
])("an explicit link keeps its requested options: %s", (href) => {
  expect(practiceEntry(new URL(href)).href).toBe(href);
});
