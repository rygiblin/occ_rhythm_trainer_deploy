import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { servedCache } from "./cacheHeaders";

const SHIPPED_HEADERS = readFileSync(resolve(__dirname, "../_headers"), "utf8");
const MODEL = "osrs-assets/0434a0d302a653af6bc959bfbd7ef8286b7c2eebc6da199e0b2e36800a61ad68.bin";

describe("_headers", () => {
  test("caches every content-hashed file for a year and leaves the page, manifests, icons and sprites mutable", () => {
    const files = [
      "index.html",
      "025083410fbfe0d5d502.png",
      "05799b199fc83cccd25d.ogg",
      "assets/main.6d4e9f0c1b2a3e4f5a6b.js",
      MODEL,
      "osrs-assets/manifest.json",
      "osrs-assets/item-icons/24419.png",
      "osrs-assets/sprites/440-11.png",
    ];

    expect(servedCache(SHIPPED_HEADERS, files).map(({ url, cacheControl, verdict }) => [url, cacheControl, verdict])).toEqual([
      ["/", null, "mutable"],
      ["/index.html", null, "mutable"],
      ["/025083410fbfe0d5d502.png", "public, max-age=31536000, immutable", "immutable"],
      ["/05799b199fc83cccd25d.ogg", "public, max-age=31536000, immutable", "immutable"],
      ["/assets/main.6d4e9f0c1b2a3e4f5a6b.js", "public, max-age=31536000, immutable", "immutable"],
      [`/${MODEL}`, "public, max-age=31536000, immutable", "immutable"],
      ["/osrs-assets/manifest.json", null, "mutable"],
      ["/osrs-assets/item-icons/24419.png", "public, max-age=86400", "mutable"],
      ["/osrs-assets/sprites/440-11.png", "public, max-age=86400", "mutable"],
    ]);
  });
});

describe("servedCache", () => {
  test("accepts Windows line endings in the build's headers file", () => {
    expect(servedCache("/*.png\r\n  Cache-Control: public, max-age=31536000, immutable\r\n", ["025083410fbfe0d5d502.png"])).toEqual([
      { url: "/025083410fbfe0d5d502.png", cacheControl: "public, max-age=31536000, immutable", verdict: "immutable" },
    ]);
  });

  test("guard, checker contract: joins every matching rule's Cache-Control, so a splat over the root also reaches nested files and the page", () => {
    const headers = ["/*.png", "  Cache-Control: public, max-age=31536000, immutable", "/osrs-assets/item-icons/*", "  Cache-Control: public, max-age=86400", "/*", "  Cache-Control: immutable"].join("\n");

    expect(servedCache(headers, ["025083410fbfe0d5d502.png", "osrs-assets/item-icons/24419.png", "index.html"])).toEqual([
      { url: "/025083410fbfe0d5d502.png", cacheControl: "public, max-age=31536000, immutable, immutable", verdict: "hashed-but-mutable" },
      { url: "/osrs-assets/item-icons/24419.png", cacheControl: "public, max-age=31536000, immutable, public, max-age=86400, immutable", verdict: "unhashed-but-immutable" },
      { url: "/", cacheControl: "immutable", verdict: "unhashed-but-immutable" },
      { url: "/index.html", cacheControl: "immutable", verdict: "unhashed-but-immutable" },
    ]);
  });

  test("guard, checker contract: rejects a line that is neither a path rule nor an indented header", () => {
    expect(() => servedCache("! Cache-Control\n", [])).toThrow("_headers line 1 is neither a path rule nor a header of one: ! Cache-Control");
  });
});
