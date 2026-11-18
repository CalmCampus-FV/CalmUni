// Builds dist/unil/ : the UNIL showcase (a staff-facing page with a mockup of
// CalmCampus inside UNIL Campus). Static files only, no service worker, no config:
// it is not the student PWA. Leaves the rest of dist/ alone.
//
//   node scripts/build-unil.mjs
import { cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist/unil");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of readdirSync(path.join(root, "unil"))) cpSync(path.join(root, "unil", f), path.join(out, f));
cpSync(path.join(root, "config/share/unil.png"), path.join(out, "share.png"));
console.log(`built dist/unil (${readdirSync(out).length} files)`);
