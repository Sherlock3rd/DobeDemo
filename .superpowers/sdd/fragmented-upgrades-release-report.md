# Fragmented Building Upgrades — Release Report

## Published revisions

- Main source head at release: `4b0ab5a`
- GitHub Pages production commit: `46a902545864952bfae07153d3ed934c1e2aa08d`
- Public URL: `https://sherlock3rd.github.io/DobeDemo/`
- Release method: normal fast-forward pushes only; no force push

The unpublished layout/drag work and the fragmented upgrade feature were split into 13 source commits. The
13,691,237-byte `example/levelupExample.mp4` reference was kept in its own asset commit, below GitHub's 100 MB
single-file limit.

## Fresh release gate

Immediately before publishing:

- `npm.cmd run format:check`: exit 0
- `npm.cmd run typecheck`: exit 0
- `npm.cmd run lint`: exit 0
- `npm.cmd test`: 32 files, 391 tests passed
- `npm.cmd run build`: exit 0
- Production assets: `index-DKZurk8k.js` and `index-CWQQiqnw.css`
- Browser acceptance: 30/30 live CDP assertions passed, including fragmented progression, confirmation,
  persistence, Lv.10, responsive bounds, process ownership, and cleanup

Final read-only review of `5062804..4b0ab5a` found no Critical or Important issues.

## Pages publication

The verified `dist` tree was staged through an isolated temporary Git index and committed directly on top of the
existing remote `gh-pages` history. The temporary index and local release ref were removed after the successful
push.

Public verification:

- HTML: HTTP 200 and references the expected current hashes
- `/DobeDemo/assets/index-DKZurk8k.js`: HTTP 200
- `/DobeDemo/assets/index-CWQQiqnw.css`: HTTP 200
- Real headless Chrome loaded the public URL and rendered the current city/HUD successfully
- Screenshot: `.superpowers/sdd/fragmented-upgrades-pages.png`

The exact published asset hashes are the same build that passed the complete local CDP interaction flow.
