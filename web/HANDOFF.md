# Handoff: Quivr reviewer preview (web/)

> **For the next Claude session.** Self-contained. Read it, then `web/README.md` and the repo `CLAUDE.md`. Do not email or contact anyone.

Written 2026-11-14, updated 2026-11-15 after the final polish pass. Made by Florian Braùn and Hélène David.

## What this is, and what it is not

A reviewer preview of CalmCampus made for Quivr (the Flemish student app by Student Innovations vzw) to look at. It is **not a Quivr feature, there is no pilot, and Quivr has not agreed to anything**. The app says so on the welcome screen and on the Quivr view ("Mockup: how this could look in Quivr, not a live Quivr feature"). Never claim a pilot, results, users, awards or a partnership in the app, in docs or in commits.

Live at `https://cc.braunf.com/quivr/` (noindex, not linked from the site's home page).

**Branches.** This branch (`quivr-web-demo`) is `main` plus what is Quivr-specific: `config/universities/quivr.json`, `config/qr/quivr.svg`, `test/quivr.test.mjs` and this file. App changes go on `main` (through a feature branch) and are merged from `main` into this branch, never the other way. No "Co-Authored-By" trailer in commits. The repo is public: no names of people at Quivr or at universities, and nothing they told us in confidence beyond what the app already says.

## How it works

- Quivr's students come from several universities, so the config has `institutions`: KU Leuven, KU Leuven Kulak (Kortrijk), UGent, UAntwerpen, VUB, UHasselt, and "Other institution". After Start, the student picks one ("Which university are you at?", stored as `cc:quivr:uni`, changeable in About, asked again after Start over). Each has its own services, routing and campus number; "Other" shows only the national lines and general advice.
- Languages: Dutch, English, French. The first visit always opens in Dutch, whatever the phone's language (`languageFromBrowser: false`); the header always shows NL, EN and FR with the active one marked (`languageSwitch: "all"`). A language the student picks is kept. Same four questions and ids as the EPFL preview (sleep, planning, energy, connection), each skippable. Levels: 0 steady (support list), 1 notice, 2 support, 3+ care.
- Quivr view (`#quivr-view`), written for a partnership manager to take in in about 30 seconds, five numbered parts in this order: 1. what students see (no download, no development; the generic phone frame labelled Mockup with one CalmCampus card, "Weekly check-in: 4 questions, less than a minute. Private, stays on your phone." / Open; the privacy line); 2. what Quivr gets; 3. the three-week test and its proposed targets; 4. Phase 2 as a concept, not built; 5. "Next step: a 20-minute call", with florian@calm.braunf.com and helene@calm.braunf.com as plain text (no form, no link, no tracking). A unit test keeps it under 220 English words. Whether Quivr has a card slot or push notifications stays a question (below), not a claim.
- For Quivr pages (from About and the Quivr view): What Quivr gets; How we avoid last year's low engagement; Three-week test (every number labelled "Proposed target, to agree with Quivr in advance, not a result"); How we'd measure, privacy-first (design only, nothing built; the example table is labelled Example).
- Guide (About > Things to try), about five minutes: open the Quivr view and tap the card (the whole card is tappable); pick a university; do the check-in; see every possible result; open Support and the emergency numbers; see Phase 1 and Phase 2; read the test plan. Send feedback stays in About (contact@calm.braunf.com, subject "Feedback on the CalmCampus preview (Quivr)", per language).
- Footer on every screen: "We are students, not medical professionals. CalmCampus does not diagnose or treat; ..." (NL and FR translated). The check-in "takes less than a minute"; `npm run check` refuses any time in seconds.
- Privacy: no backend, no analytics, CSP `connect-src 'self'`. The welcome screen, the privacy page, the Quivr view and the measurement page all give the same line (`privacyNote`): "Your answers stay on your phone. The only thing that could ever leave is an optional, anonymous 'count me in' tap (a single number, no answers), and that is a proposal, not built yet." The privacy page cites the GDPR only (no Swiss nLPD for this audience).
- No download, no development for Quivr: the card opens CalmCampus in the Quivr app's own browser (stated on the Quivr view and What Quivr gets). In an in-app browser (iOS WKWebView, Android WebView) the home-screen steps are hidden, the app runs without a service worker, and falls back to memory if storage is off; `npm run e2e` checks the check-in in both. Whether answers are kept from week to week depends on how Quivr's app opens links (ask Quivr).
- Phase 1 → Phase 2 (`#/quivr-phases`, from the Quivr view, About and the guide): Phase 1 is now (card or link, optional weekly push or banner with Quivr's own tools, the three-week test). Phase 2 is an interactive concept labelled "Concept: not built" on every screen: a weekly banner on Quivr's home that comes back only in an unanswered week, the four questions, the weekly overview (example data), and opt-in permissions for sleep, steps and screen time, each off by default. Who does what: CalmCampus builds and maintains the module; Quivr integrates it, ships the update and approves the wording: "low effort for Quivr, not zero: one integration and an app release."
- Website buttons say when the page is in another language than the reader's ("(Dutch only)", "(in het Engels)", "(en anglais)", "(en néerlandais)"), from the page address or `linkLang` (KU Leuven's Dutch page). `npm run e2e` fails if a page in another language has no label; a unit test checks every link in every language has a known page language.
- Example data is explained once, on the welcome screen: "Example data: not from real students."
- Link preview (email, Slack): og:title "CalmCampus × Quivr: preview", a Dutch description and a 1200 × 630 image (`config/share/quivr.png`, text only, no Quivr logo); still noindex.
- Accessibility: `npm run e2e` runs axe-core (WCAG 2.1 A and AA, contrast included) on every screen in all three languages, with zero serious or critical findings; keyboard focus is visible everywhere (cream outline on the dark emergency card); every link and button has a label; `<html lang>` follows the language; nothing moves with reduced motion.
- Edge cases (tested): answers saved in one language are kept and read in the others, also when the language is switched mid-check-in; a reload mid-check-in restarts the check-in cleanly at question 1 (answers in progress are only kept in memory) and still saves one week; a new week without a check-in shows on My weeks as "This week: no check-in yet".
- Copy: informal je / tu / you everywhere; French uses "bilan" for the check-in (as in the app's strings) and the same inclusive forms (étudiant·es, ami·es; the connection question's version went to 2 for that); Belgian national phone format (09 331 00 31, 02 629 23 06).
- No Quivr logo: the header says "voor Quivr-studenten" / "for Quivr students" in text. A logo needs Quivr's permission (`logo.todo`).

## Routing and sources (verified 2026-11-14 on each university's own pages)

| University | 1-2 yes | 3-4 yes | Campus number |
|---|---|---|---|
| KU Leuven | Eerstelijnspsycholoog (Stuvo), 016 32 43 43 | Psycholoog-psychotherapeut (Stuvo), same line | Noodlijn KU Leuven 016 32 22 22 |
| Kulak | Studentenwelzijn en gezondheid (Stuvo Kulak), 056 24 61 38 | same | Noodlijn KU Leuven 016 32 22 22 |
| UGent | Studentenpsychologen, Studentencentrum studentencentrum@ugent.be, 09 331 00 31 | same | Permanentie UGent 09 264 88 88 |
| UAntwerpen | Studentenpsychologen (STIP), stip@uantwerpen.be, 03 265 48 72 | same (PSY-NET is listed; STIP refers to it) | none published |
| VUB | Studentenpsychologen, begeleiding@vub.be, 02 629 23 06 | same (BRUCC is listed) | Security Etterbeek 02 629 11 11 |
| UHasselt | Studentenpsycholoog, studentenpsycholoog@uhasselt.be | same (Student Point is listed) | Fire or accident 011 26 88 88 |
| Other | general advice, national lines | same | none |

National lines (each verified on the operator's own site): 112 (112.be), Zelfmoordlijn 1813, Tele-Onthaal 106, Télé-Accueil 107, Centre de Prévention du Suicide 0800 32 123. Every source URL is in the config (`source`, `sources`), with what is missing in `todo` or `notPublished`.

## Still to do

1. UAntwerpen STIP: the email (stip@uantwerpen.be) is hidden behind a button on the STIP page itself, but printed in plain text on UAntwerpen's own Faculty of Arts page "SOS Mental wellbeing" (`emailSource` in the config, checked 2026-11-15). STIP hours change per period (`todo`).
2. VUB: begeleiding@vub.be is used in every language. VUB's Dutch and English organisation contact pages list it; only the English "contact a student psychologist" page says guidance@vub.be. VUB has no French pages (vub.be/fr redirects to Dutch), so French readers get the Dutch page, labelled "(en néerlandais)" (for BRUCC too). Ask VUB which address to show. Other universities' French readers get the English page, labelled "(en anglais)"; Kulak has only a Dutch page ("(Dutch only)", "(en néerlandais)"), UHasselt's Student Point only an English one ("(in het Engels)").
3. Not dropped but worth a second look: the Community Help Service English line (its own site prints two different numbers, so it is not in the app).
4. Review choices to ask Quivr and the universities: KU Leuven 3-4 yes to the psychologist-psychotherapist (KU Leuven's page: first-line for mild to moderate, psychotherapist for difficulties that disrupt daily life); every other university routes all levels to its first stop. "KU Leuven" means the Leuven Stuvo services; students on other KU Leuven campuses may have their own.
5. Quivr questions: does Quivr have a card or banner slot, push notifications, or only the news section? Does its app open links in its own browser (WKWebView / WebView) or hand them to Safari or Chrome, and does that browser keep storage from week to week (that decides whether My weeks keeps past answers)? Which institutions should the picker list (Quivr's site also names university colleges)? Which test window fits before the exam period? Who approves the card text? Is a 20-minute call the right next step, and who joins it?
6. florian@calm.braunf.com and helene@calm.braunf.com are shown on the Quivr view: make sure both addresses receive mail before sending the link.
7. Re-verify the services if this goes out more than a week after 2026-11-14.

## Not verified

- No test on a real iPhone or Android phone, nor inside the real Quivr app: in-app browsers are simulated in Playwright (plus one real WKWebView run on a Mac).
- The link preview is checked by its tags and image; it was not pasted into a real email client or Slack (that would mean sending it).
- Lighthouse scores are from one run each against the live URL on a laptop, with Lighthouse's simulated mobile throttling; real phones on real networks vary.

## Commands

```bash
cd web
npm run check && npm test && npm run build
npm i --no-save playwright@1.48.2 axe-core@4.10.2 && npx playwright install webkit chromium   # once
npm run e2e                                          # local (Quivr: every language, every university, pages, guide)
E2E_URL=https://cc.braunf.com/quivr/ npm run e2e     # live
rsync -a --delete dist/quivr/ ../../_CalmWeb/docs/quivr/   # deploy, then check-site.py, commit, push _CalmWeb
```
