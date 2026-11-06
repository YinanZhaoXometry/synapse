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

## AFTER — post-split (uniform lazy + framer-motion removed)

**Entry delta:** `index-Bh37Pg3n.js` 1,026,203 B / 275,799 gz → **`index-D9GnkD4R.js`
723,680 B / 202,315 gz** — **−302,523 B min (−29.5%) / −73,484 B gzip (−26.6%)**. Every
in-shell route now loads its own chunk on the uniform `React.lazy` + inline
`<Suspense fallback={null}>` idiom; the entry retains the shell (AppLayout + CommandPalette),
the wall pages, the eager vendor (apollo/radix/lucide/i18n dictionary) and shared api code.

**Largest new route chunks** (per-route chunks that did not exist before the split):

| chunk | min (B) | gzip (B) | note |
| --- | --- | --- | --- |
| PlanHomePage-DO2gsmNy.js | 60,847 | 16,751 | the plans feature (graph canvas included) — the split's biggest prize |
| QuizRunner-B6CwVF_w.js | 19,890 | 5,392 | shared quiz engine, now pulled only by quiz surfaces |
| CompanionPanel-Duda2zDH.js | 18,713 | 5,538 | companion UI (AITutorPage itself is 2.7 kB) |
| PlannerPage-BDR6U6-V.js | 14,932 | 4,279 | hub |
| PlansHomePage-DPKmpHcN.js | 13,877 | 4,485 | front door inside the shell |
| SettingsPage-CTQmM4U6.js | 13,245 | 3,409 | hub |
| DashboardPage-DeAYzZra.js | 9,891 | 3,126 | hub |
| MistakesPage-BJ4-94kt.js | 9,200 | 2,914 | hub |

Reading: the split delivered a real ~30% off the entry — first paint of the wall/plans
front door no longer parses both quiz surfaces, the whole plans feature, companion and
every hub. What remains on the entry is the consciously-deferred vendor + shell weight
(spec decision 4): the residual 706.7 KiB is apollo/radix/lucide + the 106KB i18n
dictionary + AppLayout — a vendor `manualChunks` pass is the noted follow-up if these
numbers ever disappoint. The known over-limit chunks after the tripwire lands (800 KiB)
are the reader-only pdfjs pair — lazy, stable, and paid only when someone reads a PDF.

Full per-chunk listing (every emitted file, sorted by minified size):

| chunk | min (B) | gzip (B) |
| --- | --- | --- |
| pdf.worker.min-B5Yc7dP4.mjs | 1,327,591 | 395,650 |
| **index-D9GnkD4R.js (ENTRY)** | **723,680** | **202,315** |
| pdf-ZbZmwU4y.js | 558,105 | 169,652 |
| jszip.min-B_OysX89.js | 97,569 | 30,199 |
| index-CSL6QWHF.css | 95,417 | 17,655 |
| PlanHomePage-DO2gsmNy.js | 60,847 | 16,751 |
| index-DOYS-yNi.js | 57,875 | 16,507 |
| ReaderPage-nZJ5vl41.js | 52,736 | 14,825 |
| markdown-view-DUMEoQZP.js | 33,771 | 11,690 |
| QuizRunner-B6CwVF_w.js | 19,890 | 5,392 |
| CompanionPanel-Duda2zDH.js | 18,713 | 5,538 |
| index-OgLASBSo.js | 15,710 | 5,242 |
| companion-service-s-Te1-0m.js | 15,104 | 6,385 |
| PlannerPage-BDR6U6-V.js | 14,932 | 4,279 |
| parse-DyJUhSiA.js | 14,289 | 6,126 |
| PlansHomePage-DPKmpHcN.js | 13,877 | 4,485 |
| SettingsPage-CTQmM4U6.js | 13,245 | 3,409 |
| index-BaFPprzZ.js | 13,011 | 4,751 |
| TaskHomePage-BGiQjjg0.js | 12,755 | 4,075 |
| DashboardPage-DeAYzZra.js | 9,891 | 3,126 |
| MistakesPage-BJ4-94kt.js | 9,200 | 2,914 |
| flashcards-page-3Y_9d4Bb.js | 8,950 | 2,689 |
| AnalyticsPage-BO7iSFUl.js | 8,497 | 2,753 |
| OnboardingPage-B10UlIm6.js | 7,714 | 2,340 |
| use-quiz-session-BXraGpKY.js | 7,544 | 2,542 |
| CreationChat-CYgiFAv_.js | 7,490 | 2,819 |
| MaterialsPage-CAka4JV7.js | 6,769 | 2,207 |
| QuizLauncher-C-3jWgYA.js | 6,182 | 2,012 |
| FlashcardsPage-F9IGFnf_.js | 5,944 | 2,064 |
| popover-Bn_n7IzI.js | 5,827 | 2,327 |
| QuizPage-CcclsIln.js | 5,409 | 1,939 |
| quiz-session-page-ccUQZi4R.js | 5,404 | 1,936 |
| hub-queries-C85Bd7rL.js | 5,283 | 1,509 |
| AchievementsPage-DGKAASDN.js | 4,995 | 1,973 |
| annotation-engine-BnzeRt6d.js | 4,776 | 2,026 |
| FlashcardLauncher-D4ecf6bC.js | 3,938 | 1,540 |
| TaskCreatePage-BHSL8dFV.js | 3,928 | 1,707 |
| alert-dialog-D3iWzS7V.js | 3,700 | 1,260 |
| atoms-Do1e4iKN.js | 2,986 | 1,306 |
| index-DVfavjoU.js | 2,852 | 1,162 |
| SquarePlanPage-CTyxmUYs.js | 2,746 | 1,278 |
| material-queries-BDq6vh2h.js | 2,657 | 1,006 |
| AITutorPage-taVyFX5o.js | 2,656 | 1,135 |
| collapsible-BWzaRYfS.js | 2,312 | 1,025 |
| button-C8bCRALy.js | 2,010 | 968 |
| plan-queries-CSkiw67z.js | 1,994 | 733 |
| display-shaping-BCrp2dzm.js | 1,804 | 868 |
| display-shaping-DiNfyiwO.js | 1,700 | 876 |
| use-parse-material-rJVvtIW0.js | 1,670 | 930 |
| node-state-M1g2WtgX.js | 1,376 | 649 |
| PlanQuizPage-Bq26MpR9.js | 1,330 | 723 |
| TaskQuizPage-QRw9Wh-A.js | 1,284 | 712 |
| quiz-queries-DgMPNmP0.js | 1,233 | 480 |
| mapping-queries-BD2ZtTqJ.js | 1,167 | 568 |
| display-shaping-CR7ouTs8.js | 962 | 557 |
| PlanFlashcardsPage-CA-fiIMu.js | 949 | 539 |
| TaskFlashcardsPage-DFSI3ZSv.js | 947 | 554 |
| PlanCreatePage-DueXT6uq.js | 865 | 506 |
| anchors-CT1xzR3Q.js | 808 | 439 |
| upload-validation-jDCB0BM0.js | 735 | 382 |
| reupload-CFvAJyuV.js | 732 | 359 |
| index-B1ID-I_J.js | 691 | 421 |
| square-queries-BRHNfyC-.js | 688 | 395 |
| input-D7ulp97c.js | 580 | 354 |
| badges-wNY3kuTa.js | 554 | 378 |
| index-DCp-5C0O.js | 533 | 316 |
| trash-2-BdohDu2v.js | 526 | 346 |
| file-text-CCQ0gQXa.js | 501 | 320 |
| git-fork-Bt0F3lVy.js | 498 | 331 |
| refresh-cw-BN0srCul.js | 489 | 323 |
| node-state-badge-CIgUfrHL.js | 436 | 306 |
| eye-B3raLq2B.js | 425 | 305 |
| target-B3wd7ta8.js | 395 | 265 |
| info-CYB3s526.js | 373 | 279 |
| rotate-cw-DY10Pe4Q.js | 369 | 287 |
| rotate-ccw-CI6BiQ-H.js | 368 | 284 |
| uuid-BPtmMlcK.js | 343 | 249 |
| arrow-right-CmGQIwkt.js | 333 | 266 |
| arrow-left-DZMWNlql.js | 333 | 267 |
| plus-B6irC4FA.js | 322 | 255 |
| index-Ch_qCilz.js | 315 | 191 |
| loader-circle-DEC8Wz8o.js | 312 | 259 |
| chevron-right-DWvhQH8D.js | 298 | 247 |
| chevron-down-DMDslpnm.js | 296 | 245 |
| check-ZbemoAPH.js | 293 | 246 |
| mastery-Dz2sjvqG.js | 95 | 112 |
| locale-COZdkMzF.js | 62 | 80 |

(plus `dist/index.html` 1.57 kB / 0.72 kB gzip — not in `assets/`, listed for completeness.)

---

**Close-out (ticket 02, 2026-11-06):** epic-19 closed on the numbers above — entry −29.5% min / −26.6% gzip; tripwire live (CI dist-summary step + `chunkSizeWarningLimit: 800`); the residual ~707 KiB entry (vendor + shell + 106KB i18n) and a skeleton fallback stay consciously deferred follow-ups (spec decisions 4/6) — revisit if the CI size summary shows the entry regrowing.
