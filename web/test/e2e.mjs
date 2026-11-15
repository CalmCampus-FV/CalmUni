// End-to-end check of the reviewer preview in real browser engines: WebKit (iPhone
// SE, iPhone 14) and Chromium (Pixel 7, a desktop window), plus offline use.
// It serves dist/ itself, or checks a deployed copy when E2E_URL is set.
//
//   npm run build && npm run e2e
//   E2E_URL=https://cc.braunf.com/<id>/ npm run e2e      # after deploying
//
// It tests the university of this branch: the one config besides "default" if there
// is one (a tailored branch), else "default" (main). E2E_UNI=<id> picks another.
// Every expected text comes from that config and from src/i18n, so it works for any
// university without changes.
//
// Needs Playwright and axe-core, which the app itself does not use. Install them once, outside the
// project's dependencies:  npm i --no-save playwright axe-core && npx playwright install webkit chromium
import http from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loc, translate, typography } from "../src/lib/i18n.js";
import { levelFor, levelRanges } from "../src/lib/scoring.js";
import { orderQuestions, signalsFor, weekSignals } from "../src/lib/signals.js";
import { institutionsOf, institutionConfig, linkLanguage } from "../src/lib/config.js";

let pw;
try { pw = await import("playwright"); } catch {
  console.error("Playwright is not installed. Run: npm i --no-save playwright && npx playwright install webkit chromium");
  process.exit(2);
}
const { webkit, chromium, devices } = pw;
// axe-core (accessibility rules), installed next to Playwright: npm i --no-save axe-core
let axeSource = null;
try { axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8"); } catch { axeSource = null; }

/* ---------- What to test, and what it should say ---------- */

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(path.join(root, p), "utf8"));
const ids = readdirSync(path.join(root, "config/universities")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
const uniId = process.env.E2E_UNI ?? ids.find((id) => id !== "default") ?? "default";
const cfg = json(`config/universities/${uniId}.json`);
const langs = cfg.languages;
const ui = Object.fromEntries([...new Set(["en", ...langs])].map((l) => [l, json(`src/i18n/${l}.json`)]));
const hasFr = langs.includes("fr");
// A config for several universities: the phone journeys pick the first one; every
// university is checked in institutionFlows().
const insts = institutionsOf(cfg);
const firstInst = insts[0]?.id ?? null;
const eff = institutionConfig(cfg, firstInst);
const nameOf = (conf, lang) => loc(conf.nameInText, lang, cfg.defaultLanguage) ?? loc(conf.name, lang, cfg.defaultLanguage);
const T = (lang, key, vars = {}, conf = eff) => typography(translate(ui[lang], key, { name: nameOf(conf, lang), ...vars }), lang);
const C = (lang, value) => typography(loc(value, lang, cfg.defaultLanguage), lang);
const tryTitle = (i) => typography(ui.en.about.try[i].h, "en");
const guide = Array.isArray(cfg.tries) && cfg.tries.length ? cfg.tries : null;
const tryCount = guide ? guide.length : ui.en.about.try.length;
const afterStartOver = guide && insts.length ? guide.filter((x) => (x.marks ?? [x.id]).every((m) => m === "uni")).length : 0;
// Content rules checked on every screen a journey visits.
const SECONDS = /\b\d+\s?(?:s|sec)(?![\p{L}\d])|\b(?:seconds?|secondes?|seconden?)\b/iu;
const LESS = { en: "less than a minute", fr: "moins d’une minute", nl: "minder dan een minuut" };
const total = cfg.questions.length;
const heavy = orderQuestions(cfg.questions, weekSignals("heavy"));
const calm = orderQuestions(cfg.questions, weekSignals("steady"));

/* ---------- A static server for dist/, unless a deployed copy is tested ---------- */

const dist = path.join(root, "dist");
const live = process.env.E2E_URL;
const folder = uniId === "default" ? "" : `${uniId}/`;
if (!live && !existsSync(path.join(dist, folder, "index.html"))) { console.error("Run npm run build first."); process.exit(2); }

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(readFileSync(f));
});
if (!live) { server.listen(0); await new Promise((r) => server.once("listening", r)); }
const base = live ?? `http://localhost:${server.address().port}/${folder}`;
const origin = new URL(base).origin;

let checks = 0;
const fails = [];
// On CI: more time per step (shared machines are slower), and each failure becomes a
// GitHub annotation, readable on the run page without access to the full log.
const slow = Boolean(process.env.CI);
const annotate = (msg) => { if (process.env.GITHUB_ACTIONS) console.log(`::error title=End-to-end::${msg.replace(/\r?\n/g, " ")}`); };

async function until(page, fn, arg, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.evaluate(fn, arg)) return true;
    await page.waitForTimeout(40);
  }
  return false;
}

/* ---------- Helpers shared by the journeys ---------- */

/** After Start: a config for several universities asks which one, once. */
async function pickFirst(p, ok, settle) {
  if (!insts.length) return;
  ok(await p.evaluate(() => location.hash) === "#/pick", "after Start, the university picker comes first");
  await p.click(`[data-uni="${firstInst}"]`); await settle();
}

/** On every screen: the footer, no time in seconds, and the team's names spelled right. */
async function rules(p, ok, lang, where) {
  const footer = ((await p.textContent("#disclaimer")) ?? "").trim();
  ok(footer === T(lang, "disclaimer"), `${where}: the footer reads "${T(lang, "disclaimer")}" (got "${footer}")`);
  const text = await p.evaluate(() => document.body.innerText);
  ok(!SECONDS.test(text), `${where}: no time in seconds`);
  ok(!/Braun\b|Braün/.test(text), `${where}: the surname is written Braùn`);
}

/** Support: every service's email, website and phone, and the emergency numbers in order. */
async function supportLinks(p, ok, conf, lang, L) {
  for (const [id, s] of Object.entries(conf.services)) {
    const hrefs = await p.locator(`section.service[aria-labelledby="s-${id}"] a`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    if (s.contact.email) ok(hrefs.includes(`mailto:${s.contact.email}`), `${L}: ${id} email link`);
    const site = loc(s.contact.link, lang, cfg.defaultLanguage);
    if (site) ok(hrefs.includes(site), `${L}: ${id} website link`);
    const pageLang = linkLanguage(s.contact, lang);
    const note = s.contact.linkNote?.[lang] ?? (pageLang && pageLang !== lang ? ui[lang].service.pageIn?.[pageLang] : null);
    if (site) {
      const a = p.locator(`section.service[aria-labelledby="s-${id}"] a[href="${site}"]`).first();
      const label = ((await a.textContent()) ?? "").trim();
      // A page in another language than the reader's must say so on its button.
      if (pageLang && pageLang !== lang) ok(Boolean(note) && label.includes(typography(note, lang)), `${L}: ${id} website is in ${pageLang}, so its button says so (got "${label}")`);
      else if (note) ok(label.includes(typography(note, lang)), `${L}: ${id} website button says "${note}"`);
      else ok(!/\([^)]*\)$/.test(label), `${L}: ${id} website is in ${lang}: no language label (got "${label}")`);
      if (pageLang) ok(await a.getAttribute("hreflang") === pageLang, `${L}: ${id} website link has hreflang="${pageLang}"`);
    }
    if (s.contact.phone) ok(hrefs.includes(`tel:${s.contact.phone.replace(/\s/g, "")}`), `${L}: ${id} phone link`);
  }
  const tels = await p.locator(".emergency a.call").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  ok(JSON.stringify(tels) === JSON.stringify(conf.emergency.map((e) => `tel:${e.tel}`)), `${L}: emergency numbers dial the configured numbers (got ${tels.join(" ")})`);
}

/* ---------- A reviewer's whole journey on a phone ---------- */

async function phone(name, browserType, device, os) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ ...device });
  const p = await context.newPage();
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
  p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
  p.on("request", (r) => { if (!r.url().startsWith(origin)) fails.push(`${name}: request to another host ${r.url()}`); });
  const settle = () => p.waitForTimeout(slow ? 600 : 260);
  const h1 = () => p.textContent("h1");
  const hash = () => p.evaluate(() => location.hash);
  const shows = async (text) => (await p.evaluate(() => document.body.textContent)).includes(text);
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await settle(); };
  const fits = async (where, lang = "en") => {
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `wider than the screen on ${where}`);
    await rules(p, ok, lang, where);
  };
  const staysPut = async (sel, keep, label) => {
    await p.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(60);
    const top = () => p.evaluate((k) => document.querySelector(`[data-keep="${k}"]`)?.getBoundingClientRect().top, keep);
    const before = await top();
    await p.locator(sel).first().click();
    await settle();
    const after = await top();
    ok(after !== undefined && Math.abs(after - before) <= 2, `${label} moved the page (${before} -> ${after})`);
  };
  const answer = async (v) => { await p.click(`[data-answer="${v}"]`); await settle(); };

  // Welcome
  await p.goto(`${base}?lang=en`);
  await p.waitForSelector("[data-welcome]");
  ok(await h1() === T("en", "welcome.title"), "the welcome screen comes first");
  ok(await shows(T("en", "welcome.lead", {}, cfg)), "the welcome screen says what CalmCampus is");
  ok((await p.$$("#nav a")).length === 0, "no tabs on the welcome screen");
  ok(!(await p.$(".preview-strip")), "no preview line on the welcome screen");
  ok((await p.$$(".install .steps li")).length === ui.en.install[os].length, "numbered install steps for this phone");
  await fits("welcome");
  if (hasFr) {
    await p.click('[data-hlang="fr"]'); await settle();
    ok(await h1() === T("fr", "welcome.title"), "language switch on the welcome screen");
    await p.click('[data-hlang="en"]'); await settle();
  }
  await p.click("[data-welcome]"); await settle();
  await pickFirst(p, ok, settle);
  ok((await p.$$("#nav a")).length === 4, "four tabs after Start");
  ok(await shows(T("en", "preview.tryLink")), "the preview line leads to the guide");
  await fits("home");

  // A difficult week: the check-in with a double tap, a skip and the back button
  await staysPut('[data-scenario="heavy"]', "signals", "choosing an example week");
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('a[href="#/check/0"]'); await settle();
  ok(!(await p.$(".preview-strip")), "no preview line during the check-in");
  ok(await p.textContent("#q") === C("en", heavy[0].text), "the question with a notable signal comes first");
  if (signalsFor(heavy[0], weekSignals("heavy")).length) ok(await shows(T("en", "signals.noticedHeading")), "the phone hint is shown");
  await fits("question");
  await p.click('[data-answer="yes"]'); await p.click('[data-answer="yes"]', { force: true }); await settle(); await settle();
  ok(await hash() === "#/check/1", `a double tap answers one question only (at ${await hash()})`);
  ok(await p.textContent("#q") === C("en", heavy[1].text), "the questions follow the phone signals");
  await answer("no");
  if (!heavy[2].signals?.length) ok(await shows(T("en", "signals.noSignal")), "questions without a signal say so");
  await answer("skip");
  await answer("yes");
  const level = levelFor(eff, 2);
  ok(await h1() === T("en", `result.levels.${level.id}.title`), `two yes answers and one skip give "${level.id}" (got ${await h1()})`);
  ok(await shows(T("en", "result.skipped", { n: 1, total })), "skipped questions are counted");
  ok(await shows(T("en", "signals.resultHeading")), "the result shows what the phone noticed");
  ok(await shows(level.service ? C("en", eff.services[level.service].name) : T("en", "result.seeSupport")), "the result points to the configured next step");
  if (!guide) ok(((await p.textContent(".next-try")) ?? "").includes(tryTitle(1)), "the result suggests the next thing to try");
  else ok(Boolean(await p.$(".next-try")), "the result suggests the next thing to try");
  await fits("result");
  await p.goBack(); await settle();
  ok(!(await hash()).startsWith("#/check"), `the back button leaves the finished check-in (at ${await hash()})`);
  await go("#/check/2");
  ok(await hash() === "#/check/0", "a check-in never starts in the middle");

  // A calm week: the redo prompt, nothing unusual, and a result keeps its week
  await go("#/");
  await p.click('[data-scenario="steady"]'); await settle();
  ok(await shows(T("en", "signals.redoPrompt")), "after picking another week, Home invites a redo");
  await p.click('.redo a[href="#/check/0"]'); await settle();
  if (calm[0].signals?.length) ok(await shows(T("en", "signals.unremarkable")), "a calm week says nothing unusual");
  for (let i = 0; i < total; i++) await answer("no");
  ok(await h1() === T("en", "result.levels.steady.title"), "all no answers are steady");
  await go("#/");
  ok(!(await p.$(".redo")), "no redo prompt once the check-in matches the week");
  await p.click('[data-scenario="heavy"]'); await settle();
  await p.click('a[href^="#/result/"]'); await settle();
  ok(await shows(T("en", "signals.resultNone")), "a result keeps the example week it was done with");

  // My weeks and Support
  await p.click('#nav a[href="#/history"]'); await settle();
  ok((await p.$$(".week-list li")).length === 7, "one own week and six examples");
  ok((await p.$$(".chart .col")).length <= 7, "the chart fits seven weeks at most");
  await fits("my weeks");
  await p.click('#nav a[href="#/support"]'); await settle();
  ok((await p.$$(".service")).length === Object.keys(eff.services).length && await p.isVisible(".emergency"), "services and emergency numbers");
  await fits("support");

  // About: the guide, every result, feedback, language, privacy
  await p.click('#nav a[href="#/about"]'); await settle();
  ok((await p.$$(".try li")).length === tryCount, "the guide lists every thing to try");
  if (!guide) ok((await p.$$(".try .num.done")).length === 3 && await shows(T("en", "about.progress", { n: 3, total: 5 })), "the guide shows what was tried (check-in, another week, support)");
  const mail = await p.getAttribute('a.btn.sage[data-track="feedback"]', "href");
  ok((mail ?? "").startsWith(`mailto:${cfg.feedback.email}?subject=`) && (mail ?? "").includes("&body="), "feedback opens a prepared email");
  await fits("about");
  await p.click('.try a[href="#/results"]'); await settle();
  const list = await p.textContent(".level-list");
  for (const { level: lv, lo, hi } of levelRanges(eff)) {
    const range = lo === hi ? `${lo}` : `${lo}–${hi}`;
    const target = lv.service ? C("en", eff.services[lv.service].name) : T("en", "results.supportList");
    ok(list.includes(T("en", "results.yes", { range, total })) && list.includes(T("en", "results.suggests", { target })), `every result lists "${lv.id}" with its range and next step`);
  }
  ok(await shows(T("en", "results.emergencyNote")), "emergency note on every result");
  const top = levelRanges(eff).at(-1).level.id;
  await p.click(`a[href="#/preview/${top}"]`); await settle();
  ok(await shows(T("en", "result.exampleKicker")), "example results are labelled");
  await p.click('a.btn.sm[href="#/results"]'); await settle();
  await p.click('a.btn.sm[href="#/about"]'); await settle();
  if (!guide) ok((await p.$$(".try .num.done")).length === 4, "seeing every result counts as tried");
  if (hasFr) {
    await staysPut('[data-lang="fr"]', "lang", "switching to French");
    ok(await p.evaluate(() => document.documentElement.lang) === "fr", "the page language follows");
    await staysPut('[data-lang="en"]', "lang", "switching to English");
  }
  await p.locator('a[href="#/privacy"]').evaluate((el) => el.scrollIntoView({ block: "center" }));
  const y = await p.evaluate(() => Math.round(scrollY));
  await p.click('a[href="#/privacy"]'); await settle();
  await p.click('a.btn.sm[href="#/about"]'); await settle();
  ok(Math.abs(await p.evaluate(() => Math.round(scrollY)) - y) < 3, "back from privacy lands where you were");

  // French text
  if (hasFr) {
    await p.click('[data-lang="fr"]'); await settle();
    await go("#/");
    await p.click('a[href="#/check/0"]'); await settle();
    const q = await p.textContent("#q");
    ok(q === C("fr", heavy[0].text) && (!loc(heavy[0].text, "fr").includes(" ?") || q.includes(" ?")), "French questions keep the question mark with the last word");
    await go("#/support");
    ok(await h1() === T("fr", "more.supportHeading"), `French support heading reads naturally (got ${await h1()})`);
    await p.click('[data-hlang="en"]'); await settle();
  }

  // Start over
  await go("#/about");
  await staysPut('[data-delete="ask"]', "delete", "asking to start over");
  await staysPut('[data-delete="no"]', "delete", "cancelling start over");
  await p.click('[data-delete="ask"]'); await settle();
  await p.click('[data-delete="yes"]'); await settle();
  ok(await h1() === T("en", "welcome.title"), "start over shows the welcome screen");
  await p.click("[data-welcome]"); await settle();
  await pickFirst(p, ok, settle);
  await p.click('#nav a[href="#/history"]'); await settle();
  ok((await p.$$(".week-list li")).length === 6, "start over keeps only the examples");
  await p.click('#nav a[href="#/about"]'); await settle();
  ok((await p.$$(".try .num.done")).length === afterStartOver, "start over resets the guide");

  await browser.close();
}

/* ---------- Every result level, Skip, links, feedback and Start over, in each language ---------- */

async function languageFlows(name, browserType, device) {
  const browser = await browserType.launch();
  const p = await (await browser.newContext({ ...device })).newPage();
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
  p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
  p.on("request", (r) => { if (!r.url().startsWith(origin)) fails.push(`${name}: request to another host ${r.url()}`); });
  const settle = () => p.waitForTimeout(slow ? 600 : 260);
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await settle(); };
  const h1 = () => p.textContent("h1");
  const shows = async (text) => (await p.evaluate(() => document.body.textContent)).includes(text);
  const backText = async () => ((await p.textContent('a.btn.sm[href="#/about"]')) ?? "").trim();
  const ticked = (href) => p.evaluate((h) => Boolean(document.querySelector(`.try a[href="${h}"] .num.done`)), href);
  for (const lang of langs) {
    const L = lang.toUpperCase();
    await p.goto(`${base}?lang=${lang}`);
    await p.waitForSelector("[data-welcome]");
    await rules(p, ok, lang, `${L} welcome`);
    await p.click("[data-welcome]"); await settle();
    await pickFirst(p, ok, settle);
    ok(await shows(LESS[lang] ?? LESS.en), `${L}: Home says the check-in takes "${LESS[lang]}"`);

    // 0 to 4 yes answers: the level, where it points, and the emergency numbers every time
    for (let yes = 0; yes <= total; yes++) {
      await go("#/");
      await p.click('a[href="#/check/0"]'); await settle();
      for (let i = 0; i < total; i++) { await p.click(i < yes ? '[data-answer="yes"]' : '[data-answer="no"]'); await settle(); }
      const lv = levelFor(eff, yes);
      ok(await h1() === T(lang, `result.levels.${lv.id}.title`), `${L}: ${yes} yes gives "${lv.id}" (got ${await h1()})`);
      ok(await shows(lv.service ? C(lang, eff.services[lv.service].name) : T(lang, "result.seeSupport")), `${L}: ${yes} yes points to ${lv.service ?? "the support list"}`);
      await rules(p, ok, lang, `${L} result with ${yes} yes`);
      ok(await p.isVisible(".emergency"), `${L}: ${yes} yes shows the emergency numbers`);
    }

    // Skip: counted, and never a yes
    await go("#/");
    await p.click('a[href="#/check/0"]'); await settle();
    for (let i = 0; i < total; i++) { await p.click(i === 0 ? '[data-answer="yes"]' : i === 1 ? '[data-answer="skip"]' : '[data-answer="no"]'); await settle(); }
    ok(await shows(T(lang, "result.skipped", { n: 1, total })), `${L}: a skipped question is counted`);
    ok(await h1() === T(lang, `result.levels.${levelFor(eff, 1).id}.title`), `${L}: a skipped question is not a yes`);

    // My weeks
    await go("#/history");
    ok(await h1() === T(lang, "history.title") && (await p.$$(".week-list li")).length === 7, `${L}: My weeks shows one own week and six examples`);
    await rules(p, ok, lang, `${L} my weeks`);

    // Support: every service's email and website, and the emergency numbers
    await go("#/support");
    await supportLinks(p, ok, eff, lang, L);
    await rules(p, ok, lang, `${L} support`);

    // About: steps 3 and 4 tick once their page is opened; the pages under About go "Back"
    await go("#/about");
    ok(!(await ticked("#/results")), `${L}: step 3 is not ticked before the results page is opened`);
    ok(await ticked("#/support"), `${L}: step 4 is ticked once the Support tab was opened`);
    await p.click('.try a[href="#/results"]'); await settle();
    ok(await backText() === T(lang, "checkin.back"), `${L}: the results page's back button says "${T(lang, "checkin.back")}" (got "${await backText()}")`);
    await p.click('a.btn.sm[href="#/about"]'); await settle();
    ok(await ticked("#/results"), `${L}: step 3 is ticked once the results page was opened`);
    await go("#/privacy");
    ok(await backText() === T(lang, "checkin.back"), `${L}: the privacy page's back button says "${T(lang, "checkin.back")}" (got "${await backText()}")`);
    await rules(p, ok, lang, `${L} privacy`);
    const privacyText = await p.evaluate(() => document.body.textContent);
    ok(privacyText.includes(cfg.privacyPrinciples ? C(lang, cfg.privacyPrinciples) : T(lang, "privacy.principles")), `${L}: the privacy page states the design principles`);
    if (cfg.privacyNote) ok(privacyText.includes(C(lang, cfg.privacyNote)), `${L}: the privacy page gives the privacy line`);

    // Feedback and Start over
    await go("#/about");
    const subject = typeof cfg.feedback.subject === "string" ? cfg.feedback.subject : loc(cfg.feedback.subject, lang, cfg.defaultLanguage);
    await rules(p, ok, lang, `${L} about`);
    const credit = await p.evaluate(() => [...document.querySelectorAll(".version")].map((x) => x.textContent).join(" "));
    ok(credit.includes("Florian Braùn") && credit.includes("Hélène David"), `${L}: About credits Florian Braùn and Hélène David`);
    const mail = (await p.getAttribute('a.btn.sage[data-track="feedback"]', "href")) ?? "";
    ok(mail.startsWith(`mailto:${cfg.feedback.email}?subject=${encodeURIComponent(subject)}&body=`), `${L}: Send feedback opens an email to ${cfg.feedback.email}`);
    await p.click('[data-delete="ask"]'); await settle();
    await p.click('[data-delete="yes"]'); await settle();
    ok(await h1() === T(lang, "welcome.title"), `${L}: Start over shows the welcome screen`);
  }
  await browser.close();
}

/* ---------- Several universities: each one's routing, links and numbers, in each language ---------- */

async function institutionFlows(name, browserType, device) {
  const browser = await browserType.launch();
  const p = await (await browser.newContext({ ...device })).newPage();
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
  p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
  p.on("request", (r) => { if (!r.url().startsWith(origin)) fails.push(`${name}: request to another host ${r.url()}`); });
  const settle = () => p.waitForTimeout(slow ? 450 : 200);
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await settle(); };
  const h1 = () => p.textContent("h1");
  const shows = async (text) => (await p.evaluate(() => document.body.textContent)).includes(text);
  for (const lang of langs) {
    await p.goto(`${base}?lang=${lang}`);
    await p.waitForLoadState("networkidle"); // let the offline copy finish installing first
    await p.evaluate(() => localStorage.clear());
    await p.goto(`${base}?lang=${lang}`);
    await p.waitForSelector("[data-welcome]");
    await p.click("[data-welcome]"); await settle();
    ok(await h1() === T(lang, "pick.title"), `${lang.toUpperCase()}: the picker asks which university`);
    for (const inst of insts) {
      const conf = institutionConfig(cfg, inst.id);
      const L = `${lang.toUpperCase()} ${inst.id}`;
      await go("#/pick");
      await p.click(`[data-uni="${inst.id}"]`); await settle();
      ok(!(await p.evaluate(() => location.hash)).startsWith("#/pick"), `${L}: picking leaves the picker`);
      // 0, 1-2 and 3-4 yes: each level points to this university's own service
      const started = Date.now();
      for (let yes = 0; yes <= total; yes++) {
        await go("#/");
        await p.click('a[href="#/check/0"]'); await settle();
        const t0 = Date.now();
        for (let i = 0; i < total; i++) { await p.click(i < yes ? '[data-answer="yes"]' : '[data-answer="no"]'); await settle(); }
        if (yes === 0) ok(Date.now() - t0 < 30000, `${L}: the four questions are answered in well under a minute (${Date.now() - t0} ms)`);
        const lv = levelFor(conf, yes);
        ok(await h1() === T(lang, `result.levels.${lv.id}.title`, {}, conf), `${L}: ${yes} yes gives "${lv.id}"`);
        const next = lv.service ? C(lang, conf.services[lv.service].name) : lv.minYes > 0 && conf.advice ? C(lang, conf.advice) : T(lang, "result.steadyNext", {}, conf);
        ok(await shows(next), `${L}: ${yes} yes points to ${lv.service ?? (lv.minYes > 0 && conf.advice ? "the general advice" : "the support list")}`);
        ok(await p.isVisible(".emergency"), `${L}: ${yes} yes shows the emergency numbers`);
      }
      ok(Date.now() - started < 120000, `${L}: five check-ins fit in two minutes`);
      await go("#/support");
      ok(await h1() === T(lang, "more.supportHeading", {}, conf), `${L}: support heading names the university`);
      if (!Object.keys(conf.services).length) ok(await shows(C(lang, conf.advice)), `${L}: without services, Support gives the general advice`);
      await supportLinks(p, ok, conf, lang, L);
      await rules(p, ok, lang, `${L} support`);
    }
  }
  await browser.close();
}

/* ---------- The config's own pages and guide (for example a partner app's view) ---------- */

async function pageFlows(name, browserType, device) {
  const browser = await browserType.launch();
  const wide = await chromium.launch();
  const p = await (await browser.newContext({ ...device })).newPage();
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
  p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
  p.on("request", (r) => { if (!r.url().startsWith(origin)) fails.push(`${name}: request to another host ${r.url()}`); });
  const settle = () => p.waitForTimeout(slow ? 600 : 260);
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await settle(); };
  const h1 = () => p.textContent("h1");
  const ticked = () => p.$$eval(".try .num.done", (x) => x.length);
  for (const lang of langs) {
    const L = lang.toUpperCase();
    await p.goto(`${base}?lang=${lang}`);
    await p.waitForLoadState("networkidle"); // let the offline copy finish installing first
    await p.evaluate(() => localStorage.clear());
    await p.goto(`${base}?lang=${lang}`);
    await p.waitForSelector("[data-welcome]");
    if (cfg.welcomeNote) ok((await p.evaluate(() => document.body.textContent)).includes(C(lang, cfg.welcomeNote)), `${L}: the welcome screen says what this preview is`);
    if (cfg.privacyNote) ok((await p.evaluate(() => document.body.textContent)).includes(C(lang, cfg.privacyNote)), `${L}: the welcome screen gives the privacy line`);
    for (const pid of cfg.welcomeLinks ?? []) ok(Boolean(await p.$(`a[href="#/${pid}"]`)), `${L}: the welcome screen links to ${pid}`);
    for (const pg of cfg.pages ?? []) {
      await go(`#${pg.id}`);
      ok(await h1() === C(lang, pg.title), `${L}: #${pg.id} opens "${C(lang, pg.title)}" (got ${await h1()})`);
      await rules(p, ok, lang, `${L} page ${pg.id}`);
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${L}: page ${pg.id} fits the screen`);
      if (await p.$(".table-card")) {
        // Each width in its own window (a resized phone window does not relayout on every engine).
        for (const width of [320, 390, 479, 480, 768]) {
          const wctx = await wide.newContext({ viewport: { width, height: 700 } });
          const wp = await wctx.newPage();
          await wp.goto(`${base}?lang=${lang}#/${pg.id}`);
          const fits = await until(wp, () => Boolean(document.querySelector(".table-card"))
            && [...document.querySelectorAll(".table-card, .table-card .table-wrap")].every((e) => e.scrollWidth <= e.clientWidth + 1)
            && document.documentElement.scrollWidth <= innerWidth, null, 5000);
          ok(fits, `${L}: page ${pg.id}: tables fit at ${width} px without scrolling sideways`);
          await wctx.close();
        }
      }
      const tables = (pg.blocks ?? []).flatMap((b) => (b.table ? [b.table] : b.box ? b.box.filter((x) => x.table).map((x) => x.table) : []));
      const shown = await p.$$eval(".table-card", (cards) => cards.map((c) => ({ demo: Boolean(c.querySelector(".pill.demo")), text: c.textContent })));
      ok(shown.length === tables.length, `${L}: page ${pg.id} shows its ${tables.length} table(s)`);
      tables.forEach((tb, i) => {
        if (tb.label === "example") ok(shown[i]?.demo && shown[i].text.includes(T(lang, "demo.label")), `${L}: page ${pg.id}: made-up numbers are labelled ${T(lang, "demo.label")}`);
        else if (tb.label === "target") ok((shown[i]?.text ?? "").includes(C(lang, tb.note)), `${L}: page ${pg.id}: targets say they are proposed, not results`);
      });
      // A concept mockup: every screen says it is not built, and nothing is switched on by default.
      for (const cn of (pg.blocks ?? []).filter((b) => b.concept).map((b) => b.concept)) {
        for (let i = 0; i < cn.screens.length; i++) {
          await p.click(`[data-concept-step="${i}"]`); await settle();
          const lab = ((await p.textContent(".concept-label")) ?? "").trim();
          ok(lab === C(lang, cn.label) && await p.isVisible(".concept-label"), `${L}: concept screen ${i + 1} (${cn.screens[i].type}) is labelled "${C(lang, cn.label)}" (got "${lab}")`);
          await rules(p, ok, lang, `${L} concept screen ${i + 1}`);
          const sc = cn.screens[i];
          if (sc.type === "permissions") {
            const states = await p.$$eval('[role="switch"]', (els) => els.map((e) => e.getAttribute("aria-checked")));
            ok(states.length === sc.items.length && states.every((x) => x === "false"), `${L}: every permission is off by default (${states.join(" ")})`);
            await p.click(`[data-concept-perm="${sc.items[0].id}"]`); await settle();
            const after = await p.$$eval('[role="switch"]', (els) => els.map((e) => e.getAttribute("aria-checked")));
            ok(after[0] === "true" && after.slice(1).every((x) => x === "false"), `${L}: each permission switches on its own`);
            ok((await p.evaluate(() => document.body.textContent)).includes(C(lang, sc.note)), `${L}: the permissions screen says the data stays on the phone`);
          }
          if (sc.type === "overview") ok(Boolean(await p.$(".concept .pill.demo")), `${L}: the concept's weekly overview is labelled ${T(lang, "demo.label")}`);
          if (sc.type === "banner") {
            ok(Boolean(await p.$(".concept-banner")), `${L}: the banner shows while the week is not answered`);
            if (sc.weekLabel) {
              await p.click('[data-concept-answered="yes"]'); await settle();
              ok(!(await p.$(".concept-banner")), `${L}: the banner is gone once the week is answered`);
              await p.click('[data-concept-answered="no"]'); await settle();
            }
          }
          if (sc.type === "questions") {
            for (let q = 0; q < total; q++) { await p.click("[data-concept-answer]"); await settle(); }
            ok((await p.evaluate(() => document.body.textContent)).includes(C(lang, sc.done)), `${L}: the four concept questions can be answered`);
            await p.click("[data-concept-restart]"); await settle();
          }
        }
        ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${L}: the concept fits the screen`);
      }
      const frame = pg.frame ?? (pg.blocks ?? []).find((b) => b.frame)?.frame;
      if (frame) {
        const caption = await p.$eval("a.mock-card", (a) => a.closest("figure").querySelector(".mock-label").textContent.trim());
        ok(caption === C(lang, frame.label), `${L}: the mockup is labelled as one`);
        const label = (await p.getAttribute("a.mock-card", "aria-label")) ?? "";
        ok(label.includes(C(lang, frame.card.text)) && label.includes(C(lang, frame.card.button)), `${L}: the card has an accessible label with its text and button`);
        await p.click("a.mock-card > span:nth-child(2)"); await settle();
        const h = await p.evaluate(() => location.hash);
        ok(h === "#/welcome" || h === "#/pick" || h === "#/", `${L}: the card's button opens the app (at ${h})`);
      }
    }
    if (lang !== langs[0]) continue;
    // The guide ticks each step once it is done, the whole way through.
    if (guide) {
      await go("#/welcome");
      await p.click("[data-welcome]"); await settle();
      await pickFirst(p, ok, settle);
      await go("#/");
      await p.click('a[href="#/check/0"]'); await settle();
      for (let i = 0; i < total; i++) { await p.click('[data-answer="no"]'); await settle(); }
      await go("#/results"); await go("#/support");
      await go("#/about");
      ok(await ticked() === guide.length, `${L}: every step of the guide is ticked after doing it (${await ticked()} of ${guide.length})`);
      ok((await p.evaluate(() => document.body.textContent)).includes(T(lang, "about.allDone")), `${L}: the guide says everything was tried`);
      await p.click('[data-delete="ask"]'); await settle();
      await p.click('[data-delete="yes"]'); await settle();
      await p.click("[data-welcome]"); await settle();
      await pickFirst(p, ok, settle);
      await go("#/about");
      ok(await ticked() === afterStartOver, `${L}: Start over resets the guide`);
    }
  }
  await wide.close();
  await browser.close();
}

/** The built files never misspell the team's names (local runs, where dist/ is at hand). */
function buildText() {
  if (live) return;
  const files = [];
  const walk = (d) => readdirSync(d).forEach((n) => { const f = path.join(d, n); if (statSync(f).isDirectory()) walk(f); else if (/\.(html|js|json|css|webmanifest|svg)$/.test(n)) files.push(f); });
  walk(path.join(dist, folder));
  const bad = files.filter((f) => /Braun\b|Braün/.test(readFileSync(f, "utf8")));
  checks++;
  if (bad.length) fails.push(`build: "Braun" or "Braün" in ${bad.map((f) => path.relative(dist, f)).join(", ")}`);
  if (!JSON.stringify(cfg).includes("nLPD")) {
    const swiss = files.filter((f) => readFileSync(f, "utf8").includes("nLPD"));
    checks++;
    if (swiss.length) fails.push(`build: "nLPD" in ${swiss.map((f) => path.relative(dist, f)).join(", ")}`);
  }
}

/** The first language, whatever the browser's, and the header's language buttons. */
async function languageStart() {
  const browser = await webkit.launch();
  const okAll = (cond, msg) => { checks++; if (!cond) fails.push(`language: ${msg}`); };
  for (const locale of ["en-US", "fr-BE", "nl-BE"]) {
    const context = await browser.newContext({ ...devices["iPhone SE"], locale });
    const p = await context.newPage();
    await p.goto(base);
    await p.waitForSelector("[data-welcome]");
    const lang = await p.evaluate(() => document.documentElement.lang);
    const want = cfg.languageFromBrowser === false || !langs.includes(locale.slice(0, 2)) ? cfg.defaultLanguage : locale.slice(0, 2);
    okAll(lang === want, `a phone set to ${locale} opens in ${want} (got ${lang})`);
    const buttons = await p.$$eval("[data-hlang]", (bs) => bs.map((b) => ({ l: b.dataset.hlang, on: b.getAttribute("aria-pressed") === "true", visible: b.offsetWidth > 0 })));
    if (cfg.languageSwitch === "all") {
      okAll(JSON.stringify(buttons.map((b) => b.l)) === JSON.stringify(langs) && buttons.every((b) => b.visible), `${locale}: the header shows every language (${buttons.map((b) => b.l).join(" ")})`);
      okAll(buttons.filter((b) => b.on).map((b) => b.l).join() === lang, `${locale}: the header marks the active language`);
      const other = langs.find((l) => l !== lang);
      await p.click(`[data-hlang="${other}"]`); await p.waitForTimeout(300);
      const after = await p.$$eval("[data-hlang]", (bs) => bs.map((b) => `${b.dataset.hlang}:${b.getAttribute("aria-pressed")}`));
      okAll(after.length === langs.length && after.includes(`${other}:true`), `${locale}: after switching, every language is still shown and the new one is marked`);
      okAll(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale}: the header fits a 320 px screen`);
    } else {
      okAll(!buttons.some((b) => b.l === lang), `${locale}: the header offers the other languages`);
    }
    await context.close();
  }
  await browser.close();
}

/**
 * Inside another app's own browser (for example a student app's link): an iOS
 * WKWebView (WebKit, no "Safari/" in the user agent, no service worker) and an
 * Android WebView ("; wv)" in the user agent), once with storage and once with
 * storage switched off. The check-in must work in each.
 */
async function inAppBrowsers() {
  const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP1A.240505.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36";
  const noServiceWorker = () => { delete Navigator.prototype.serviceWorker; };
  const noStorage = () => { Object.defineProperty(window, "localStorage", { get() { return null; } }); };
  const runs = [
    ["iOS in-app browser (WKWebView)", webkit, { ...devices["iPhone 14"], userAgent: ios }, [noServiceWorker], true],
    ["Android in-app browser (WebView)", chromium, { ...devices["Pixel 7"], userAgent: android }, [noServiceWorker], true],
    ["Android in-app browser without storage", chromium, { ...devices["Pixel 7"], userAgent: android }, [noServiceWorker, noStorage], false],
  ];
  for (const [name, type, device, scripts, keeps] of runs) {
    const browser = await type.launch();
    const context = await browser.newContext({ ...device });
    for (const sc of scripts) await context.addInitScript(sc);
    const p = await context.newPage();
    const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
    p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
    p.on("request", (r) => { if (!r.url().startsWith(origin)) fails.push(`${name}: request to another host ${r.url()}`); });
    const settle = () => p.waitForTimeout(slow ? 600 : 260);
    const lang = cfg.defaultLanguage;
    await p.goto(`${base}?lang=${lang}`);
    ok(await until(p, () => Boolean(document.querySelector("[data-welcome]")), null, 8000), "the app starts");
    ok(!(await p.$(".install")), "no install steps inside another app");
    await rules(p, ok, lang, `${name} welcome`);
    await p.click("[data-welcome]"); await settle();
    await pickFirst(p, ok, settle);
    await p.click('a[href="#/check/0"]'); await settle();
    for (let i = 0; i < total; i++) { await p.click(i < 2 ? '[data-answer="yes"]' : '[data-answer="no"]'); await settle(); }
    const lv = levelFor(eff, 2);
    ok(await p.textContent("h1") === T(lang, `result.levels.${lv.id}.title`), `the check-in gives a result (got ${await p.textContent("h1")})`);
    ok(await p.isVisible(".emergency"), "the result shows the emergency numbers");
    await p.evaluate(() => { location.hash = "#/history"; }); await settle();
    ok((await p.$$(".week-list li")).length === 7, "My weeks shows the new week");
    await p.reload(); await settle();
    if (keeps) {
      await p.evaluate(() => { location.hash = "#/history"; }); await settle();
      ok((await p.$$(".week-list li")).length === 7, "the answer is still there after reopening");
    } else {
      ok(Boolean(await p.$("h1")), "without storage the app still opens after reopening");
    }
    await browser.close();
  }
}

/* ---------- Accessibility: axe on every screen, keyboard focus, language, reduced motion ---------- */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const axeMinor = new Map(); // moderate and minor findings, reported but not failing

/** axe-core's WCAG A and AA rules (contrast included): no serious or critical finding. */
async function axeCheck(p, ok, where) {
  if (!axeSource) { ok(false, `${where}: axe-core is not installed (npm i --no-save axe-core)`); return; }
  if (!(await p.evaluate(() => Boolean(window.axe)))) await p.evaluate(axeSource);
  const found = await p.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  }, AXE_TAGS);
  const bad = found.filter((v) => v.impact === "serious" || v.impact === "critical");
  ok(!bad.length, `${where}: axe: ${bad.map((v) => `${v.id} (${v.impact}) at ${v.nodes.join(", ")}`).join("; ")}`);
  for (const v of found.filter((x) => !bad.includes(x))) axeMinor.set(v.id, `${v.impact}, for example ${where}`);
}

/** Every link and button has a name a screen reader can say. */
async function named(p, ok, where) {
  const unnamed = await p.$$eval("a[href], button", (els) => els.filter((e) => e.offsetWidth > 0 || e.offsetHeight > 0)
    .filter((e) => !(e.getAttribute("aria-label") || e.textContent).trim()).map((e) => e.outerHTML.slice(0, 80)));
  ok(!unnamed.length, `${where}: every link and button has a label (missing: ${unnamed.join(" | ")})`);
}

/** Tab through a screen: each focused element shows an outline of at least 2 px, at 3:1 or more against what is behind it. */
async function focusRing(p, ok, where) {
  await p.evaluate(() => { document.activeElement?.blur?.(); document.querySelectorAll("[data-focus-seen]").forEach((e) => e.removeAttribute("data-focus-seen")); scrollTo(0, 0); });
  let n = 0;
  for (let i = 0; i < 90; i++) {
    await p.keyboard.press("Tab");
    const info = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.id === "view") return { skip: true };
      if (el.hasAttribute("data-focus-seen")) return { done: true };
      el.setAttribute("data-focus-seen", "");
      const rgb = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return a < 0.5 ? null : [r, g, b]; };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      let up = el.parentElement, bg = null;
      while (up && !bg) { bg = rgb(getComputedStyle(up).backgroundColor); up = up.parentElement; }
      bg ??= rgb(getComputedStyle(document.body).backgroundColor);
      const cs = getComputedStyle(el), oc = rgb(cs.outlineColor);
      const ratio = oc && bg ? (Math.max(lum(oc), lum(bg)) + 0.05) / (Math.min(lum(oc), lum(bg)) + 0.05) : 0;
      return { what: el.outerHTML.slice(0, 70), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0, ratio: Math.round(ratio * 10) / 10 };
    });
    if (info.done) break;
    if (info.skip) continue;
    n++;
    ok(info.style !== "none" && info.width >= 2 && info.ratio >= 3, `${where}: keyboard focus is visible on ${info.what} (outline ${info.style} ${info.width}px, ${info.ratio}:1)`);
  }
  ok(n > 0, `${where}: Tab reaches the links and buttons`);
}

async function accessibility() {
  const browser = await chromium.launch();
  const name = "accessibility";
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
  for (const lang of langs) {
    const L = lang.toUpperCase();
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const p = await context.newPage();
    p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
    const settle = () => p.waitForTimeout(slow ? 500 : 220);
    const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await settle(); };
    const screen = async (where, { focus = false } = {}) => {
      ok(await p.evaluate(() => document.documentElement.lang) === lang, `${L} ${where}: <html lang="${lang}">`);
      await axeCheck(p, ok, `${L} ${where}`);
      await named(p, ok, `${L} ${where}`);
      if (focus) await focusRing(p, ok, `${L} ${where}`);
    };
    await p.goto(`${base}?lang=${lang}`);
    await p.waitForSelector("[data-welcome]");
    ok(await p.$$eval("[data-hlang]", (bs) => bs.every((b) => b.getAttribute("lang") === b.dataset.hlang)), `${L}: each language button is marked with its own language`);
    await screen("welcome", { focus: lang === langs[0] });
    await p.click("[data-welcome]"); await settle();
    if (insts.length) { await screen("university picker"); await p.click(`[data-uni="${firstInst}"]`); await settle(); }
    await screen("home", { focus: lang === langs[0] });
    await p.click('a[href="#/check/0"]'); await settle();
    await screen("question");
    for (let i = 0; i < total; i++) { await p.click(i < 2 ? '[data-answer="yes"]' : '[data-answer="no"]'); await settle(); }
    await screen("result", { focus: lang === langs[0] });
    for (const h of ["#/results", ...eff.levels.map((lv) => `#/preview/${lv.id}`), "#/history", "#/support", "#/about", "#/privacy"]) {
      await go(h);
      await screen(h.slice(2), { focus: lang === langs[0] && (h === "#/about" || h === "#/support") });
    }
    for (const pg of cfg.pages ?? []) {
      await go(`#/${pg.id}`);
      await screen(`page ${pg.id}`, { focus: lang === langs[0] });
      for (const cn of (pg.blocks ?? []).filter((b) => b.concept).map((b) => b.concept)) {
        for (let i = 0; i < cn.screens.length; i++) {
          await p.click(`[data-concept-step="${i}"]`); await settle();
          if (cn.screens[i].type === "permissions") { await p.click("[data-concept-perm]"); await settle(); }
          await screen(`page ${pg.id}, concept screen ${i + 1}`);
        }
      }
    }
    if (lang === langs[0]) {
      for (const inst of insts) {
        await go("#/pick"); await p.click(`[data-uni="${inst.id}"]`); await settle();
        await go("#/support");
        await screen(`support for ${inst.id}`);
      }
    }
    await context.close();
  }

  // Reduced motion: with the phone set to it, nothing on any screen moves.
  for (const reducedMotion of ["reduce", "no-preference"]) {
    const context = await browser.newContext({ ...devices["Pixel 7"], reducedMotion });
    const p = await context.newPage();
    await p.goto(`${base}?lang=${cfg.defaultLanguage}`);
    await p.waitForSelector("[data-welcome]");
    const moving = () => p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => {
      const cs = getComputedStyle(e);
      return [cs.transitionDuration, cs.animationDuration].some((d) => d.split(",").some((x) => parseFloat(x) > 0));
    }).map((e) => e.className || e.tagName));
    const pages = [null, ...(cfg.pages ?? []).map((pg) => pg.id)];
    let any = [];
    for (const pid of pages) {
      if (pid) { await p.evaluate((x) => { location.hash = x; }, `#/${pid}`); await p.waitForTimeout(200); }
      const cn = (cfg.pages ?? []).find((pg) => pg.id === pid)?.blocks?.find((b) => b.concept)?.concept;
      const perm = cn ? cn.screens.findIndex((s) => s.type === "permissions") : -1;
      if (perm > -1) { await p.click(`[data-concept-step="${perm}"]`); await p.waitForTimeout(200); }
      const m = await moving();
      any = any.concat(m);
      if (reducedMotion === "reduce") ok(!m.length, `reduced motion: nothing moves on ${pid ?? "the welcome screen"} (${[...new Set(m)].join(", ")})`);
    }
    if (reducedMotion === "no-preference" && (cfg.pages ?? []).some((pg) => pg.frame || pg.blocks?.some((b) => b.frame || b.concept))) {
      ok(any.length > 0, "without reduced motion, the small transitions are there (so the check above means something)");
    }
    await context.close();
  }
  await browser.close();
}

/* ---------- Saved answers across languages, a reload mid-check-in, and a new week ---------- */

async function edgeCases() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const p = await context.newPage();
  const name = "edge cases";
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`${name}: ${msg}`); };
  p.on("pageerror", (e) => fails.push(`${name}: page error ${e.message}`));
  const settle = () => p.waitForTimeout(slow ? 600 : 260);
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await settle(); };
  const h1 = () => p.textContent("h1");
  const hash = () => p.evaluate(() => location.hash);
  const weeks = () => p.$$eval(".week-list li", (x) => x.length);
  const [first, ...others] = langs;
  // A Wednesday, then the Wednesday after it.
  const day1 = new Date(2026, 10, 18, 10, 0, 0);
  const day8 = new Date(2026, 10, 25, 10, 0, 0);
  await p.clock.setFixedTime(day1);
  await p.goto(`${base}?lang=${first}`);
  await p.waitForSelector("[data-welcome]");
  await p.click("[data-welcome]"); await settle();
  await pickFirst(p, ok, settle);
  const support = levelFor(eff, 2);

  // A check-in in one language is kept, and read, in every other language.
  await p.click('a[href="#/check/0"]'); await settle();
  for (let i = 0; i < total; i++) { await p.click(i < 2 ? '[data-answer="yes"]' : '[data-answer="no"]'); await settle(); }
  ok(await h1() === T(first, `result.levels.${support.id}.title`), `${first}: the check-in gives "${support.id}"`);
  for (const l of others) {
    await p.click(`[data-hlang="${l}"]`); await settle();
    if (!(await hash()).startsWith("#/result/")) { await go("#/"); await p.click('a[href^="#/result/"]'); await settle(); }
    ok(await h1() === T(l, `result.levels.${support.id}.title`), `the result saved in ${first} reads in ${l} (got ${await h1()})`);
    await go("#/history");
    ok(await weeks() === 7, `${l}: My weeks still has the week checked in ${first} (${await weeks()} weeks)`);
    await go("#/");
    ok(Boolean(await p.$(`a[href^="#/result/"]`)), `${l}: Home still shows this week as done`);
  }
  await p.click(`[data-hlang="${first}"]`); await settle();

  // Switching language in the middle of a check-in keeps the answers given so far.
  if (others.length) {
    await go("#/"); await p.click('a[href="#/check/0"]'); await settle();
    await p.click('[data-answer="yes"]'); await settle();
    await p.click(`[data-hlang="${others[0]}"]`); await settle();
    ok(await hash() === "#/check/1", `switching language mid-check-in stays on question 2 (at ${await hash()})`);
    ok((await p.textContent("body")).includes(T(others[0], "checkin.progress", { n: 2, total })), "the progress reads in the new language");
    for (let i = 1; i < total; i++) { await p.click(i < 2 ? '[data-answer="yes"]' : '[data-answer="no"]'); await settle(); }
    ok(await h1() === T(others[0], `result.levels.${support.id}.title`), `the answer given before switching language still counts (got ${await h1()})`);
    await p.click(`[data-hlang="${first}"]`); await settle();
  }

  // A reload mid-check-in starts the check-in again cleanly, and saves one week.
  await go("#/"); await p.click('a[href="#/check/0"]'); await settle();
  await p.click('[data-answer="yes"]'); await settle();
  await p.click('[data-answer="yes"]'); await settle();
  ok(await hash() === "#/check/2", "on question 3 before the reload");
  await p.reload(); await settle(); await settle();
  ok(await hash() === "#/check/0", `after a reload the check-in starts again at question 1 (at ${await hash()})`);
  ok((await p.textContent("body")).includes(T(first, "checkin.progress", { n: 1, total })), "the progress says question 1");
  ok(!(await p.$(".answers .picked")), "no answer is shown as picked after the reload");
  for (let i = 0; i < total; i++) { await p.click('[data-answer="no"]'); await settle(); }
  ok(await h1() === T(first, "result.levels.steady.title"), `the restarted check-in only counts the new answers (got ${await h1()})`);
  await go("#/history");
  ok(await weeks() === 7 && !(await p.$(".week-now")), `one own week, still (${await weeks()} weeks), and no "not done yet" line`);

  // A week later: nothing answered yet, and My weeks says so.
  await p.clock.setFixedTime(day8);
  await p.reload(); await settle();
  await go("#/");
  ok(!(await p.$(`a[href^="#/result/"]`)) && (await p.textContent("body")).includes(T(first, "home.start")), "a new week starts with the check-in, not last week's result");
  await go("#/history");
  const now = await p.$(".week-now");
  ok(Boolean(now) && ((await now?.textContent()) ?? "").includes(T(first, "history.notYet")), "My weeks shows the new week as not done yet");
  ok(await weeks() === 7, `last week's check-in is still listed (${await weeks()} weeks)`);
  const labels = await p.$$eval(".week-now strong, .week-list strong", (x) => x.map((e) => e.textContent));
  ok(labels.length > 1 && labels[0] !== labels[1], `the new week and last week have different dates (${labels.slice(0, 2).join(" / ")})`);
  ok((await p.$$(".chart .col")).length <= 7, "the chart still fits seven weeks");
  await rules(p, ok, first, "new week");
  await p.click(".week-now"); await settle();
  for (let i = 0; i < total; i++) { await p.click('[data-answer="no"]'); await settle(); }
  await go("#/history");
  ok(await weeks() === 8 && !(await p.$(".week-now")), `after the new week's check-in: two own weeks (${await weeks()} weeks)`);
  await browser.close();
}

/* ---------- The link preview for email and chat apps ---------- */

async function shareTags() {
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`link preview: ${msg}`); };
  const html = await (await fetch(base, { cache: "no-store" })).text();
  const unescape = (s) => s?.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");
  const meta = (key) => unescape(html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1]);
  ok(meta("robots") === "noindex", "the page stays noindex");
  if (!cfg.share) { ok(!html.includes("og:title"), "no link preview tags without share in the config"); return; }
  ok(meta("og:title") === cfg.share.title, `og:title is "${cfg.share.title}" (got "${meta("og:title")}")`);
  ok(meta("og:description") === cfg.share.description && meta("description") === cfg.share.description, "og:description and description give the share text");
  ok(meta("og:url") === cfg.publicUrl, "og:url is the public address");
  ok(html.includes(`<html lang="${cfg.defaultLanguage}"`), `the page opens in ${cfg.defaultLanguage}`);
  if (cfg.share.image) {
    ok(meta("og:image") === `${cfg.publicUrl}share.png` && meta("twitter:card") === "summary_large_image", "og:image is a full address, with a large card");
    const res = await fetch(new URL("share.png", base));
    const buf = Buffer.from(await res.arrayBuffer());
    ok(res.ok && buf.subarray(1, 4).toString() === "PNG", "the preview image is served as a PNG");
    ok(buf.length > 24 && buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 630, `the preview image is 1200 × 630 (got ${buf.readUInt32BE(16)} × ${buf.readUInt32BE(20)})`);
    ok(buf.length < 300 * 1024, `the preview image is small (${Math.round(buf.length / 1024)} KB)`);
  }
}

async function desktop() {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`desktop: ${msg}`); };
  p.on("pageerror", (e) => fails.push(`desktop: page error ${e.message}`));
  await p.goto(`${base}?lang=en`);
  await p.waitForSelector("[data-welcome]");
  if (cfg.publicUrl) {
    ok((await p.textContent("body")).includes(T("en", "install.desktopTitle")), "a computer gets the phone link");
    // Over a real network the image arrives a moment after the page: wait for it.
    if (cfg.qr) ok(await until(p, () => { const i = document.querySelector(".qr"); return Boolean(i && i.complete && i.naturalWidth > 0); }, null, 8000), "the QR code loads");
  } else {
    ok(!(await p.$(".install")), "no install help without a public address");
  }
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "fits the window");
  await browser.close();
}

async function offline() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const p = await context.newPage();
  const ok = (cond, msg) => { checks++; if (!cond) fails.push(`offline: ${msg}`); };
  await p.goto(`${base}?lang=en`);
  ok(await until(p, () => !!navigator.serviceWorker.controller, null, 8000) || (await p.reload(), await until(p, () => !!navigator.serviceWorker.controller, null, 8000)), "the offline copy is installed");
  await context.setOffline(true);
  await p.reload();
  ok(await until(p, () => !!document.querySelector("h1")), "opens without a connection");
  await browser.close();
}

console.log(`Testing "${uniId}" at ${base}`);
const runs = [
  ["iPhone SE", () => phone("iPhone SE", webkit, devices["iPhone SE"], "ios")],
  ["iPhone 14", () => phone("iPhone 14", webkit, devices["iPhone 14"], "ios")],
  ["Pixel 7", () => phone("Pixel 7", chromium, devices["Pixel 7"], "android")],
  ["iPhone 14, every result in each language", () => languageFlows("iPhone 14 (each language)", webkit, devices["iPhone 14"])],
  ["Pixel 7, every result in each language", () => languageFlows("Pixel 7 (each language)", chromium, devices["Pixel 7"])],
  ...(insts.length ? [["Pixel 7, every university in each language", () => institutionFlows("Pixel 7 (each university)", chromium, devices["Pixel 7"])]] : []),
  ...(cfg.pages?.length ? [["iPhone SE, the config's pages", () => pageFlows("iPhone SE (pages)", webkit, devices["iPhone SE"])]] : []),
  ["build", buildText],
  ["first language and the header switch", languageStart],
  ["in-app browsers", inAppBrowsers],
  ["accessibility (axe, keyboard focus, language, reduced motion)", accessibility],
  ["saved answers, reloads and a new week", edgeCases],
  ["link preview", shareTags],
  ["desktop", desktop],
  ["offline", offline],
];
try {
  // E2E_ONLY=<part of a name> runs only the matching parts (while working on one).
  for (const [name, run] of runs.filter(([n]) => !process.env.E2E_ONLY || n.includes(process.env.E2E_ONLY))) {
    try { await run(); } catch (e) { fails.push(`${name}: stopped: ${String(e.message ?? e).split("\n")[0]}`); }
  }
} finally {
  if (!live) server.close();
}
console.log(`${checks} checks`);
if (axeMinor.size) console.log(`axe, moderate or minor (not failing): ${[...axeMinor].map(([id, w]) => `${id} (${w})`).join("; ")}`);
if (fails.length) { fails.forEach(annotate); console.error(fails.join("\n")); process.exit(1); }
console.log("all pass");
