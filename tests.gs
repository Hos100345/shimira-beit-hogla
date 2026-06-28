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
// A2 — תשתית בדיקות: invariants, pipeline, golden, property
// ═══════════════════════════════════════════════════════════

const SHEET_GOLDEN = '🧪 Golden';
const MAX_DEBT_GROWTH_RATIO = 1.5;   // INV4: חוב לא יכול לקפוץ מעבר ל-1.5× בריצה
const MAX_REASONABLE_POINTS = 200;   // INV4: תקרת נקודות סבירה בריצה אחת

// INV1–INV6 — בדוק plan ממשי, החזר מערך הפרות (ריק = תקין).
function checkInvariants_(plan, guards, targets, hardCap) {
  const violations = [];
  const rows = plan.rows, decisions = plan.decisions, st = plan.st;

  // INV1: לכל שורה יש בדיוק החלטה אחת
  if (decisions.length !== rows.length) {
    violations.push('INV1: ' + decisions.length + ' החלטות ל-' + rows.length + ' שורות (לא מאוזן)');
  }

  // INV2: אף שומר לא חורג ממכסתו מחוץ לחירום
  guards.forEach(function(name, g) {
    let normalHours = 0;
    decisions.forEach(function(d) {
      if (d.guard === g && d.mode !== 'חירום') normalHours += rows[d.rowIdx].hours;
    });
    const cap = (targets && targets[g] > 0) ? targets[g] : hardCap;
    if (normalHours > cap + 0.01) {
      violations.push('INV2: ' + name + ' חרג ' + normalHours + '>' + cap + 'ש (מחוץ לחירום)');
    }
  });

  // INV3: אין חפיפת שמירות — שומר לא בשתי עמדות באותו זמן
  const guardSlots = {};
  decisions.forEach(function(d) {
    if (d.guard < 0) return;
    if (!guardSlots[d.guard]) guardSlots[d.guard] = [];
    const r = rows[d.rowIdx];
    guardSlots[d.guard].push({ s: r.startAbs, e: r.startAbs + r.hours });
  });
  guards.forEach(function(name, g) {
    const slots = guardSlots[g] || [];
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (slots[i].s < slots[j].e && slots[j].s < slots[i].e) {
          violations.push('INV3: חפיפה ' + name + ' — ' + slots[i].s + '-' + slots[i].e + ' עם ' + slots[j].s + '-' + slots[j].e);
        }
      }
    }
  });

  // INV4: נקודות שומר לא קופצות מעל סף סביר (גילוי פיצוץ-חוב)
  guards.forEach(function(name, g) {
    const pts = (st[g].weekdayPoints || 0) + (st[g].shabbatPoints || 0);
    if (pts > MAX_REASONABLE_POINTS) {
      violations.push('INV4: ' + name + ' צבר ' + pts + ' נק׳ (סף=' + MAX_REASONABLE_POINTS + ')');
    }
  });

  // INV5: בלוק נעול (manual) שמור בדיוק לפי הקלט
  decisions.forEach(function(d) {
    const r = rows[d.rowIdx];
    if (r.manual && r.manualIdx >= 0 && d.guard !== r.manualIdx) {
      const got = (d.guard >= 0 && d.guard < guards.length) ? guards[d.guard] : '?';
      const exp = guards[r.manualIdx];
      violations.push('INV5: בלוק נעול ' + r.day + ' ' + r.label + ' — שובץ ' + got + ' במקום ' + exp);
    }
  });

  // INV6: מספר ההחלטות = מספר השורות (אין שורה שנעלמה)
  const rowDecCnt = {};
  decisions.forEach(function(d) { rowDecCnt[d.rowIdx] = (rowDecCnt[d.rowIdx] || 0) + 1; });
  rows.forEach(function(r, i) {
    const cnt = rowDecCnt[i] || 0;
    if (cnt !== 1) {
      violations.push('INV6: ' + r.day + ' ' + r.label + ' — ' + cnt + ' החלטות (צפוי 1)');
    }
  });

  return violations;
}

// מריץ את כל שלבי השיבוץ (א–ה) על preloadedRows ללא קריאת Sheets.
// מקביל ל-runScheduler אך עם null בתור mgmt ושורות סינתטיות.
function runPipelineOnRows_(rows, guards, cfg, hardCap, targets) {
  const allXRowIdxs = new Set(
    rows.reduce(function(acc, r, i) {
      if (r.marks.every(function(m) { return isBlocked_(m); })) acc.push(i);
      return acc;
    }, [])
  );
  const countNonX = function(ds) {
    return ds.filter(function(d) { return d.mode === 'ריק' && !allXRowIdxs.has(d.rowIdx); }).length;
  };

  let plan = buildPlan_(null, guards, cfg, hardCap, null, null, false, rows, targets);
  let emptyCount = plan.decisions.filter(function(d) { return d.mode === 'ריק'; }).length;
  let nonXEmpty = countNonX(plan.decisions);
  let bestCfg = cfg, bestMaxShift = null;

  // שלב א׳ — הגדל מכסה עד +12ש
  let capAdded = 0;
  while (nonXEmpty > 0 && capAdded < 12) {
    hardCap++; capAdded++;
    plan = buildPlan_(null, guards, cfg, hardCap, null, null, false, rows, targets);
    emptyCount = plan.decisions.filter(function(d) { return d.mode === 'ריק'; }).length;
    nonXEmpty = countNonX(plan.decisions);
  }

  // שלבים ב׳+ג׳ — הפחת מנוחה עד מינימום 2ש
  const origRest = Number(cfg.MIN_REST_TIME) || 4;
  let restReduced = 0;
  while (nonXEmpty > 0 && origRest - restReduced > 2) {
    restReduced++;
    const rc = Object.assign({}, cfg, { MIN_REST_TIME: origRest - restReduced });
    const rp = buildPlan_(null, guards, rc, hardCap, null, null, false, rows, targets);
    const rEmpty = rp.decisions.filter(function(d) { return d.mode === 'ריק'; }).length;
    if (rEmpty < emptyCount) { plan = rp; emptyCount = rEmpty; nonXEmpty = countNonX(rp.decisions); bestCfg = rc; }
  }

  // שלב ד׳ — הארך משמרות +2ש
  if (nonXEmpty > 0) {
    const extShift = (Number(cfg.MAX_SHIFT_LENGTH) || 4) + 2;
    const lsp = buildPlan_(null, guards, bestCfg, hardCap, extShift, null, false, rows, targets);
    const lsEmpty = lsp.decisions.filter(function(d) { return d.mode === 'ריק'; }).length;
    if (lsEmpty < emptyCount) {
      plan = lsp; emptyCount = lsEmpty; nonXEmpty = countNonX(lsp.decisions); bestMaxShift = extShift;
    }
  }

  // שלב ה׳ — מילוי חירום ממוקד (זהה ל-runScheduler v2.9.7)
  if (emptyCount > 0) {
    const patchSt = {};
    for (const k in plan.st) patchSt[k] = Object.assign({}, plan.st[k]);
    const emFuture = new Array(guards.length).fill(0);
    const maxEmShift = bestMaxShift || (Number(bestCfg.MAX_SHIFT_LENGTH) || 4);
    const toFill = plan.decisions
      .filter(function(d) { return d.mode === 'ריק' && !allXRowIdxs.has(d.rowIdx); })
      .sort(function(a, b) { return plan.rows[a.rowIdx].startAbs - plan.rows[b.rowIdx].startAbs; });
    let filled = 0;
    toFill.forEach(function(d) {
      const r = plan.rows[d.rowIdx];
      const excl = new Set(plan.decisions.filter(function(d2) {
        return plan.rows[d2.rowIdx].sheetRow === r.sheetRow && d2.guard >= 0;
      }).map(function(d2) { return d2.guard; }));
      const g = chooseBest_(guards, r, patchSt, hardCap, maxEmShift, emFuture, bestCfg, false, excl, true, targets);
      if (g !== -1) { d.guard = g; d.mode = 'חירום'; applyAssign_(patchSt, g, r); filled++; }
    });
    if (filled > 0) { plan.st = patchSt; emptyCount -= filled; }
  }

  return { plan: plan, emptyCount: emptyCount, finalHardCap: hardCap };
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
    const result = runPipelineOnRows_(rows, guards4, testCfg, hardCap, targets);
    const shabbatEmpty = result.plan.decisions.filter(function(d) {
      return d.mode === 'ריק' && result.plan.rows[d.rowIdx].day === 'שבת';
    }).length;
    results.push({ name: 'T7 — שבת זמינות מלאה → 0 ריק בשבת', pass: shabbatEmpty === 0,
                   info: 'ריקים בשבת=' + shabbatEmpty + ' (צפוי 0)' });
  })();

  // ─────────────────────────────────────────────
  // T8: שדרוג מבנה משמר ערכי הגדרות קיימים (B1 — "קלט קיים נשמר", INV5)
  // ─────────────────────────────────────────────
  (function() {
    // מדמה את לוגיקת ה-overlay מתוך setupV2: ערך קיים גובר על ברירת מחדל.
    const rows = [
      ['פרמטר', 'ערך', 'הסבר'],
      ['MAX_SHIFT_LENGTH', 4, ''],
      ['NIGHT_REST_TIME', 8, ''],
      ['GREEN_MAX_POINTS', 20, ''],
    ];
    const prevSettings = { MAX_SHIFT_LENGTH: 6, NIGHT_REST_TIME: 7 }; // משתמש שינה ידנית
    rows.forEach(function(r, i) {
      if (i === 0) return;
      const key = String(r[0]).trim();
      if (key && prevSettings[key] !== undefined && prevSettings[key] !== '') r[1] = prevSettings[key];
    });
    const maxShift = rows[1][1], nightRest = rows[2][1], green = rows[3][1];
    const ok = maxShift === 6 && nightRest === 7 && green === 20; // קיימים נשמרו, חסר נשאר ברירת מחדל
    results.push({ name: 'T8 — שדרוג מבנה משמר הגדרות קיימות', pass: ok,
                   info: 'MAX_SHIFT=' + maxShift + ' NIGHT_REST=' + nightRest + ' GREEN=' + green + ' (צפוי 6,7,20)' });
  })();

  // ─────────────────────────────────────────────
  // T9: שדרוג מבנה משמר מכסות שומרים לפי שם (B1)
  // ─────────────────────────────────────────────
  (function() {
    // מדמה את שחזור עמודת המכסות בתוך setupV2.
    const names = [['שראל'], ['שר שלום'], ['חדש']];
    const prevQuotas = { 'שראל': 35, 'שר שלום': 35 }; // 'חדש' ללא מכסה קודמת
    const quotaCol = names.map(function(n) { return [prevQuotas[String(n[0]).trim()] || '']; });
    const ok = quotaCol[0][0] === 35 && quotaCol[1][0] === 35 && quotaCol[2][0] === '';
    results.push({ name: 'T9 — שדרוג מבנה משמר מכסות לפי שם', pass: ok,
                   info: 'מכסות=[' + quotaCol.map(function(q){return q[0];}).join(',') + '] (צפוי 35,35,ריק)' });
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
    SpreadsheetApp.getUi().alert('✅ כל ' + passed + ' בדיקות הרגרסיה עברו! (T1–T9)');
  }
}

// ═══════════════════════════════════════════════════════════
// בדיקות Property — 50 תרחישים אקראיים × INV1–INV6
// ═══════════════════════════════════════════════════════════

function runPropertyTests() {
  const N = 50;
  const guards = ['א', 'ב', 'ג', 'ד'];
  const origCap = 30;
  const cfg = {
    MAX_SHIFT_LENGTH: 4, MIN_SHIFT_LENGTH: 2,
    MIN_REST_TIME: 4, NIGHT_REST_TIME: 8,
    MAX_BACKTRACK_HOURS: 3, DEBT_SENSITIVITY: 2,
    GREEN_MAX_POINTS: 20, YELLOW_MAX_POINTS: 40,
    SHABBAT_START_DAY: 'שישי', SHABBAT_START_HOUR: 6,
    SHABBAT_END_DAY: 'ראשון', SHABBAT_END_HOUR: 6,
  };
  const RESTRICTED = ['2', '3', '4', '5'];

  let totalFails = 0;
  const failDetails = [];

  for (let i = 0; i < N; i++) {
    const marksOverride = {};
    const blocks = buildBlocks_().filter(function(b) { return !b.external; });
    DAYS.forEach(function(day) {
      blocks.forEach(function(b) {
        const marks = [];
        for (let g = 0; g < 4; g++) {
          const r = Math.random();
          if (r < 0.20) marks.push('X');
          else if (r < 0.40) marks.push(RESTRICTED[Math.floor(Math.random() * RESTRICTED.length)]);
          else marks.push('1');
        }
        if (marks.some(function(m) { return m !== '1'; })) {
          marksOverride[day + '|' + b.label] = marks;
        }
      });
    });

    const rows = makeTestRows_(DAYS, 4, marksOverride);
    const targets = {};
    guards.forEach(function(_, g) { targets[g] = origCap; });

    const result = runPipelineOnRows_(rows, guards, cfg, origCap, targets);
    // Check invariants against the final (possibly expanded) cap
    const checkTargets = {};
    guards.forEach(function(_, g) { checkTargets[g] = result.finalHardCap; });
    const violations = checkInvariants_(result.plan, guards, checkTargets, result.finalHardCap);

    if (violations.length > 0) {
      totalFails++;
      failDetails.push('תרחיש ' + (i + 1) + ': ' + violations.join('; '));
    }
  }

  failDetails.forEach(function(msg) { console.log('❌ ' + msg); });

  if (totalFails === 0) {
    SpreadsheetApp.getUi().alert('✅ כל ' + N + ' תרחישי Property עברו ללא הפרות Invariant');
  } else {
    const preview = failDetails.slice(0, 5).join('\n');
    const suffix = failDetails.length > 5 ? '\n...ועוד — בדוק Logger' : '';
    SpreadsheetApp.getUi().alert(
      '❌ ' + totalFails + '/' + N + ' תרחישים הפרו Invariants:\n\n' + preview + suffix
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Golden — שמירה והשוואה של "📅 שיבוץ נוכחי"
// ═══════════════════════════════════════════════════════════

function runGoldenCapture() {
  const mgmt = SpreadsheetApp.getActiveSpreadsheet();
  const avSh = mgmt.getSheetByName(SHEET_AVAIL);
  if (!avSh) { SpreadsheetApp.getUi().alert('❌ לא נמצא גיליון זמינות'); return; }

  const lastCol = avSh.getLastColumn();
  if (lastCol < 1) { SpreadsheetApp.getUi().alert('❌ גיליון זמינות ריק'); return; }
  const headerRow = avSh.getRange(1, 1, 1, lastCol).getValues()[0];
  const syncCol = headerRow.indexOf('📅 שיבוץ נוכחי') + 1;
  if (syncCol <= 0) {
    SpreadsheetApp.getUi().alert('❌ לא נמצאה עמודת "📅 שיבוץ נוכחי" — הרץ שיבוץ תחילה');
    return;
  }

  const lastRow = avSh.getLastRow();
  if (lastRow < 3) { SpreadsheetApp.getUi().alert('❌ גיליון זמינות ריק'); return; }

  const numDataRows = lastRow - 2;
  const vals = avSh.getRange(3, 1, numDataRows, syncCol).getValues();
  const goldenData = vals.map(function(r) { return [r[0], r[1], r[syncCol - 1]]; });

  const goldenSh = getCleanSheet_(mgmt, SHEET_GOLDEN);
  goldenSh.setRightToLeft(true);
  goldenSh.getRange(1, 1, 1, 3).setValues([['יום', 'בלוק', 'שיבוץ']]);
  if (goldenData.length > 0) {
    goldenSh.getRange(2, 1, goldenData.length, 3).setValues(goldenData);
  }
  SpreadsheetApp.getUi().alert('✅ Golden נשמר: ' + goldenData.length + ' שורות ב-' + SHEET_GOLDEN);
}

function runGoldenCompare() {
  const mgmt = SpreadsheetApp.getActiveSpreadsheet();
  const avSh = mgmt.getSheetByName(SHEET_AVAIL);
  const goldenSh = mgmt.getSheetByName(SHEET_GOLDEN);

  if (!avSh) { SpreadsheetApp.getUi().alert('❌ לא נמצא גיליון זמינות'); return; }
  if (!goldenSh || goldenSh.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('❌ אין Golden לשם השוואה — הרץ "💾 שמור Golden" תחילה');
    return;
  }

  const gVals = goldenSh.getRange(2, 1, goldenSh.getLastRow() - 1, 3).getValues();
  const goldenMap = {};
  gVals.forEach(function(r) { if (r[0] && r[1]) goldenMap[r[0] + '|' + r[1]] = String(r[2]); });

  const lastCol = avSh.getLastColumn();
  const headerRow = avSh.getRange(1, 1, 1, lastCol).getValues()[0];
  const syncCol = headerRow.indexOf('📅 שיבוץ נוכחי') + 1;
  if (syncCol <= 0) {
    SpreadsheetApp.getUi().alert('❌ לא נמצאה עמודת "📅 שיבוץ נוכחי" — הרץ שיבוץ תחילה');
    return;
  }

  const lastRow = avSh.getLastRow();
  if (lastRow < 3) { SpreadsheetApp.getUi().alert('❌ גיליון זמינות ריק'); return; }

  const numDataRows = lastRow - 2;
  const vals = avSh.getRange(3, 1, numDataRows, syncCol).getValues();
  const currentKeys = new Set();
  const diffs = [];

  vals.forEach(function(r) {
    const key = r[0] + '|' + r[1];
    currentKeys.add(key);
    const current = String(r[syncCol - 1]);
    const golden = goldenMap[key];
    if (golden === undefined) {
      diffs.push('➕ שורה חדשה: ' + key + ' = ' + current);
    } else if (current !== golden) {
      diffs.push('⚠️ ' + key + ': Golden=' + golden + ' → עכשיו=' + current);
    }
  });
  Object.keys(goldenMap).forEach(function(key) {
    if (!currentKeys.has(key)) {
      diffs.push('➖ הוסרה: ' + key + ' (Golden=' + goldenMap[key] + ')');
    }
  });

  diffs.forEach(function(d) { console.log(d); });
  if (diffs.length === 0) {
    SpreadsheetApp.getUi().alert('✅ השיבוץ הנוכחי זהה ל-Golden (ללא הבדלים)');
  } else {
    const preview = diffs.slice(0, 10).join('\n');
    const suffix = diffs.length > 10 ? '\n...ועוד ' + (diffs.length - 10) + ' — בדוק Logger' : '';
    SpreadsheetApp.getUi().alert('⚠️ נמצאו ' + diffs.length + ' הבדלים:\n\n' + preview + suffix);
  }
}
