// UNIL showcase (web/unil/): the logic of the simulated cases and the wording rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CASES, outcome, weekScore } from "../unil/logic.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../unil");
const html = readFileSync(path.join(dir, "index.html"), "utf8");
const js = readFileSync(path.join(dir, "app.js"), "utf8");
const logic = readFileSync(path.join(dir, "logic.js"), "utf8");
// Visible text only: drop comments, then tags (keep aria-label / alt / content values).
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");
const text = [noComments(html), noComments(js), noComments(logic)].join("\n");

test("each case leads to what it promises", () => {
  const run = (id) => outcome(CASES[id].answers, CASES[id].previous);
  assert.equal(run("A"), "calm");
  assert.equal(run("B"), "gentle");
  assert.equal(run("C"), "support");
  assert.equal(run("D"), "calm");
  assert.equal(CASES.D.data.sleep, false, "D declines data access");
  for (const c of Object.values(CASES)) assert.equal(c.data.steps || c.data.screen, false, "steps and screen time stay off by default");
});

test("phone data never changes the result, skipped questions do not count", () => {
  assert.equal(weekScore({}), null);
  assert.equal(outcome({}, []), "calm");
  assert.equal(weekScore({ now: 2, week: null, sleep: 3 }), 2.5);
  assert.equal(outcome({ now: 2, week: 2, sleep: 2 }, [{ low: true }]), "gentle", "two low weeks in a row is still gentle");
  assert.equal(outcome({ now: 2, week: 2, sleep: 2 }, [{ low: true }, { low: false }]), "gentle", "only the weeks just before count");
  assert.equal(outcome({ now: 2, week: 2, sleep: 2 }, [{ low: false }, { low: true }, { low: true }]), "support");
  assert.ok(!/data\.|sleepContext/.test(outcome.toString()), "outcome() reads answers and past weeks only");
});

test("French only, gentle wording, no claims", () => {
  for (const w of [/\b(Next|Back|Skip|Submit|Cancel|Close|Open|Start|Later|Settings|Example|Mockup|Welcome|Privacy)\b/,
    /burn-?out/i, /diagnos/i, /d[ée]tect/i, /\bGDPR\b|\bRGPD\b/, /intelligence artificielle|\bIA\b|\bAI\b/,
    /pilote|partenariat|utilisateurs|r[ée]compense|badge|s[ée]rie de|streak/i, /seconde/i, /urgent·e|alarm|danger|risque/i]) {
    assert.ok(!w.test(text), `forbidden wording ${w}`);
  }
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), "no emoji");
  assert.ok(!/!\s*</.test(html) && !/[a-zé]\s?!\s/i.test(html), "no exclamation marks in the page");
  assert.match(html, /moins d’une minute|<html lang="fr-CH">/);
  assert.match(js, /moins d’une minute/);
  assert.match(html, /Ce n’est pas l’app officielle\./);
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /nLPD/);
});

test("the disclaimer, contact and footer are there", () => {
  const disc = "CalmCampus est un prototype. Nous ne sommes pas des professionnels de santé. En cas de besoin, parlez à un médecin ou aux services de l’UNIL.";
  assert.ok(html.includes(disc) && js.includes(disc));
  assert.match(html, /mailto:florian@calm\.braunf\.com/);
  assert.match(html, /Florian Braùn/);
  assert.ok(!/calendly|cal\.com|réserver|prendre rendez-vous avec nous/i.test(html), "no booking link");
});

test("services link to unil.ch pages, in a new tab, with their language", () => {
  const urls = [...js.matchAll(/url: U \+ "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(urls.length, 5);
  assert.match(js, /const U = "https:\/\/www\.unil\.ch\/unil\/fr\/home\/"/);
  assert.match(js, /target="_blank" rel="noopener noreferrer" hreflang="fr"/);
  assert.ok(!/https?:\/\/(?!www\.unil\.ch|cc\.braunf\.com)[a-z]/.test(text), "no other site is linked or loaded");
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sendBeacon/.test(js), "no network, no storage");
});
