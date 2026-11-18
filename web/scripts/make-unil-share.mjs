// Makes config/share/unil.png (1200 × 630), the link preview for /unil/. Text only, no UNIL logo.
//   npm i --no-save playwright && node scripts/make-unil-share.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../config/share/unil.png");
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;background:#F5EAD8;color:#201E1D;font-family:-apple-system,system-ui,"Helvetica Neue",Arial,sans-serif;display:flex;align-items:center}
.w{padding:0 90px;display:flex;gap:70px;align-items:center}
.t{flex:1}.e{font-size:26px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8E4818}
h1{font-size:64px;line-height:1.08;margin:18px 0 22px;letter-spacing:-.01em}p{font-size:28px;line-height:1.35;color:#4A4540;margin:0}
.m{margin-top:28px;display:inline-block;background:#201E1D;color:#fff;font-size:22px;padding:8px 16px;border-radius:8px}
.ph{width:250px;height:470px;background:#1D1D1F;border-radius:40px;padding:10px;box-sizing:border-box}
.sc{background:#fff;height:100%;border-radius:31px;padding:44px 16px 0;box-sizing:border-box}
.ti{color:#006AAE;font-weight:700;text-align:center;font-size:18px;margin-bottom:16px}.ti span{font-variant:small-caps}
.c{background:#EFEFF2;border-radius:12px;padding:12px;font-size:14px;font-weight:600;line-height:1.3}.c small{display:block;font-weight:400;color:#5B5E66;margin-top:4px}
.r{height:12px;background:#E6E6EA;border-radius:6px;margin:20px 6px 0}.r:nth-child(odd){width:70%}
</style><div class="w"><div class="t"><div class="e">CalmCampus × UNIL</div>
<h1>Un point bien-être discret, dans UNIL Campus</h1>
<p>Une démo faite pour l’UNIL. Les données ne quittent jamais le téléphone.</p>
<div class="m">Maquette, ce n’est pas l’app officielle</div></div>
<div class="ph"><div class="sc"><div class="ti">UNIL <span>Campus</span></div>
<div class="c">Votre point bien-être de la semaine<small>Moins d’une minute</small></div>
<div class="r"></div><div class="r"></div><div class="r"></div><div class="r"></div><div class="r"></div><div class="r"></div></div></div></div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", path.relative(process.cwd(), out));
