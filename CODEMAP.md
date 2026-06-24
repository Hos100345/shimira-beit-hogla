# CODEMAP — מערכת שיבוץ שמירות בית חוגלה

> מפת-עזר מהירה לניפוי תקלות. חפש `§` בעורך GAS לניווט בין השכבות.

---

## גרסה וקבועים (שורות 1–33)

| קבוע | ערך |
|---|---|
| `GS_VERSION` | `'v2.6'` (שורה 25) |
| `SHEET_SETTINGS` | `'⚙️ הגדרות'` |
| `SHEET_GUARDS` | `'👥 שומרים'` |
| `SHEET_AVAIL` | `'📋 זמינות'` |
| `SHEET_SCHEDULE` | `'🗓️ לוח שמירות'` |
| `SHEET_EXTERNAL` | `'📅 שומרים חיצוניים'` |
| `SHEET_HISTORY` | `'📊 היסטוריה וחוב'` |
| `SHEET_QUICK` | `'⚡ מילוי מהיר'` |
| `SHEET_MANAGER` | `'📊 מבט מנהל'` |

---

## § A · UTILITIES (שורות 34–120)

| פונקציה | שורה | תיאור |
|---|---|---|
| `ratingToCost_(mark)` | 34 | ממיר דירוג (1-5 / X / ריק) לעלות מספרית. X=Infinity, ריק=1 |
| `partnerCoversBlock_(label, range)` | 46 | בודק אם שותף חיצוני מכסה בלוק לילה (02-04 / 04-06) |
| `isBlocked_(mark)` | 57 | האם הסימון = X (חסום קשיח) |
| `buildBlocks_()` | 64 | מחזיר 20 בלוקי זמן ביממה (06:00–06:00 הבאה) |
| `isShabbat_(day, hour, cfg)` | ~1360 | האם הבלוק נמצא בחלון שבת/חג לפי הגדרות |
| `blockWeight_(day, block, weights, cfg, marks)` | ~1367 | משקל קושי של בלוק (1-3), מוסיף שקלול שבת |
| `mgmt_()` | ~1353 | מחזיר את ה-Spreadsheet (מהcache או active) |
| `readGuards_(ss)` | ~1358 | מחזיר מערך שמות שומרים מ-SHEET_GUARDS |
| `getCleanSheet_(ss, name)` | ~1365 | מחזיר לשונית נקייה (יוצר אם לא קיימת) |
| `styleHeader_(range)` | ~1372 | עיצוב כותרת: bold, כחול כהה, טקסט לבן |

---

## § B · ENTRY POINTS (שורות 121–501)

נקראות ישירות מהתפריט / טריגר / ממשק web.

| פונקציה | שורה | תיאור |
|---|---|---|
| `onOpen()` | 121 | בונה תפריט |
| `setupV2()` | 145 | הקמה / שדרוג — יוצר את כל הלשוניות |
| `createAvailabilityFile()` | 242 | יוצר קובץ זמינות משותף |
| `rebuildAvailabilityIn_(ss, guards)` | ~250 | בונה/שדרג לשונית זמינות (טבלה + בדיקות) |
| `createInstructionsSheet()` | 325 | יוצר לשונית הוראות |
| `createExternalFile()` | 365 | יוצר/מעדכן קובץ שומרים חיצוניים |
| `buildExternalSheet_(sh)` | ~392 | בונה מבנה לשונית חיצוניים |
| `runQuickFill()` | 405 | מפעיל מילוי מהיר |
| `processQuickFill_(mgmt)` | ~411 | ממלא זמינות מטבלת קיצור |
| `updateTrafficLights()` | 448 | מעדכן עמודת רמזור זמינות |
| `calcRequiredHours_(mgmt, guards, cfg)` | ~482 | מחשב כמה שעות פנימיות נדרשות לכיסוי מלא |
| `resetAvailability()` | ~1380 | מאפס זמינות לשבוע חדש (→ 1 לכולם) |
| `setupTriggers()` | ~1400 | מגדיר טריגר שבועי לאיפוס |
| `fillExternalJune()` | ~1408 | ממלא לוח חיצוניים ליוני 2026 |
| `doGet(e)` | ~1430 | ממשק HTML לשומר |
| `saveGuardPreferences(payload)` | ~1442 | שומר זמינות מהממשק |
| `loadInterfaceResponsesFromUI()` | — | טוען תגובות ממשק (מהתפריט) |

---

## § C · CORE SCHEDULING (שורות 503–678)

```
runScheduler()
  Phase 0: buildPlan_(cfg, hardCap, preloadedRows)
  Phase A: hardCap++  × עד 12
  Phase B/C: MIN_REST_TIME--  עד min=2
  Phase D: MAX_SHIFT_LENGTH +2
  Phase E: emergencyMode=true (דירוג 5 מותר)
  → writeScheduleResult_()

buildPlan_()
  chooseBest_()   ← בחר שומר לכל בלוק
    backtrack_()  ← אם נכשל, חזור 3 שעות אחורה
      chooseBestExcluding_()
  applyAssign_()
  getPartner_()
```

| פונקציה | שורה | תיאור |
|---|---|---|
| `runScheduler()` | 503 | מנוע שיבוץ ראשי — 5 שלבי דרדור, מעדכן לוח |
| `replanSchedule()` | 576 | שיבוץ חלופי (jitter=false) |
| `extendAndReplan()` | 588 | שיבוץ עם hardCap+1 |
| `buildPlan_(mgmt, guards, cfg, hardCap, maxShiftOverride, jitter, emergencyMode, preloadedRows)` | 604 | בנה תוכנית שיבוץ מלאה |
| `chooseBest_(guards, r, st, hardCap, maxShift, futureManualHours, cfg, jitter, excluded, emergencyMode)` | ~865 | בחר שומר אופטימלי לבלוק |
| `applyAssign_(st, g, r)` | ~855 | עדכן מצב שומר לאחר שיוך |
| `backtrack_(decisions, rows, st, guards, failIdx, cfg, hardCap, maxShift, futureManualHours, jitter, emergencyMode)` | ~935 | חזור אחורה ונסה הצבה אחרת |
| `chooseBestExcluding_(...)` | ~983 | כמו chooseBest_ אך מדלג על קבוצה |
| `getPartner_(guards, g, r, st, cfg)` | ~916 | בחר שותף פנימי לשמירת לילה |

### פרמטרי buildPlan_ — עזר מהיר

```
buildPlan_(mgmt, guards, cfg, hardCap, maxShiftOverride, jitter, emergencyMode, preloadedRows)
                              ↑            ↑ null=קבוע   ↑false  ↑false=חסם X    ↑ null=קרא שוב
                           מספר שעות                   דטרמיניסטי  true=X-soft מותר
```

---

## § D · WRITERS (שורות 679–1004)

| פונקציה | שורה | תיאור |
|---|---|---|
| `writeScheduleResult_(mgmt, guards, plan)` | ~679 | מתאם את כל הכתיבות ומציג alert סיכום |
| `syncCurrentSchedule_(mgmt, guards, rows, decisions)` | ~741 | מסנכרן שיבוץ לעמודה 7 בלשונית זמינות |
| `buildManagerView_(mgmt, guards, rows, decisions)` | ~776 | בונה מבט מנהל עם צבעי חריגה |
| `rebuildManagerViewFromMenu()` | ~772 | Alert בלבד (מבט מנהל מתעדכן רק בשיבוץ) |
| `writeHistory_(ss, guards, st)` | ~1119 | כותב שורה לטבלת היסטוריה/חוב |
| `publishSchedule_(mgmt)` | ~1154 | מפרסם לוח לקובץ חיצוני לשומרים, מחזיר URL |
| `writeSchedule_(ss, rows, decisions, guards, st)` | ~1176 | כותב לוח שמירות סופי עם מיזוג שורות רצופות |

### צבעי מבט מנהל
| צבע | משמעות |
|---|---|
| ירוק | דירוג 1 (נוח) |
| צהוב | דירוג 2-3 |
| כתום | דירוג 4-5 |
| אדום | X (שובץ בחירום) |
| כחול-בהיר | ריק / לא שובץ |

---

## § E · DATA READERS (שורות 1012–1350)

| פונקציה | שורה | תיאור |
|---|---|---|
| `readAvailabilityRows_(mgmt, guards, cfg, blocks)` | ~1012 | קורא לשונית זמינות, מחזיר מערך row-objects |
| `readExternalRows_(mgmt, cfg)` | ~1083 | קורא שומרים חיצוניים (local/remote), מחזיר הצבות לילה |
| `writeHistory_(ss, guards, st)` | ~1119 | (ראה § D) |
| `publishSchedule_(mgmt)` | ~1154 | (ראה § D) |
| `writeSchedule_(...)` | ~1176 | (ראה § D) |
| `initState_(guards, mgmt, cfg)` | ~1276 | מאתחל מצב שומרים + חוב היסטורי |
| `readSettings_(ss)` | ~1314 | קורא הגדרות מ-SHEET_SETTINGS, מחזיר cfg |
| `readWeights_(ss)` | ~1329 | קורא משקלי קושי (day/evening/night/shabbat) |
| `setSettingsValue_(ss, key, value)` | ~1338 | כותב ערך יחיד ל-SHEET_SETTINGS |

---

## שרשרות קריאה מלאות

### שיבוץ רגיל
```
runScheduler()
 ├─ buildBlocks_()
 ├─ readAvailabilityRows_()  ← pre-read פעם אחת בלבד
 │    └─ readExternalRows_()
 ├─ buildPlan_() × עד 17 פעמים
 │    ├─ initState_()
 │    ├─ chooseBest_() [לכל בלוק]
 │    │    └─ isBlocked_() / ratingToCost_()
 │    ├─ backtrack_() [אם נכשל]
 │    │    └─ chooseBestExcluding_()
 │    ├─ applyAssign_()
 │    └─ getPartner_()
 └─ writeScheduleResult_()
      ├─ writeSchedule_()
      ├─ syncCurrentSchedule_()
      ├─ buildManagerView_()
      ├─ writeHistory_()
      └─ publishSchedule_()
```

### הקמת קובץ זמינות
```
createAvailabilityFile()
 └─ rebuildAvailabilityIn_()
      ├─ buildBlocks_()
      ├─ getCleanSheet_()
      └─ styleHeader_()
```

---

## תרחישי ניפוי תקלות

| תסמין | היכן לחפש |
|---|---|
| **חריץ נשאר ריק** | `chooseBest_` (~865) — בדוק hardCap, restTime, markCost. `runScheduler` שלבים A-E (~503). `backtrack_` (~935) — האם חוזר מספיק אחורה? |
| **שומר מקבל יותר/פחות שעות** | `initState_` (~1276) — חוב היסטורי. `applyAssign_` (~855) — חישוב שעות. `chooseBest_` — בדוק משקל `r.weight`. |
| **מיזוג שורות שגוי בלוח** | merge loop ב-`writeSchedule_` (~1188) — `r.label.slice(0,5)` / `r2.startAbs`. |
| **מבט מנהל לא תואם** | `buildManagerView_` (~776) — בדוק את לוגיקת הצבעים (`d.mode`, `mark`). |
| **שותף לילה חסר** | `getPartner_` (~916), `partnerCoversBlock_` (46). |
| **שבת לא מזוהה** | `isShabbat_` (~1360), `cfg.SHABBAT_START` / `cfg.SHABBAT_END` ב-`readSettings_` (~1314). |
| **ממשק web שבור** | `doGet` (~1430), `saveGuardPreferences` (~1442). |
| **שיבוץ לא דטרמיניסטי** | `jitter` param (פרמטר 6 ב-`buildPlan_`) — ודא שהוא `false`/`null` בקריאות מחוץ ל-runScheduler. |
| **emergencyMode לא מופעל** | `runScheduler` שלב E (~565): `buildPlan_(..., true, availRows)`. `chooseBest_` (~865): `emergencyMode` → `ratingToCost_` לא מחזיר Infinity עבור 5. |
| **קריאת Sheet איטית** | ב-`runScheduler` (~503): `availRows` נקרא פעם אחת ומועבר ל-17 קריאות `buildPlan_`. אם מוסיפים buildPlan_ נוסף — לזכור לעביר `availRows`. |

---

## ה"דרדור" של runScheduler — סיכום שלבים

```
Phase 0: buildPlan_(cfg, hardCap_0)
Phase A: hardCap++ × 12  [עד 12 איטרציות]
Phase B: MIN_REST_TIME - 1
Phase C: MIN_REST_TIME - 2  (עד min=2)
Phase D: MAX_SHIFT_LENGTH + 2  (עם bestCfg)
Phase E: emergencyMode=true  (עם bestCfg + bestMaxShift)
→ אם עדיין ריק → 🚨 ריק בטבלה
```

> `bestCfg` מעודכן בכל שלב שמשפר. מועבר לשלבים D ו-E כדי לצבור רלקסציות.
