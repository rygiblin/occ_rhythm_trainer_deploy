import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHIVE_OCELLUS_SPRITES, ITEM_ICON_IDS, itemIconFile, spriteFile } from "../src/assets.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = resolve(root, "public/osrs-assets");
const source = new URL("https://archive-ocellus-trainer.raid-sims.workers.dev/osrs-assets/");

async function download(file, expectedBytes) {
  const target = resolve(output, file);
  if (!target.startsWith(`${output}/`) && !target.startsWith(`${output}\\`)) throw new Error(`Invalid asset path ${file}`);
  const response = await fetch(new URL(file, source));
  if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || (expectedBytes !== undefined && bytes.length !== expectedBytes)) throw new Error(`Wrong size for ${file}`);
  if (/^[a-f0-9]{64}\.bin$/.test(basename(file)) && createHash("sha256").update(bytes).digest("hex") !== basename(file, ".bin")) throw new Error(`Wrong hash for ${file}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

await download("manifest.json");
const manifest = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 3 || manifest.cache?.source !== "openrs2:2746" || typeof manifest.assets !== "object") throw new Error("The published bundle is not the expected cache-2746 asset bundle");
const files = new Map(Object.values(manifest.assets).map(({ file, bytes }) => [file, bytes]));
if (manifest.soundEffects) files.set(manifest.soundEffects.file, manifest.soundEffects.bytes);
files.set("build-info.json", undefined);
for (const id of ITEM_ICON_IDS) files.set(itemIconFile(id), undefined);
for (const sprite of ARCHIVE_OCELLUS_SPRITES) files.set(spriteFile(sprite), undefined);
const pending = [...files.entries()];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) await download(...next);
}));
console.log(`Downloaded ${files.size + 1} published assets into public/osrs-assets. Game assets remain untracked.`);
