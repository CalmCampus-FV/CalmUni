# CalmUni

[![CI](https://github.com/CalmCampus-FV/CalmUni/actions/workflows/ci.yml/badge.svg)](https://github.com/CalmCampus-FV/CalmUni/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

University demos and prototypes for **CalmCampus**, a weekly wellbeing check-in for students that takes less than a minute and keeps every answer on the phone.

> We are students, not medical professionals. CalmCampus does not diagnose or treat. If you need help, we strongly suggest a doctor or your student support service. If you are in crisis, contact your local emergency number or a crisis line.

## What's here

| Path | What it is |
|---|---|
| [`web/`](web/) | The reviewer preview, an installable web app (PWA). One config file per university, no backend, no analytics. See [`web/README.md`](web/README.md) |
| [`published/`](published/) | The exact files of each live demo: [`/quivr/`](https://cc.braunf.com/quivr/), [`/demo/`](https://cc.braunf.com/demo/), [`/epfl/`](https://cc.braunf.com/epfl/), [`/unil/`](https://cc.braunf.com/unil/) |
| [`scripts/`](scripts/) | `check-published.py`, the check CI runs on the published copies |

Each university's version lives on its own branch, `<id>-web-demo`. `main` holds the general preview.

## How a demo goes live

The demos are served at cc.braunf.com by the [CalmWeb](https://github.com/CalmCampus-FV/CalmWeb) Pages site, so every link already sent keeps its address. This repo is the source: build here, copy the build into `published/<id>/`, then run `scripts/sync-demos.sh` in CalmWeb and merge that PR. CalmWeb's CI checks that its copy matches `published/` here. Details in [AGENTS.md](AGENTS.md).

## Related repositories

- [CalmApp](https://github.com/CalmCampus-FV/CalmApp): the iOS app
- [CalmWeb](https://github.com/CalmCampus-FV/CalmWeb): the website at cc.braunf.com
- [CalmBiz](https://github.com/CalmCampus-FV/CalmBiz): company demos
- [CalmCampus](https://github.com/CalmCampus-FV/CalmCampus): research and design archive

## Team

Florian Braùn and Hélène David.

## License

[MIT](LICENSE) © 2026 Florian Braùn, Hélène David.
