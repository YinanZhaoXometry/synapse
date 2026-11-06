# Epic-19 bundle report — before/after the route split (ticket 01)

**Method** (spec decision 5 — zero new deps): clean `vite build` (vite 5.4.21, dist wiped
first), then `gzip -k -n -6` over `dist/assets` + `stat` byte counts. "min" = the emitted
file's byte size from `ls`/`stat`; "gzip" = the `gzip -k` companion's byte size. Hashed
filenames are kept so the two tables stay tied to their exact builds.

- **BEFORE** build: branch `p3-19/t01-measure-split` @ `09158bc` (the epic-18 merge state,
  tree untouched), 2026-11-06.
- **AFTER** build: same branch after ticket 01's changes (route split + framer-motion
  removal), 2026-11-06.

## BEFORE — every in-shell route rides the entry

The **entry chunk `index-Bh37Pg3n.js`** (1,026,203 B min / 275,799 B gzip) carries every
page component except the already-lazy reader/task trio, plus all eager vendor
(apollo/radix/lucide), the 106KB i18n dictionary, and the shell. Only pdfjs, jszip, the
markdown-view, the annotation engine and the reader/task trio split out today.

| chunk | min (B) | gzip (B) | what it is |
| --- | --- | --- | --- |
| **index-Bh37Pg3n.js (ENTRY)** | **1,026,203** | **275,799** | every static in-shell page + all eager vendor + shell |
| pdf.worker.min-B5Yc7dP4.mjs | 1,327,591 | 395,650 | pdfjs worker (lazy, reader-only) |
| pdf-ZbZmwU4y.js | 558,105 | 169,652 | pdfjs-dist (lazy, reader-only) |
| jszip.min-DvP4FPMa.js | 97,569 | 30,198 | pptx parse (lazy) |
| index-CSL6QWHF.css | 95,417 | 17,655 | app CSS (single sheet) |
| index-DOYS-yNi.js | 57,875 | 16,507 | existing vendor split |
| ReaderPage-YRuO6Sai.js | 51,705 | 14,396 | lazy route (reader) |
| markdown-view-3YGDxX9K.js | 33,742 | 11,677 | lazy markdown-view |
| index-OgLASBSo.js | 15,710 | 5,242 | shared bit |
| index-ZqH_vCtc.js | 13,011 | 4,750 | shared bit |
| TaskHomePage-DLONltfb.js | 11,764 | 3,667 | lazy route (task home) |
| annotation-engine-CeWs6VfP.js | 4,775 | 2,023 | lazy annotation engine |
| TaskCreatePage-CqU97Arz.js | 3,583 | 1,552 | lazy route (task create) |
| index-DVfavjoU.js | 2,852 | 1,162 | shared bit |
| reupload-CFvAJyuV.js | 732 | 359 | reupload helper |
| index-CdwHl8L0.js | 664 | 409 | shared bit |
| index-DCp-5C0O.js | 533 | 316 | shared bit |
| index-Ch_qCilz.js | 315 | 191 | shared bit |

(plus `dist/index.html` 1.57 kB / 0.72 kB gzip — not in `assets/`, listed for completeness.)

## AFTER — post-split

*(filled in below once the post-split build is measured)*
