export function practiceEntry(current: URL): URL {
  if (current.pathname !== "/" || current.search !== "") return current;
  const entry = new URL(current.href);
  entry.search = "focus=rhythm-loop&invincible=on&tutorial=on&lessonMode=unlimited&rhythmMode=ranged";
  return entry;
}
