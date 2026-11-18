// End to end for the UNIL showcase (web/unil/): every simulated case on a small phone,
// a large phone and a desktop window, in WebKit and Chromium. Fails on any serious or
// critical axe finding (WCAG 2.1 A/AA), horizontal overflow, a broken keyboard path,
// or a request to another origin.
//
//   npm i --no-save playwright axe-core && npx playwright install webkit chromium
//   node scripts/build-unil.mjs && node test/unil-e2e.mjs
//   E2E_URL=https://cc.braunf.com/unil/ node test/unil-e2e.mjs
//   SHOTS=<dir> also saves a screenshot of each case's final screen.
import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

let server, base = process.env.E2E_URL;
if (!base) {
  server = spawn("python3", ["-m", "http.server", "8093", "--bind", "127.0.0.1", "--directory", path.join(root, "dist")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  base = "http://127.0.0.1:8093/unil/";
}
const origin = new URL(base).origin;

const fails = [];
const fail = (where, msg) => { fails.push(`${where}: ${msg}`); console.log(`  FAIL ${where}: ${msg}`); };

async function axe(page, where) {
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }));
  for (const v of r.violations.filter((v) => ["serious", "critical"].includes(v.impact)))
    fail(where, `axe ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}
async function noOverflow(page, where) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 0) fail(where, `horizontal overflow ${o}px`);
}

const EXPECT = {
  A: { has: "À la semaine prochaine.", not: ["Une semaine difficile", "Ces dernières semaines"] },
  B: { has: "Une semaine difficile, ça arrive.", not: ["Ces dernières semaines", "Accueil Santé"] },
  C: { has: "Ces dernières semaines semblent plus lourdes", also: ["Accueil Santé", "Consultation psychothérapeutique", "Service d’orientation et carrières"] },
  D: { has: "vos quatre réponses suffisent", not: ["Selon votre téléphone"] },
};

const runs = [
  { engine: webkit, name: "webkit-iphone-se", viewport: { width: 320, height: 568 }, mobile: true },
  { engine: webkit, name: "webkit-iphone-14", viewport: { width: 390, height: 844 }, mobile: true },
  { engine: chromium, name: "chromium-pixel-7", viewport: { width: 412, height: 915 }, mobile: true },
  { engine: chromium, name: "chromium-desktop", viewport: { width: 1280, height: 860 }, mobile: false },
];

for (const run of runs) {
  console.log(run.name);
  const browser = await run.engine.launch();
  const ctx = await browser.newContext({ viewport: run.viewport, isMobile: run.mobile && run.engine === chromium, hasTouch: run.mobile, reducedMotion: "reduce", locale: "fr-CH", bypassCSP: true });
  const page = await ctx.newPage();
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) fail(run.name, `request to ${r.url()}`); });
  page.on("pageerror", (e) => fail(run.name, `page error ${e.message}`));

  for (const id of ["A", "B", "C", "D"]) {
    const where = `${run.name} ${id}`;
    await page.goto(`${base}?cas=${id}`);
    await page.waitForSelector(".cc-card");
    if (id === "A") { await axe(page, `${where} home`); await noOverflow(page, `${where} home`); }
    if ((await page.locator("html").getAttribute("lang")) !== "fr-CH") fail(where, "html lang");

    // Keyboard: open the card, answer with the pre-filled values, finish.
    await page.locator('[data-act="open"]').first().focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".sheet");
    if (id === "A") await axe(page, `${where} question`);
    const focusedIsRadio = await page.evaluate(() => document.activeElement?.type === "radio");
    if (!focusedIsRadio) fail(where, "focus not on the scale when the sheet opens");
    for (let i = 0; i < 3; i++) await page.locator('.sheet [data-act="next"]').click();
    await page.locator("#q-note").fill("Rien de spécial");
    await page.locator('.sheet [data-act="finish"]').click();
    await page.waitForSelector(".thanks");
    const t = await page.locator(".thanks").innerText();
    if (!t.includes("Vos réponses restent sur votre téléphone.")) fail(where, "thank-you line");
    if (!t.includes(EXPECT[id].has)) fail(where, `missing "${EXPECT[id].has}"`);
    for (const n of EXPECT[id].not ?? []) if (t.includes(n)) fail(where, `unexpected "${n}"`);
    for (const a of EXPECT[id].also ?? []) if (!t.includes(a)) fail(where, `missing "${a}"`);
    await axe(page, `${where} thanks`);
    await noOverflow(page, `${where} thanks`);
    if (shots && run.name === "webkit-iphone-14") {
      await page.locator(".phone").screenshot({ path: path.join(shots, `cas-${id}-final.png`) });
    }
    if (shots && run.name === "chromium-desktop") await page.screenshot({ path: path.join(shots, `cas-${id}-desktop.png`), fullPage: false });

    // Escape closes the sheet; the card is gone for the week.
    await page.keyboard.press("Escape");
    if (await page.locator(".sheet").count()) fail(where, "Escape did not close the sheet");
    if (await page.locator(".cc-card").count()) fail(where, "card still shown after the check-in");

    if (id === "B" || id === "D") {
      await page.locator('button[data-act="health"]').click();
      await page.waitForSelector(".svc-list");
      await axe(page, `${where} health`);
      if (shots && run.name === "webkit-iphone-14" && id === "D") await page.locator(".phone").screenshot({ path: path.join(shots, `cas-D-sante-et-bien-etre-haut.png`) });
      if (shots && run.name === "webkit-iphone-14" && id === "D") { await page.locator('.sw[data-key="sleep"]').scrollIntoViewIfNeeded(); await page.locator(".phone").screenshot({ path: path.join(shots, "cas-D-donnees-refusees.png") }); }
      await noOverflow(page, `${where} health`);
      const sw = page.locator('.sw[data-key="sleep"]');
      const want = id === "D" ? "false" : "true";
      if ((await sw.getAttribute("aria-checked")) !== want) fail(where, `sleep switch should be ${want}`);
      for (const k of ["steps", "screen"]) if ((await page.locator(`.sw[data-key="${k}"]`).getAttribute("aria-checked")) !== "false") fail(where, `${k} should be off`);
      await sw.focus(); await page.keyboard.press("Space");
      if ((await sw.getAttribute("aria-checked")) === want) fail(where, "switch did not toggle with Space");
      for (const a of await page.locator(".phone-screen a.ext").all()) {
        if ((await a.getAttribute("target")) !== "_blank" || (await a.getAttribute("hreflang")) !== "fr") fail(where, "external link attributes");
        if (!/^https:\/\/www\.unil\.ch\/unil\/fr\//.test(await a.getAttribute("href"))) fail(where, "link not on unil.ch/fr");
      }
      await page.locator(".how summary").click();
      await axe(page, `${where} how`);
    }
  }

  // "Plus tard" hides the card and moves focus to the section entry.
  await page.goto(`${base}?cas=A`);
  await page.locator('[data-act="later"]').click();
  if (await page.locator(".cc-card").count()) fail(run.name, "Plus tard did not hide the card");
  const f = await page.evaluate(() => document.activeElement?.dataset?.act);
  if (f !== "health") fail(run.name, `focus after Plus tard is ${f}`);
  if (shots && run.name === "webkit-iphone-14") {
    await page.goto(`${base}?cas=A`);
    await page.locator(".phone").screenshot({ path: path.join(shots, "accueil-carte.png") });
    await page.locator('[data-act="open"]').click();
    await page.locator(".phone").screenshot({ path: path.join(shots, "question-1.png") });
    await page.goto(`${base}?cas=A`);
    await page.screenshot({ path: path.join(shots, "page-mobile.png"), fullPage: true });
  }

  // Keyboard: every focusable element on the page shows a visible outline.
  await page.goto(`${base}?cas=A`);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const ok = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return true;
      let s = getComputedStyle(el);
      if (el.matches("input[type=radio]")) s = getComputedStyle(el.nextElementSibling);
      return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
    });
    if (!ok) { fail(run.name, `no visible focus on tab stop ${i + 1}: ${await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80))}`); break; }
  }
  await browser.close();
}

server?.kill();
console.log(fails.length ? `\n${fails.length} failure(s)` : "\nall checks passed");
process.exit(fails.length ? 1 : 0);
