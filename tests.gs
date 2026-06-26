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

// ═══════════════════════════════════════════════════════════
// בדיקות רגרסיה — T1–T7
// הרץ runRegressionTests() מעורך Apps Script לפני כל מיזוג.
// ═══════════════════════════════════════════════════════════

// בונה מערך שורות סינתטי ל-buildPlan_ ללא קריאת Sheets.
// dayOrder — מערך ימים לפי סדר השבוע (לדוג' DAYS, או ['שישי','שבת',...]).
// numGuards — מספר שומרים (כולם עם זמינות מלאה '1' כברירת מחדל).
// marksOverride — { 'ראשון|06:00-07:00': ['X','X','X','X'], ... } לדריסת ציונים.
function makeTestRows_(dayOrder, numGuards, marksOverride) {
  const blocks = buildBlocks_().filter(b => !b.external);
  const rows = [];
  let rowNum = 3;
  dayOrder.forEach(function(day, di) {
    const absBase = di * 24;
    blocks.forEach(function(b) {
      const bStart = parseInt(b.label.slice(0, 2), 10);
      const startAbs = absBase + (bStart < 6 ? bStart + 24 : bStart);
      const marks = [];
      for (let g = 0; g < numGuards; g++) marks.push('1');
      const key = day + '|' + b.label;
      if (marksOverride && marksOverride[key]) {
        const ov = marksOverride[key];
        for (let g = 0; g < numGuards; g++) marks[g] = ov[g] || '1';
      }
      rows.push({
        day: day, label: b.label, dayIndex: DAYS.indexOf(day),
        startAbs: startAbs, hours: b.hours, night: b.night, external: false,
        marks: marks, manual: false, manualIdx: -1,
        covered: false, extName: '', partnerName: '', partnerRange: '', partnerIdx: -1,
        statusExternal: false, positions: 1, positionIdx: 0,
        isShabbat: (day === 'שישי' || day === 'שבת'), weight: 1,
        sheetRow: rowNum++,
      });
    });
  });
  return rows;
}

function runRegressionTests() {
  const results = [];

  const testCfg = {
    MAX_SHIFT_LENGTH: 4, MIN_SHIFT_LENGTH: 2,
    MIN_REST_TIME: 4, NIGHT_REST_TIME: 8,
    MAX_BACKTRACK_HOURS: 3, DEBT_SENSITIVITY: 2,
    GREEN_MAX_POINTS: 20, YELLOW_MAX_POINTS: 40,
    SHABBAT_START_DAY: 'שישי', SHABBAT_START_HOUR: 6,
    SHABBAT_END_DAY: 'ראשון', SHABBAT_END_HOUR: 6,
  };
  const guards4 = ['א', 'ב', 'ג', 'ד'];
  const hardCap = 45;

  // ─────────────────────────────────────────────
  // T1: שבוע מלא ראשון→שבת, 4 שומרים, זמינות מלאה → 0 ריק, 0 חירום
  // ─────────────────────────────────────────────
  (function() {
    const rows = makeTestRows_(DAYS, 4, null);
    const targets = {};
    guards4.forEach(function(_, g) { targets[g] = hardCap; });
    const plan = buildPlan_(null, guards4, testCfg, hardCap, null, null, false, rows, targets);
    const emptyCount = plan.decisions.filter(function(d) { return d.mode === 'ריק'; }).length;
    const emergCount = plan.decisions.filter(function(d) { return d.mode === 'חירום'; }).length;
    results.push({ name: 'T1 — שבוע מלא ראשון→שבת 0 ריק', pass: emptyCount === 0,
                   info: 'ריק=' + emptyCount + ' חירום=' + emergCount + ' (צפוי 0 ריק)' });
  })();

  // ─────────────────────────────────────────────
  // T2: שבוע מתחיל בשישי → סדר שישי→חמישי, 0 ריק
  // ─────────────────────────────────────────────
  (function() {
    const friStart = ['שישי','שבת','ראשון','שני','שלישי','רביעי','חמישי'];
    const rows = makeTestRows_(friStart, 4, null);
    const targets = {};
    guards4.forEach(function(_, g) { targets[g] = hardCap; });
    const plan = buildPlan_(null, guards4, testCfg, hardCap, null, null, false, rows, targets);
    const emptyCount = plan.decisions.filter(function(d) { return d.mode === 'ריק'; }).length;
    // אמת שהסדר הוא שישי→חמישי: היום הראשון בתוצאות צריך להיות שישי
    const firstDay = plan.rows.length > 0 ? plan.rows[0].day : '';
    results.push({ name: 'T2 — שבוע שישי→חמישי 0 ריק', pass: emptyCount === 0 && firstDay === 'שישי',
                   info: 'ריק=' + emptyCount + ' יום ראשון=' + firstDay + ' (צפוי 0 ריק, שישי)' });
  })();

  // ─────────────────────────────────────────────
  // T3: בלוק אחד all-X → שאר הבלוקים מלאים, הבלוק הספציפי ריק
  // ─────────────────────────────────────────────
  (function() {
    const allX = ['X','X','X','X'];
    const overrides = { 'ראשון|12:00-13:00': allX };
    const rows = makeTestRows_(DAYS, 4, overrides);
    const targets = {};
    guards4.forEach(function(_, g) { targets[g] = hardCap; });
    const plan = buildPlan_(null, guards4, testCfg, hardCap, null, null, false, rows, targets);
    const allXRow = plan.rows.findIndex(function(r) { return r.day === 'ראשון' && r.label === '12:00-13:00'; });
    const allXDecision = plan.decisions.find(function(d) { return d.rowIdx === allXRow; });
    const otherEmpty = plan.decisions.filter(function(d) { return d.mode === 'ריק' && d.rowIdx !== allXRow; }).length;
    const allXIsEmpty = allXDecision && allXDecision.mode === 'ריק';
    results.push({ name: 'T3 — all-X: שאר בלוקים מלאים', pass: allXIsEmpty && otherEmpty === 0,
                   info: 'all-X ריק=' + allXIsEmpty + ' שאר ריקים=' + otherEmpty + ' (צפוי true, 0)' });
  })();

  // ─────────────────────────────────────────────
  // T4: מכסות אישיות → אף שומר לא חורג ממכסתו (מחוץ לחירום)
  // ─────────────────────────────────────────────
  (function() {
    const rows = makeTestRows_(DAYS, 4, null);
    const quota = 16;
    const targets = {};
    guards4.forEach(function(_, g) { targets[g] = quota; });
    const plan = buildPlan_(null, guards4, testCfg, hardCap, null, null, false, rows, targets);
    let quotaViolations = 0;
    guards4.forEach(function(_, g) {
      let assignedHours = 0;
      plan.decisions.forEach(function(d) {
        if (d.guard === g && d.mode !== 'חירום') assignedHours += plan.rows[d.rowIdx].hours;
      });
      if (assignedHours > quota) quotaViolations++;
    });
    results.push({ name: 'T4 — מכסות אישיות לא נחצות', pass: quotaViolations === 0,
                   info: 'הפרות=' + quotaViolations + ' (מכסה=' + quota + 'ש, צפוי 0 הפרות)' });
  })();

  // ─────────────────────────────────────────────
  // T5: היסטוריה ריקה → חוב מתחיל ב-0, לא מתפוצץ
  // ─────────────────────────────────────────────
  (function() {
    // initState_ עם mgmt=null מחזיר state ריק
    const st = initState_(guards4, null, testCfg);
    let debtExplosion = false;
    guards4.forEach(function(_, g) {
      if (st[g].weekdayDebt !== 0 || st[g].shabbatDebt !== 0 ||
          st[g].weekdayPoints !== 0 || st[g].shabbatPoints !== 0) {
        debtExplosion = true;
      }
    });
    results.push({ name: 'T5 — היסטוריה ריקה → חוב מתחיל ב-0', pass: !debtExplosion,
                   info: 'פיצוץ-חוב=' + debtExplosion + ' (צפוי false)' });
  })();

  // ─────────────────────────────────────────────
  // T6: הפרדת חול/שבת — נקודות שבת לא משנות רמזור חול
  // ─────────────────────────────────────────────
  (function() {
    // שומר 0: shabbatPoints=50 (עמוס בשבת) אך weekdayPoints=0 → ירוק בחול
    // שומר 1: weekdayPoints=50 (עמוס בחול) אך shabbatPoints=0
    // בבלוק חול: שומר 0 צריך להיבחר (priority=0, ירוק בחול)
    // בבלוק שבת: שומר 1 צריך להיבחר (priority=0, ירוק בשבת)
    const g2 = ['א', 'ב'];
    const st2 = {
      0: { hours: 0, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 0, shabbatPoints: 50, weekdayDebt: 0, shabbatDebt: 0 },
      1: { hours: 0, run: 0, lastEnd: 0, lastNight: false,
           weekdayPoints: 50, shabbatPoints: 0, weekdayDebt: 0, shabbatDebt: 0 },
    };
    const weekdayRow = { marks: ['1','1'], isShabbat: false, external: false,
                          startAbs: 6, hours: 1, weight: 1, sheetRow: 3 };
    const shabbatRow = { marks: ['1','1'], isShabbat: true, external: false,
                          startAbs: 6, hours: 1, weight: 1, sheetRow: 4 };
    const chosenWeekday = chooseBest_(g2, weekdayRow, st2, 40, 4, [0,0], testCfg, false, new Set(), false, null);
    const chosenShabbat = chooseBest_(g2, shabbatRow, st2, 40, 4, [0,0], testCfg, false, new Set(), false, null);
    results.push({ name: 'T6 — חול/שבת: נקודות שבת לא משפיעות על חול', pass: chosenWeekday === 0 && chosenShabbat === 1,
                   info: 'בחול=' + chosenWeekday + ' בשבת=' + chosenShabbat + ' (צפוי 0, 1)' });
  })();

  // ─────────────────────────────────────────────
  // T7: שבת בזמינות מלאה → 0 ריק בשבת (כולל אחרי שישי פעיל)
  // ─────────────────────────────────────────────
  (function() {
    // שבוע מלא שישי→שישי: שישי ראשון + שבת. שישי ממלא שומרים → שבת עם מגבלות מנוחה.
    // שלב החירום הממוקד צריך למלא כל שבת שנשארת ריקה.
    const rows = makeTestRows_(['שישי','שבת'], 4, null);
    const targets = {};
    guards4.forEach(function(_, g) { targets[g] = hardCap; });
    const plan = buildPlan_(null, guards4, testCfg, hardCap, null, null, false, rows, targets);
    const shabbatEmpty = plan.decisions.filter(function(d) {
      return d.mode === 'ריק' && plan.rows[d.rowIdx].day === 'שבת';
    }).length;
    results.push({ name: 'T7 — שבת זמינות מלאה → 0 ריק בשבת', pass: shabbatEmpty === 0,
                   info: 'ריקים בשבת=' + shabbatEmpty + ' (צפוי 0)' });
  })();

  // ─────────────────────────────────────────────
  // סיכום
  // ─────────────────────────────────────────────
  const passed = results.filter(function(r) { return r.pass; }).length;
  const failed = results.filter(function(r) { return !r.pass; }).length;
  console.log('=== תוצאות רגרסיה: ' + passed + '/' + results.length + ' עברו ===');
  results.forEach(function(r) {
    console.log((r.pass ? '✅' : '❌') + ' ' + r.name + ' — ' + r.info);
  });
  if (failed > 0) {
    SpreadsheetApp.getUi().alert('❌ ' + failed + ' בדיקות רגרסיה נכשלו — בדוק Logger לפרטים.');
  } else {
    SpreadsheetApp.getUi().alert('✅ כל ' + passed + ' בדיקות הרגרסיה עברו! (T1–T7)');
  }
}
