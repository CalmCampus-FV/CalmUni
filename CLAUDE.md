# CalmUni

CalmUni is the source of truth for the CalmCampus university demos and prototypes: the reviewer preview web app (PWA) in `web/`, one config per university, and the published copies of every demo that is live on cc.braunf.com. Company demos live in [CalmCampus-FV/CalmBiz](https://github.com/CalmCampus-FV/CalmBiz), the website in [CalmCampus-FV/CalmWeb](https://github.com/CalmCampus-FV/CalmWeb), the iOS app in [CalmCampus-FV/CalmApp](https://github.com/CalmCampus-FV/CalmApp), and the research and design archive in [CalmCampus-FV/CalmCampus](https://github.com/CalmCampus-FV/CalmCampus).

## Layout

- `web/` - the reviewer preview PWA (vanilla JS, no runtime deps). One JSON config per university in `web/config/universities/`. History comes from `web/` in the CalmCampus repo. See `web/README.md`.
- `published/<demo>/` - the exact files that are live at `https://cc.braunf.com/<demo>/` (`quivr`, `demo`, `epfl`, `unil`). CalmWeb serves them from its `docs/<demo>/`, copied from here by `scripts/sync-demos.sh` in CalmWeb.
- `scripts/check-published.py` - checks that the published copies are complete and load nothing from other hosts.

## Branches

- `main` holds the general preview (`default` config), the published copies and the repo docs.
- Each university has its own branch `<id>-web-demo` (today `epfl-web-demo`, `quivr-web-demo`, `unil-web-demo`), made from `main`. It only adds its config, QR code, `test/<id>.test.mjs` and `web/HANDOFF.md`. Make app changes on `main` and merge `main` into the university branches, never the other way.

## Publishing a demo (links already sent must keep working)

cc.braunf.com is the GitHub Pages site of CalmWeb (custom domain, behind Cloudflare). Pages from this repo would not appear under that domain, so CalmWeb keeps the served copy and this repo is the source:

1. On the university branch: `cd web && npm run check && npm test && npm run build`.
2. On a branch from `main`: copy only that demo's build into `published/<id>/` (for example `rm -rf published/<id> && cp -R web/dist/<id> published/<id>`; the general preview goes from `web/dist/` on `main` into `published/demo/`, without the university folders). Open a PR, CI green, squash-merge.
3. In CalmWeb: `bash scripts/sync-demos.sh`, open a PR, CI green (its demo sync check compares `docs/<demo>/` with `published/<demo>/` here), squash-merge. Pages publishes within a few minutes.

Never rename or remove a published folder: the URLs (`/quivr/`, `/quivr/?lang=en`, `/demo/`, `/epfl/`, `/unil/`) have been sent to universities.

## Own Pages site and the calmcampus.app move (prepared, not live yet)

- `.github/workflows/pages.yml` publishes `published/` as this repo's own GitHub Pages site on every push to `main`: today at `https://calmcampus-fv.github.io/CalmUni/<demo>/`. `published/index.html` is a small landing page for the root.
- Planned custom domain: `uni.calmcampus.app` (in `published/CNAME`). With an Actions deploy GitHub ignores that file; the domain is switched on in Settings > Pages only after its DNS record exists, so nothing breaks before then.
- The links already sent (`cc.braunf.com/quivr/`, `/quivr/?lang=en`, `/demo/`, `/epfl/`, `/unil/`) keep being served by CalmWeb from its copies in `docs/<demo>/`. Keep syncing CalmWeb after every demo change until Florian decides those copies can become redirects.

## Commands

```bash
python3 scripts/check-published.py
cd web && npm run check && npm test && npm run build   # then npm run e2e (needs Playwright, see web/README.md)
```

CI (`.github/workflows/ci.yml`) runs both on every branch. `.github/workflows/claude.yml` is the Claude Code action (write access, triggered by `@claude`); it needs the `CLAUDE_CODE_OAUTH_TOKEN` repository secret.

## Wording rules (all CalmCampus copy)

- Never claim pilots, results, partnerships or detection. No "early signs", no "stop burnout", no claim that CalmCampus finds burnout or gets students to seek help. Wellness wording only ("supports").
- Every user-facing surface carries the full disclaimer: we are students, not medical professionals; CalmCampus does not diagnose or treat; we strongly suggest a doctor or student support.
- The check-in takes less than a minute. Answers stay on the phone (in the browser's local storage for the web preview); nothing is sent anywhere.
- No em dashes. Names: Florian Braùn (with the ù) and Hélène David.
- No third-party scripts, fonts, analytics or embeds. Labelled example data is allowed only in preview builds and is always marked Example.

Known issue: the current `web/` source and the published copies still use "early signs" in the disclaimer and descriptions (`web/src/index.html`, `web/scripts/build.mjs`, `web/scripts/check.mjs`, the i18n strings). Fix it in `web/`, rebuild, then republish; do not hand-edit `published/`.
