import type { defineConfig } from "osrs-sdk-assets";
import { ARCHIVE_OCELLUS_ASSETS, ARCHIVE_OCELLUS_OVERRIDES } from "./src/assets";

export default {
  cache: { openrs2: 2746 },
  assets: ARCHIVE_OCELLUS_ASSETS,
  overrides: ARCHIVE_OCELLUS_OVERRIDES,
  outDir: "./public/osrs-assets",
} satisfies Parameters<typeof defineConfig>[0];
