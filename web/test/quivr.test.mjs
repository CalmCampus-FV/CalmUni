import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { institutionConfig, linkLanguage } from "../src/lib/config.js";
import { resultFor } from "../src/lib/scoring.js";

// Quivr: a preview for a student app used across Flemish universities. Every service
// and number below was copied from the institution's or the operator's own pages.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const cfg = JSON.parse(read("config/universities/quivr.json"));
const OWN_DOMAIN = { kuleuven: "kuleuven.be", kulak: "kuleuven.be", ugent: "ugent.be", uantwerpen: "uantwerpen.be", vub: "vub.be", uhasselt: "uhasselt.be" };
const answers = (yes) => Object.fromEntries(cfg.questions.map((q, i) => [q.id, i < yes]));

test("Dutch first, then English and French", () => {
  assert.deepEqual(cfg.languages, ["nl", "en", "fr"]);
  assert.equal(cfg.defaultLanguage, "nl");
});

test("the same four questions as the EPFL preview, with the same ids", () => {
  assert.deepEqual(cfg.questions.map((q) => q.id), ["sleep", "planning", "energy", "connection"]);
  for (const q of cfg.questions) assert.ok(q.text.nl && q.text.en && q.text.fr, q.id);
});

test("the universities Quivr covers, then Other", () => {
  assert.deepEqual(cfg.institutions.map((i) => i.id), ["kuleuven", "kulak", "ugent", "uantwerpen", "vub", "uhasselt", "other"]);
});

test("every service comes from the university's own pages, with a date", () => {
  for (const inst of cfg.institutions.filter((i) => i.id !== "other")) {
    for (const [id, s] of Object.entries(inst.services)) {
      const where = `${inst.id}.${id}`;
      assert.match(s.verified, /^\d{4}-\d{2}-\d{2}$/, where);
      for (const url of [s.source, ...(s.sources ?? []), ...Object.values(s.contact.link ?? {})]) {
        assert.ok(new URL(url).hostname.endsWith(OWN_DOMAIN[inst.id]), `${where}: ${url}`);
      }
      for (const field of ["email", "phone", "hours"]) {
        const known = s.contact[field] != null;
        const accounted = [...(s.todo ?? []), ...(s.notPublished ?? [])].some((x) => x.startsWith(field) || x.includes(`${field}`));
        assert.ok(known || accounted, `${where}: ${field} is neither filled nor listed in todo / notPublished`);
      }
    }
  }
});

test("routing: 0 yes to the support list, 1-2 and 3-4 yes to the university's own services", () => {
  const expect = {
    kuleuven: [null, "firstline", "firstline", "psychotherapy", "psychotherapy"],
    kulak: [null, "wellbeing", "wellbeing", "wellbeing", "wellbeing"],
    ugent: [null, "psychologists", "psychologists", "psychologists", "psychologists"],
    uantwerpen: [null, "stip", "stip", "stip", "stip"],
    vub: [null, "psychologists", "psychologists", "psychologists", "psychologists"],
    uhasselt: [null, "psychologist", "psychologist", "psychologist", "psychologist"],
    other: [null, null, null, null, null],
  };
  for (const [id, services] of Object.entries(expect)) {
    const c = institutionConfig(cfg, id);
    services.forEach((svc, yes) => assert.equal(resultFor(c, answers(yes)).level.service, svc, `${id} with ${yes} yes`));
  }
});

test("'Other' gives only the national lines and general advice", () => {
  const c = institutionConfig(cfg, "other");
  assert.deepEqual(Object.keys(c.services), []);
  assert.deepEqual(c.emergency.map((e) => e.tel), ["112", "1813", "106", "107", "080032123"]);
  for (const l of cfg.languages) assert.ok(c.advice[l].length > 40, l);
});

test("national lines verified on the operators' own sites; campus numbers first", () => {
  const sources = Object.fromEntries(cfg.emergency.map((e) => [e.tel, new URL(e.source).hostname]));
  assert.deepEqual(sources, { 112: "www.112.be", 1813: "www.zelfmoord1813.be", 106: "www.tele-onthaal.be", 107: "www.tele-accueil.be", "080032123": "www.preventionsuicide.be" });
  assert.equal(institutionConfig(cfg, "kuleuven").emergency[0].tel, "016322222");
  assert.equal(institutionConfig(cfg, "ugent").emergency[0].tel, "092648888");
  assert.equal(institutionConfig(cfg, "vub").emergency[0].tel, "026291111");
  assert.equal(institutionConfig(cfg, "uantwerpen").emergency[0].tel, "112", "UAntwerpen publishes no campus number");
});

test("it says what it is: a preview for Quivr to review, and a mockup", () => {
  assert.equal(cfg.welcomeNote.en, "This is a preview made for Quivr to review. It is not a Quivr feature, and Quivr has not agreed to anything.");
  const view = cfg.pages.find((p) => p.id === "quivr-view");
  const frame = view.blocks.find((b) => b.frame).frame;
  assert.equal(frame.label.en, "Mockup: how this could look in Quivr, not a live Quivr feature");
  assert.equal(frame.card.text.en, "Weekly check-in: 4 questions, less than a minute. Private, stays on your phone.");
  assert.equal(cfg.logo.image, null, "no Quivr logo without permission");
  assert.equal(cfg.feedback.email, "contact@calm.braunf.com");
  assert.equal(cfg.feedback.subject.en, "Feedback on the CalmCampus preview (Quivr)");
});

test("numbers on the pages are labelled as targets or examples, never as results", () => {
  const tables = cfg.pages.flatMap((p) => (p.blocks ?? []).filter((b) => b.table).map((b) => b.table));
  assert.deepEqual(tables.map((t) => t.label).sort(), ["example", "info", "target", "target"]);
  for (const t of tables.filter((x) => x.label === "target")) assert.equal(t.note.en, "Proposed target, to agree with Quivr in advance, not a result.");
});

test("footer, time claim and names, in every language", () => {
  const ui = Object.fromEntries(cfg.languages.map((l) => [l, JSON.parse(read(`src/i18n/${l}.json`))]));
  assert.ok(ui.en.disclaimer.startsWith("We are students, not medical professionals."));
  assert.ok(ui.nl.disclaimer.startsWith("We zijn studenten, geen zorgverleners."));
  assert.ok(ui.fr.disclaimer.startsWith("Nous sommes des étudiant·es, pas des professionnel·les de santé."));
  for (const l of cfg.languages) assert.ok(ui[l].about.credit.includes("Florian Braùn") && ui[l].about.credit.includes("Hélène David"), l);
  const all = [read("config/universities/quivr.json"), ...readdirSync(new URL("../src/i18n/", import.meta.url)).map((f) => read(`src/i18n/${f}`))].join("\n");
  assert.ok(!/Braun\b|Braün/.test(all), "the surname is Braùn");
  assert.ok(!/under a minute/.test(all), "the claim is \"less than a minute\"");
});

const EN_PRIVACY = "Your answers stay on your phone. The only thing that could ever leave is an optional, anonymous ‘count me in’ tap (a single number, no answers), and that is a proposal, not built yet.";
const EN_NO_DOWNLOAD = "No download for students and no development for Quivr: Quivr adds one card or link in its app, and CalmCampus opens inside the Quivr app's own browser.";
const page = (id) => cfg.pages.find((p) => p.id === id);
const notes = (id) => (page(id).blocks ?? []).flatMap((b) => [b.note, ...(b.box ?? []).map((x) => x.note)]).filter(Boolean);

test("always opens in Dutch, and the header shows all three languages", () => {
  assert.equal(cfg.languageFromBrowser, false);
  assert.equal(cfg.languageSwitch, "all");
});

test("the same privacy line on the welcome screen, the Quivr view and the measurement page", () => {
  assert.equal(cfg.privacyNote.en, EN_PRIVACY);
  for (const id of ["quivr-view", "quivr-measure"]) {
    assert.ok(notes(id).some((n) => JSON.stringify(n) === JSON.stringify(cfg.privacyNote)), id);
  }
  const text = JSON.stringify(cfg);
  assert.ok(!/nothing (ever )?leaves|everything stays|niets verlaat|alles blijft op|rien ne quitte|tout reste sur/i.test(text), "no absolute wording");
});

test("no Swiss nLPD for a Belgian audience", () => {
  const all = [read("config/universities/quivr.json"), ...readdirSync(new URL("../src/i18n/", import.meta.url)).map((f) => read(`src/i18n/${f}`))].join("\n");
  assert.ok(!all.includes("nLPD"));
});

test("VUB in French: the Dutch page, labelled, and begeleiding@vub.be", () => {
  const vub = cfg.institutions.find((i) => i.id === "vub");
  const ps = vub.services.psychologists.contact;
  assert.ok(new URL(ps.link.fr).pathname.startsWith("/nl/"));
  assert.equal(linkLanguage(ps, "fr"), "nl", "so the button says (en néerlandais)");
  assert.equal(JSON.parse(read("src/i18n/fr.json")).service.pageIn.nl, "(en néerlandais)");
  assert.equal(ps.email, "begeleiding@vub.be");
  for (const s of Object.values(vub.services)) assert.ok(!s.contact.link.fr.includes("/en/"), "no English page for French readers");
});

test("'Other institution' reads naturally in French and English", () => {
  const other = cfg.institutions.find((i) => i.id === "other");
  assert.ok(other.advice.fr.startsWith("Les services aux étudiant·es de ton établissement"));
  assert.ok(other.advice.en.startsWith("Your institution's student services"));
  assert.ok(!/studentenvoorzieningen|Stuvo/.test(other.advice.fr + other.advice.en));
});

test("no download for students, no development for Quivr: on the Quivr view and What Quivr gets", () => {
  assert.ok(page("quivr-view").blocks.some((b) => b.p?.en === EN_NO_DOWNLOAD));
  assert.ok(notes("quivr-gets").some((n) => n.en === EN_NO_DOWNLOAD));
});

test("Phase 1 and Phase 2: reachable from the Quivr view and the guide; the concept is labelled and opt-in", () => {
  const phases = page("quivr-phases");
  assert.ok(page("quivr-view").blocks.some((b) => b.links?.includes("quivr-phases")));
  assert.ok(cfg.tries.some((x) => x.href === "#/quivr-phases"));
  const concept = phases.blocks.find((b) => b.concept).concept;
  assert.deepEqual([concept.label.nl, concept.label.en, concept.label.fr], ["Concept: niet gebouwd", "Concept: not built", "Concept : pas développé"]);
  assert.deepEqual(concept.screens.map((x) => x.type), ["banner", "questions", "overview", "permissions"]);
  const perms = concept.screens.find((x) => x.type === "permissions");
  assert.deepEqual(perms.items.map((x) => x.id), ["sleep", "steps", "screen"]);
  assert.ok(perms.items.every((x) => !("default" in x)), "nothing is switched on in the config");
  assert.equal(perms.note.en, "All data stays on your phone and is never sent to Quivr or CalmCampus.");
  assert.ok(phases.blocks.some((b) => b.note?.en === "Low effort for Quivr, not zero: one integration and an app release."));
});

test("every website link, in every language, has a known page language (so a label shows when it differs)", () => {
  const ui = Object.fromEntries(cfg.languages.map((l) => [l, JSON.parse(read(`src/i18n/${l}.json`))]));
  for (const inst of cfg.institutions) {
    for (const [id, s] of Object.entries(inst.services ?? {})) {
      for (const lang of cfg.languages) {
        const pl = linkLanguage(s.contact, lang);
        assert.ok(cfg.languages.includes(pl), `${inst.id}.${id} (${lang}): page language unknown`);
        if (pl !== lang) assert.ok(ui[lang].service.pageIn[pl], `${inst.id}.${id} (${lang}): no label text for a page in ${pl}`);
      }
    }
  }
});

test("UAntwerpen STIP: the email published in plain text on a uantwerpen.be page, with its source", () => {
  const stip = cfg.institutions.find((i) => i.id === "uantwerpen").services.stip;
  assert.equal(stip.contact.email, "stip@uantwerpen.be");
  assert.ok(new URL(stip.emailSource).hostname.endsWith("uantwerpen.be"));
  assert.ok(stip.sources.includes(stip.emailSource));
  assert.equal(stip.contact.phone, "03 265 48 72");
  assert.ok(!(stip.todo ?? []).some((t) => t.startsWith("email")));
});

test("phone numbers in the Belgian national format", () => {
  const phones = cfg.institutions.flatMap((i) => [...Object.values(i.services ?? {}).map((s) => s.contact.phone), ...(i.emergency ?? []).map((e) => e.number)]).filter(Boolean);
  for (const n of [...phones, ...cfg.emergency.map((e) => e.number)]) {
    assert.match(n, /^(0\d{1,3}( \d{2,3}){2,3}|0800 \d{2} \d{3}|\d{3,4})$/, n);
  }
  for (const e of cfg.institutions.flatMap((i) => i.emergency ?? [])) assert.equal(e.tel, e.number.replace(/\s/g, ""));
});

test("the Quivr view: five things in order, ending with a 20-minute call and two addresses as plain text", () => {
  const b = page("quivr-view").blocks;
  const heads = b.filter((x) => x.h).map((x) => x.h.en);
  assert.deepEqual(heads, ["1. What students see", "2. What Quivr gets", "3. A three-week test, with targets agreed in advance", "4. Phase 2: a concept, not built"]);
  const at = (pred) => b.findIndex(pred);
  assert.ok(at((x) => x.frame) > at((x) => x.h?.en.startsWith("1.")) && at((x) => x.frame) < at((x) => x.h?.en.startsWith("2.")), "the card is under What students see");
  assert.ok(at((x) => x.table?.label === "target") > at((x) => x.h?.en.startsWith("3.")), "the targets are under the test");
  const last = b.at(-1).box;
  assert.equal(last[0].h.en, "Next step: a 20-minute call");
  for (const l of cfg.languages) assert.ok(last[1].p[l].includes("florian@calm.braunf.com") && last[1].p[l].includes("helene@calm.braunf.com"), l);
  assert.ok(!JSON.stringify(b).includes("mailto:"), "contact text only, no form or link");
  const words = (l) => {
    const text = [];
    const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === l) text.push([].concat(v).join(" ")); else if (k !== "table" && k !== "frame") walk(v); } };
    walk(b);
    return text.join(" ").split(/\s+/).length;
  };
  assert.ok(words("en") < 220, `short enough to take in in about 30 seconds (${words("en")} words, headings included)`);
  for (const l of cfg.languages) assert.ok(words(l) <= words("en") * 1.2, `${l}: no longer than the English, give or take (${words(l)} words)`);
});

test("link preview: Dutch by default, and still noindex", () => {
  assert.equal(cfg.share.title, "CalmCampus × Quivr: preview");
  assert.ok(cfg.share.description.includes("minder dan een minuut"));
  assert.ok(!/partner|samenwerking|pilot/i.test(cfg.share.description + cfg.share.imageAlt));
  assert.equal(cfg.share.image, "config/share/quivr.png");
  assert.ok(read("src/index.html").includes('<meta name="robots" content="noindex">'));
});

test("French uses \"bilan\" for the check-in, like the app's own strings", () => {
  const fr = [];
  const walk = (o) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "fr" && typeof v === "string") fr.push(v); else if (k === "fr" && Array.isArray(v)) fr.push(...v.flat()); else walk(v); } };
  walk(cfg);
  assert.ok(!fr.some((x) => /check-in/i.test(x)), fr.filter((x) => /check-in/i.test(x)).join(" | "));
});
