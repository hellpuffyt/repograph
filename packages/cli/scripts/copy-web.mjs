import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Copies the pre-built single-file web viewer (packages/web/dist/index.html)
// into the CLI package's own dist/ so `repograph html`/`repograph serve`
// can find it at runtime without depending on the web package's source tree.
const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "web", "dist", "index.html");
const destDir = join(here, "..", "web");
const dest = join(destDir, "viewer.html");

if (!existsSync(source)) {
  console.error(`repograph build: expected built viewer at ${source}. Run "npm run build -w packages/web" first.`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
cpSync(source, dest);
console.log(`repograph build: copied viewer to ${dest}`);
