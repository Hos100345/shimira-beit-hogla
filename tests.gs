/**
 * בדיקות יחידה אמיתיות — קוראות לפונקציות האמיתיות עם נתוני קצה
 * הרץ את runAllTests() מתוך עורך Apps Script
 */
function runAllTests() {
  const results = [];

  // ─────────────────────────────────────────────
  // תרחיש 1: chooseBest_ — שבת משתמש ב-shabbatDebt (Bug #6)
  // ─────────────────────────────────────────────
  (function() {
    const guards = ['א', 'ב'];
    const r = { marks: ['3', '3'], isShabbat: true, external: false,
                 startAbs: 100, hours: 1, weight: 1, sheetRow: 3 };
    const st = {
      0: { hours: 5, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 0, shabbatPoints: 50, weekdayDebt: 0, shabbatDebt: 30 },
      1: { hours: 5, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 0, shabbatPoints: 0, weekdayDebt: 0, shabbatDebt: 0 }
    };
    // שומר 0: shabbatDebt=30 → adjustedYellow = 40−60 = −20 → priority=2
    // שומר 1: shabbatDebt=0  → adjustedYellow = 40         → priority=0
    // צפוי: שומר 1 נבחר (עדיפות נמוכה יותר = עדיף)
    const cfg = { GREEN_MAX_POINTS: 20, YELLOW_MAX_POINTS: 40, DEBT_SENSITIVITY: 2,
                  MIN_REST_TIME: 4, NIGHT_REST_TIME: 8, MIN_SHIFT_LENGTH: 2 };
    const chosen = chooseBest_(guards, r, st, 24, 4, [0, 0], cfg, false, new Set(), false, null);
    results.push({ name: 'Bug #6 — chooseBest_ שבת', pass: chosen === 1,
                   info: 'נבחר שומר ' + chosen + ' (צפוי 1)' });
  })();

  // ─────────────────────────────────────────────
  // תרחיש 2: chooseBest_ — חול משתמש ב-weekdayDebt (ולא shabbatDebt)
  // ─────────────────────────────────────────────
  (function() {
    const guards = ['א', 'ב'];
    const r = { marks: ['3', '3'], isShabbat: false, external: false,
                 startAbs: 100, hours: 1, weight: 1, sheetRow: 3 };
    const st = {
      0: { hours: 5, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 50, shabbatPoints: 0, weekdayDebt: 30, shabbatDebt: 0 },
      1: { hours: 5, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 0, shabbatPoints: 0, weekdayDebt: 0, shabbatDebt: 0 }
    };
    const cfg = { GREEN_MAX_POINTS: 20, YELLOW_MAX_POINTS: 40, DEBT_SENSITIVITY: 2,
                  MIN_REST_TIME: 4, NIGHT_REST_TIME: 8, MIN_SHIFT_LENGTH: 2 };
    const chosen = chooseBest_(guards, r, st, 24, 4, [0, 0], cfg, false, new Set(), false, null);
    results.push({ name: 'Bug #6 — chooseBest_ חול', pass: chosen === 1,
                   info: 'נבחר שומר ' + chosen + ' (צפוי 1)' });
  })();

  // ─────────────────────────────────────────────
  // תרחיש 3: backtrack_ — מחזיר null מיידית על all-X
  // ─────────────────────────────────────────────
  (function() {
    const guards = ['א', 'ב'];
    const allXRow = { marks: ['X', 'X'], isShabbat: false, external: false,
                       startAbs: 50, hours: 1, weight: 1, sheetRow: 5,
                       manual: false, statusExternal: false, covered: false };
    const prevRow  = { marks: ['3', '3'], isShabbat: false, external: false,
                       startAbs: 48, hours: 1, weight: 1, sheetRow: 4,
                       manual: false, statusExternal: false, covered: false };
    const rows = [prevRow, allXRow];
    const st = {
      0: { hours: 2, run: 1, lastEnd: 49, lastNight: false,
           weekdayPoints: 5, shabbatPoints: 0, weekdayDebt: 0, shabbatDebt: 0 },
      1: { hours: 0, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 0, shabbatPoints: 0, weekdayDebt: 0, shabbatDebt: 0 }
    };
    const decisions = [{ rowIdx: 0, guard: 0, mode: 'רגיל' }];
    const cfg = { MAX_BACKTRACK_HOURS: 3, MIN_REST_TIME: 4, NIGHT_REST_TIME: 8,
                  MIN_SHIFT_LENGTH: 2, DEBT_SENSITIVITY: 2,
                  GREEN_MAX_POINTS: 20, YELLOW_MAX_POINTS: 40 };
    const result = backtrack_(decisions, rows, st, guards, 1, cfg, 24, 4, [0, 0], false, false, null);
    results.push({ name: 'all-X backtrack_ → null', pass: result === null,
                   info: 'תוצאה: ' + result + ' (צפוי null)' });
  })();

  // ─────────────────────────────────────────────
  // תרחיש 4: allXRowIdxs — זיהוי נכון של שורות all-X
  // ─────────────────────────────────────────────
  (function() {
    const fakeRows = [
      { marks: ['3', 'X'] },  // idx 0 — לא all-X
      { marks: ['X', 'X'] },  // idx 1 — all-X
      { marks: ['1', '2'] },  // idx 2 — לא all-X
    ];
    const allXRowIdxs = new Set(
      fakeRows.reduce((acc, r, i) => {
        if (r.marks.every(m => isBlocked_(m))) acc.push(i);
        return acc;
      }, [])
    );
    const pass = allXRowIdxs.size === 1 && allXRowIdxs.has(1);
    results.push({ name: 'allXRowIdxs זיהוי', pass,
                   info: 'זוהו: [' + [...allXRowIdxs] + '] (צפוי [1])' });
  })();

  // ─────────────────────────────────────────────
  // סיכום
  // ─────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log('=== תוצאות בדיקה: ' + passed + '/' + results.length + ' עברו ===');
  results.forEach(r => {
    console.log((r.pass ? '✅' : '❌') + ' ' + r.name + ' — ' + r.info);
  });
  if (failed > 0) {
    SpreadsheetApp.getUi().alert('❌ ' + failed + ' בדיקות נכשלו — בדוק Logger לפרטים.');
  } else {
    SpreadsheetApp.getUi().alert('✅ כל ' + passed + ' הבדיקות עברו בהצלחה!');
  }
}
