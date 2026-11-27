#!/usr/bin/env python3
"""Checks for the published demo copies, run by CI and by hand:  python3 scripts/check-published.py

published/<demo>/ holds the exact files served at cc.braunf.com/<demo>/ (CalmWeb copies them
into its docs/<demo>/). This checks that:

1. Every demo folder has an index.html.
2. Every relative href/src in published/**/*.html points at a file inside the same demo folder.
3. No page or stylesheet loads anything from another host (plain <a href> links are fine).
"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
pub = root / "published"
bad = []
demos = sorted(p for p in pub.iterdir() if p.is_dir())
if not demos:
    bad.append("published/ has no demo folders")

for demo in demos:
    if not (demo / "index.html").exists():
        bad.append(f"{demo.relative_to(root)}: missing index.html")

for page in sorted(pub.rglob("*.html")):
    text = page.read_text()
    for ref in re.findall(r'(?:href|src)="([^"]+)"', text):
        if re.match(r"(https?:|mailto:|tel:|data:|blob:|#|/)", ref) or "{" in ref:
            continue  # root-relative paths are served by CalmWeb (site-wide assets)
        target = ref.split("#")[0].split("?")[0]
        if target and not (page.parent / target).exists():
            bad.append(f"{page.relative_to(root)}: missing {ref}")
    for tag in re.findall(r"<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>", text):
        if re.search(r'rel="(?:canonical|alternate)"', tag):
            continue
        for url in re.findall(r'(?:src|href|srcset|data)="(https?://[^"]+)"', tag):
            bad.append(f"{page.relative_to(root)}: external resource {url}")

for css in pub.rglob("*.css"):
    for url in re.findall(r"url\(\s*['\"]?(https?:[^)'\"]+)", css.read_text()):
        bad.append(f"{css.relative_to(root)}: external url() {url}")

print("\n".join(bad) or f"ok ({len(demos)} demos)")
sys.exit(1 if bad else 0)
