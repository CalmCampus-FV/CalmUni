# Handoff: UNIL showcase (web/unil/)

> **For the next Claude session.** Self-contained. Read it, then the repo `CLAUDE.md`. Do not email or contact anyone.

Written 2026-11-18. Made by Florian Braùn and Hélène David.

## What this is, and what it is not

A one-page demo for the Université de Lausanne (UNIL): the Service d'orientation et carrières, its psychologists and student services. It shows how CalmCampus could look as a **small, discreet part of the official "UNIL Campus" app** instead of a separate app. It is **a mockup**. It is not the UNIL Campus app, there is no pilot, and UNIL has not agreed to anything. The page says so in a bar at the top: "Maquette : à quoi CalmCampus pourrait ressembler dans UNIL Campus. Ce n'est pas l'app officielle." Never claim a pilot, users, results, partnerships or awards. No UNIL logo is used.

- **Live:** https://cc.braunf.com/unil/ (noindex, nofollow; not linked from the site's home page, not in the sitemap)
- **Code:** branch `unil-web-demo` in `lumenworksco/-CalmCampus`, made from `quivr-web-demo`. The deployed build is commit `95e777b`. This file was added in the next commit.
- **Deploy:** `_CalmWeb` commit `019f43e` ("unil preview: first version (CalmCampus 95e777b)"). Only `docs/unil/` was added. Quivr, EPFL and the general demo were not touched or redeployed.

## Why it is not a config like Quivr or EPFL

The other branches are the student PWA, configured per university. UNIL asked for something else: a page for **staff**, with a phone mockup of *their* app around CalmCampus. So this branch adds a small self-contained static page in `web/unil/` with its own build step (`scripts/build-unil.mjs`). The shared app code, `scripts/build.mjs` and the configs are unchanged. **This breaks the "university branches only add a config" rule** on purpose. If the showcase format is reused for another university, move it to `main` as a generic "host app mockup" and make it config-driven.

Files on this branch, beyond the Quivr branch:

- `web/unil/index.html`, `styles.css`, `app.js`: the page and the interactive mockup (vanilla JS, no dependencies).
- `web/unil/logic.js`: the cases and the message rule, with no DOM, unit-tested.
- `web/test/unil.test.mjs`: logic and wording rules (French only, no "détecte/diagnostic/burn-out", no AI, no claims, no GDPR, no emoji or exclamation marks, the disclaimer, contact, footer, and links only to www.unil.ch/unil/fr).
- `web/test/unil-e2e.mjs`: Playwright run of every case on iPhone SE (320 px), iPhone 14, Pixel 7 and desktop, in WebKit and Chromium. It checks axe (WCAG 2.1 A/AA + best practice, zero serious or critical), horizontal overflow, keyboard paths (Enter opens, Escape closes, Space toggles, visible focus on each tab stop), the expected text per case, link attributes, and that no request goes to another origin. With `SHOTS=<dir>` it saves screenshots.
- `web/scripts/make-unil-share.mjs` → `web/config/share/unil.png`: the 1200 × 630 link preview (text plus a generic phone, no logo).
- `npm run build:unil` (tests + build), `npm run dev:unil`, `npm run e2e:unil`.

The Quivr files (`config/universities/quivr.json`, its QR and share image, `test/quivr.test.mjs`) are still on this branch, inherited and unused here.

## What is simulated and what is real

| Real | Simulated (made up for the demo) |
|---|---|
| UNIL service names, descriptions, phones, e-mails and page links (verified below) | The UNIL Campus home screen (placeholder rows, no real data, rows are not interactive) |
| The four questions and their wording | Previous weeks for each case (A, B, D: two ordinary weeks; C: two harder weeks) |
| The message rule (`logic.js`), the same for every case | Sleep data ("Selon votre téléphone, sommeil …"), labelled **Exemple** |
| Nothing is stored or sent: state lives in memory, gone on reload; CSP `connect-src 'none'`; no analytics | The phone-data switches (they change no real permission) |

**Rule:** a week counts as "harder" when the mean of the answered scale questions (1–5) is 2.5 or less. Skipped questions don't count, and the free text is never read. Calm week → thank-you only. One harder week → "Une semaine difficile, ça arrive." with a light link to the services. This week and the two before all harder → a calm suggestion with the services listed. **Phone data never changes the result** (as in the rest of CalmCampus); sleep only adds context. Case D (data declined) works on the four answers alone. The threshold and the three-week rule are a proposal for UNIL's psychologists to change. They are not a clinical cut-off.

Cases (control "Simuler un étudiant" next to the phone; `?cas=B` opens a case directly; "Voir directement l'écran final" skips the questions):

- **A. Une semaine normale:** thank-you only, no nudge.
- **B. Une semaine difficile:** "Une semaine difficile, ça arrive." plus a light link to the services, no push to consult.
- **C. Plusieurs semaines difficiles:** a calm suggestion and the services listed with contact details, plus one small line with emergency numbers.
- **D. Refuse l'accès aux données:** sleep switch off; "Sans données du téléphone : vos quatre réponses suffisent."

## UNIL services: verified on unil.ch on 2026-11-18

All pages are in French (links carry `hreflang="fr"`, a visible "FR" tag, and "s'ouvre dans un nouvel onglet" for screen readers).

| Service | Page | Contact used (as printed on the page) |
|---|---|---|
| Accueil Santé | https://www.unil.ch/unil/fr/home/menuinst/campus/aides-et-soutiens/sante.html | +41 21 692 25 77, accueilsante@unil.ch (Anthropole 1056) |
| Consultation psychothérapeutique (Département de psychiatrie du CHUV, for UNIL students) | https://www.unil.ch/unil/fr/home/menuinst/campus/aides-et-soutiens/sante/sante-mentale.html | consult.psy-unil@chuv.ch (appointments by e-mail; 1 to 4 sessions; first one free) |
| Consultations sociales: "Accompagnement social - écoute et orientation" (SASME) | https://www.unil.ch/unil/fr/home/menuinst/campus/aides-et-soutiens/soutien-social.html | +41 21 692 60 30 and affaires.sociales@unil.ch (from the "Aides et soutiens" hub page: https://www.unil.ch/unil/fr/home/menuinst/campus/aides-et-soutiens.html) |
| Aides financières et dispenses de l'Unil (SASME) | https://www.unil.ch/unil/fr/home/menuinst/campus/aides-et-soutiens/aides-financieres-et-administratives/aides-financieres-unil.html | affaires.sociales@unil.ch |
| Service d'orientation et carrières (SOC) | https://www.unil.ch/unil/fr/home/menuinst/universite/organisation-universite/unites-et-services/service-orientation-et-carrieres.html | +41 21 692 21 30, orientation@unil.ch |
| Urgences UNIL | https://www.unil.ch/unil/fr/home/urgences.html | Campus emergency 24 h/24: 021 692 20 00 (115 from an internal phone); ambulance 144; CTMG (médecin de garde, Vaud) 0848 133 133 |

## Not verified / open

1. **The UNIL Campus look.** It is based on the 2020 App Store screenshots: a white list of line icons with labels, a gear at top left, a blue "UNIL Campus" title in small caps, and a grey info card at the top, which is where the CalmCampus card sits. The current version (14.x) may look different. The Play Store page returned 404. **Ask UNIL for a current screenshot**, or check on a phone. The blue (#006AAE) is chosen for contrast; it is not UNIL's official colour.
2. **Old SASME and SOC sites** (`www.unil.ch/sasme/…`, `www.unil.ch/soc/…`) now redirect to `www2.unil.ch` and return 404. The links above are the current pages under `/unil/fr/`.
3. **Not on unil.ch, so not in the app:** La Main Tendue (143), and the "021 692 21 21" number that some older materials mention. The UNIL emergency page lists 021 692 20 00. The emergency page also mentions psychiatric emergencies (canton de Vaud) with a link to the CHUV. That is left out because the number to show was not clear; ask UNIL whether to add it.
4. **SOC phone hours** (search results say 13:00–15:00) and SASME hours (Monday, Thursday and Friday 10:00–13:00 by phone, per the hub page) are not shown in the app. Show them if UNIL wants.
5. **Questions for UNIL:** Does UNIL Campus (PocketCampus) have a slot for a weekly card, and can a module read HealthKit / Health Connect sleep data? Who approves the wording (SOC psychologists)? Is the rule above (2.5 mean, three weeks) acceptable, or does the team prefer another one? Should the card point to the SOC first for study-related difficulties?
6. **Lighthouse (mobile, live URL, one run, 2026-11-18):** Performance 98, Accessibility 100, Best practices 100. SEO 63, **only** because the page is `noindex` by design (`is-crawlable`).
7. The link preview was checked by its tags and image only, not pasted into a real mail client or chat.
8. Not tested on a real iPhone or Android phone, only in Playwright WebKit and Chromium.
9. Make sure florian@calm.braunf.com receives mail before sending the link.
10. Re-verify the services if the link goes out more than a week after 2026-11-18.

## Commands

```bash
cd web
npm run build:unil                                   # unit tests + build dist/unil/
npm i --no-save playwright@1.48.2 axe-core@4.10.2    # once
npm run e2e:unil                                     # local
E2E_URL=https://cc.braunf.com/unil/ npm run e2e:unil # live
rsync -a --delete dist/unil/ ../../_CalmWeb/docs/unil/   # deploy, then check-site.py, commit, push _CalmWeb
```
