/**  
 * 🛡️ מערכת שיבוץ שמירות — גרסה 2.4: אופטימיזציה אוטומטית של מכסת שעות ומנוחה
 * ====================================================================================  
 * גרסה זו סורקת מראש את כל השיבוצים הידניים בשבוע, משקללת את השעות והנקודות שלהם  
 * אל תוך תוכנית העבודה, ומונעת העמסת יתר על שומרים ששוריינו להם משמרות מראש.  
 *  
 * מבנה הלילה: 22:00-02:00 שומר חיצוני (נעול) | 02:00-06:00 פנימי + שותף ישוב.  
 * מספר שומרים דינמי לחלוטין — נקרא מגיליון השומרים.  
 *  
 * ⭐ כולל הפרדת ניקוד חול/שבת: נקודות שבת לא משפיעות על איזון ימי החול של אותו שבוע,  
 * אלא רק על שיבוץ השבת בשבוע שאחרי (דרך חוב היסטורי מפוצל).  
 */  
  
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];  
  
const SHEET_SETTINGS = '⚙️ הגדרות';  
const SHEET_GUARDS = '👥 שומרים';  
const SHEET_AVAIL = '📋 זמינות'; // בגיליון הראשי  
const SHEET_SCHEDULE = '🗓️ לוח שמירות';  
const SHEET_EXTERNAL = '📅 שומרים חיצוניים';  
const SHEET_HISTORY = '📊 היסטוריה וחוב';  
const SHEET_QUICK = '⚡ מילוי מהיר'; // בקובץ החיצוני
const SHEET_HELP = '📖 הוראות הפעלה';
const SHEET_MANAGER = '📊 מבט מנהל';
const GS_VERSION = 'v2.7';
  
// ── מודל זמינות: דירוג 1–5 + X ──  
// 1 = הכי נוח ... 5 = קשה מאוד, X = חסום קשיח, ריק = 1 (ברירת מחדל)  
// MARK_FREE/PREFER_NOT נשמרים לתאימות לאחור בקוד הישן, אך הזמינות כעת מספרית.  
const MARK_FREE = '1', MARK_BLOCK = 'X', MARK_PREFER_NOT = '?';  
const RATING_MIN = 1, RATING_MAX = 5, RATING_DEFAULT = 1;  
  
// ממיר דירוג זמינות לעלות מספרית. X = Infinity (חסום). ריק/לא תקין = 1.  
function ratingToCost_(mark) {  
 if (mark === null || mark === undefined || String(mark).trim() === '') return RATING_DEFAULT;  
 const m = String(mark).trim().toUpperCase();  
 if (m === MARK_BLOCK) return Infinity;  
 const n = parseInt(m, 10);  
 if (!isNaN(n) && n >= RATING_MIN && n <= RATING_MAX) return n;  
 return RATING_DEFAULT;  
}  
  
// האם השותף הפנימי מכסה את בלוק הלילה הפנימי הנתון, לפי הטווח שהוגדר?  
// partnerRange: '02:00-06:00' (מלא), '04:00-06:00' (סיור), ריק = מלא (ברירת מחדל).  
// בלוקים פנימיים אפשריים: 02:00-04:00, 04:00-06:00.  
function partnerCoversBlock_(blockLabel, partnerRange) {  
 let pr = (partnerRange && String(partnerRange).trim()) ? String(partnerRange).trim() : '02:00-06:00';  
 const rangeStart = parseInt(pr.slice(0, 2), 10);  
 const rangeEnd = parseInt(pr.slice(6, 8), 10);  
 const blockStart = parseInt(blockLabel.slice(0, 2), 10);  
 let blockEnd = parseInt(blockLabel.slice(6, 8), 10);  
 if (blockEnd === 0) blockEnd = 24;  
 return blockStart >= rangeStart && blockEnd <= rangeEnd;  
}  
  
// האם הסימון חוסם קשיח (X)?  
function isBlocked_(mark) {  
 return String(mark).trim().toUpperCase() === MARK_BLOCK;  
}  
  
// ══════════════════════════════════════════════════════════
// § A · UTILITIES   buildBlocks_ · ratingToCost_ · helpers
// ══════════════════════════════════════════════════════════
/* ============================================================
 * 1. בלוקי זמן  
 * ============================================================ */  
function buildBlocks_() {
  // סדר יממה: 06:00 עד 06:00 למחרת — בוקר → ערב → שמירת לילה → לפנות בוקר
  const blocks = [];
  for (let h = 6; h < 22; h++) {
    blocks.push({
      label: ('0' + h).slice(-2) + ':00-' + ('0' + (h + 1)).slice(-2) + ':00',
      hours: 1, night: false, external: false,
    });
  }
  blocks.push({ label: '22:00-00:00', hours: 2, night: true, external: true });
  blocks.push({ label: '00:00-02:00', hours: 2, night: true, external: true });
  blocks.push({ label: '02:00-04:00', hours: 2, night: true, external: false });
  blocks.push({ label: '04:00-06:00', hours: 2, night: true, external: false });
  return blocks;
}  
  
// האם הבלוק נמצא בחלון השבת? תומך בחלון שחוצה את סוף השבוע (שישי→ראשון).  
function isShabbat_(dayName, blockStartHour, cfg) {  
 if (!cfg || !cfg.SHABBAT_START_DAY || !cfg.SHABBAT_END_DAY) return false;  
 const order = {};  
 DAYS.forEach((d, i) => order[d] = i);  
 let startD = order[cfg.SHABBAT_START_DAY];  
 let endD = order[cfg.SHABBAT_END_DAY];  
 if (startD === undefined || endD === undefined) return false;  
 if (endD <= startD) endD += 7; // ראשון "עוטף" ליום 7  
 let blockD = order[dayName];  
 if (blockD === undefined) return false;  
 if (blockD < startD) blockD += 7;  
 const startMin = startD * 1440 + Number(cfg.SHABBAT_START_HOUR) * 60;  
 const endMin = endD * 1440 + Number(cfg.SHABBAT_END_HOUR) * 60;  
 const blockMin = blockD * 1440 + blockStartHour * 60;  
 return blockMin >= startMin && blockMin < endMin;  
}  
  
// חישוב משקל קושי לבלוק.  
function blockWeight_(dayName, block, weights, cfg, marksForBlock) {  
 const h = parseInt(block.label.slice(0, 2), 10);  
  
 if (cfg && isShabbat_(dayName, h, cfg)) {  
 if (!marksForBlock || marksForBlock.length === 0) return 3;  
 const costs = marksForBlock.map(ratingToCost_).filter(c => isFinite(c));  
 if (costs.length === 0) return 3;  
 return costs.reduce((a, b) => a + b, 0) / costs.length;  
 }  
  
 if (block.night) return weights['לילה'];  
 if (dayName === 'שבת') {  
 if (h >= 8 && h < 11) return weights['תפילות שבת'];  
 if (h >= 19) return weights['מוצ"ש'];  
 }  
 if (h >= 18) return weights['ערב'];  
 return weights['יום'];  
}  
  
// ══════════════════════════════════════════════════════════
// § B · ENTRY POINTS   onOpen · setupV2 · createFiles · menu actions
// ══════════════════════════════════════════════════════════
/* ============================================================
 * 2. תפריט  
 * ============================================================ */  
function onOpen() {  
 SpreadsheetApp.getUi()  
 .createMenu('🛡️ שיבוץ שמירות')  
 .addItem('▶️ הרץ שיבוץ', 'runScheduler')  
 .addItem('🔄 פרוס מחדש (פריסה חלופית)', 'replanSchedule')  
 .addItem('➕ הארך משמרות ופרוס', 'extendAndReplan')  
 .addItem('⚡ הפעל מילוי מהיר', 'runQuickFill')  
 .addItem('🚦 עדכן רמזור', 'updateTrafficLights')  
 .addSeparator()  
 .addItem('🏗️ שדרוג מבנה דינמי', 'setupV2')  
 .addItem('🔗 צור/עדכן קובץ זמינות', 'createAvailabilityFile')  
 .addItem('🔗 צור/קשר קובץ שומרים חיצוניים', 'createExternalFile')  
 .addItem('⏰ הפעל טריגרים', 'setupTriggers')  
 .addItem('📅 טען לוח חיצוניים — יוני 2026', 'fillExternalJune')  
 .addItem('📖 צור לשונית הוראות', 'createInstructionsSheet')  
 .addItem('🔄 אפס זמינות לשבוע חדש', 'resetAvailability')  
 .addItem('📥 עבד תגובות ממשק', 'loadInterfaceResponsesFromUI')
    .addItem('📊 עדכן מבט מנהל', 'rebuildManagerViewFromMenu')
 .addItem('⏱️ עדכן ממוצע שעות', 'fillGuardTargetAverages')
    .addToUi();  
}  
  
/* ============================================================  
 * 3. 🏗️ הקמה / שדרוג מבנה  
 * ============================================================ */  
function setupV2() {  
 const ss = SpreadsheetApp.getActiveSpreadsheet();  
 PropertiesService.getScriptProperties().setProperty('MGMT_ID', ss.getId());  
  
 const sh = getCleanSheet_(ss, SHEET_SETTINGS);  
 sh.setRightToLeft(true);  
 const rows = [
 ['פרמטר', 'ערך', 'הסבר'],
 ['⏱ זמני משמרות ומנוחה', '', ''],
 ['MAX_SHIFT_LENGTH', 4, 'מקסימום שעות רצופות למשמרת אחת (ברירת מחדל: 4)'],
 ['MIN_SHIFT_LENGTH', 2, 'מינימום שעות רצופות לפני החלפת שומר (ברירת מחדל: 2)'],
 ['MIN_REST_TIME', 4, 'שעות מנוחה מינימליות בין שתי משמרות רגילות (ברירת מחדל: 4)'],
 ['NIGHT_REST_TIME', 8, 'שעות מנוחה חובה אחרי משמרת לילה (שעות קטנות, ברירת מחדל: 8)'],
 ['MAX_BACKTRACK_HOURS', 3, 'מספר השעות שהאלגוריתם חוזר אחורה כשנתקע במבוי סתום (ברירת מחדל: 3)'],
 ['📊 ניקוד ואיזון', '', ''],
 ['MAX_WEEKDAY_DEBT_HOURS', 2, 'סף הפרש שעות שבועי בין שומרים; מעל הסף — האלגוריתם מאזן (ברירת מחדל: 2)'],
 ['GREEN_MAX_POINTS', 20, 'עד כמה נקודות X הצבורות השומר נשאר ירוק (פנוי לשיבוץ)'],
 ['YELLOW_MAX_POINTS', 40, 'עד כמה נקודות X = רמזור צהוב; מעל זה = אדום (עמוס — ישובץ רק בהכרח)'],
 ['DEBT_SENSITIVITY', 2, 'כמה נקודות חוב מהשבוע הקודם מורידות את סף הרמזור של השומר'],
 ['📅 חלון שבת', '', ''],
 ['SHABBAT_START_DAY', 'שישי', 'יום תחילת חלון שבת/חג (ברירת מחדל: שישי)'],
 ['SHABBAT_START_HOUR', 6, 'שעת פתיחת חלון שבת ביום ההתחלה — פורמט 24 שעות (ברירת מחדל: 6)'],
 ['SHABBAT_END_DAY', 'ראשון', 'יום סיום חלון שבת/חג (ברירת מחדל: ראשון)'],
 ['SHABBAT_END_HOUR', 6, 'שעת סגירת חלון שבת ביום הסיום — פורמט 24 שעות (ברירת מחדל: 6)'],
 ['🔗 גיליונות מקושרים', '', ''],
 ['WEEK_START_DATE', '', 'תאריך יום ראשון של השבוע המשובץ; משמש לייבוא שומרים חיצוניים מהקובץ המשותף'],
 ['AVAIL_SPREADSHEET_ID', '', 'מזהה Google Sheets של קובץ הזמינות (ממולא אוטומטית ע"י createAvailabilityFile)'],
 ['PUBLISH_SPREADSHEET_ID', '', 'מזהה Google Sheets לפרסום לוח השמירות לשומרים (ממולא אוטומטית)'],
 ['EXTERNAL_SPREADSHEET_ID', '', 'מזהה קובץ נפרד לשומרים חיצוניים; ריק = קריאה מהטבלה המקומית'],
 ];
 sh.getRange(1, 1, rows.length, 3).setValues(rows);
 styleHeader_(sh.getRange(1, 1, 1, 3));
 sh.getRange(2, 2, rows.length - 1, 1).setBackground('#fff2cc');
 [2, 8, 14, 19].forEach(r => {
   const hdr = sh.getRange(r, 1, 1, 3);
   hdr.setBackground('#f3f3f3').setFontWeight('bold');
   sh.getRange(r, 2).setBackground('#f3f3f3');
 });
 sh.getRange(20, 2).setNumberFormat('dd/mm/yyyy');  
  
 const w = [  
 ['סוג בלוק', 'משקל קושי'],  
 ['יום', 1], ['ערב', 2], ['מוצ"ש', 2], ['לילה', 3], ['תפילות שבת', 3],  
 ];  
 sh.getRange(1, 5, w.length, 2).setValues(w);  
 styleHeader_(sh.getRange(1, 5, 1, 2));  
 sh.getRange(2, 6, w.length - 1, 1).setBackground('#fff2cc');  
 sh.setColumnWidth(1, 220).setColumnWidth(3, 340).setColumnWidth(5, 130).setFrozenRows(1);  
  
 let names = [['שראל'], ['שר שלום'], ['עזריאל'], ['הושעיה']];  
 const oldG = ss.getSheetByName(SHEET_GUARDS);  
 if (oldG) {  
 const lastR = oldG.getLastRow();  
 if (lastR >= 2) {  
 const ex = oldG.getRange(2, 1, lastR - 1, 1).getValues().filter(r => r[0] && !String(r[0]).startsWith('שומר '));  
 if (ex.length > 0) names = ex;  
 }  
 }  
 const gs = getCleanSheet_(ss, SHEET_GUARDS);  
 gs.setRightToLeft(true);  
 gs.getRange(1, 1, 1, 2).setValues([['שם השומר', 'מכסה שעות']]);
 gs.getRange(2, 1, names.length, 1).setValues(names);
 styleHeader_(gs.getRange(1, 1, 1, 2));
 gs.setColumnWidth(2, 120);  
  
 const ex = getCleanSheet_(ss, SHEET_EXTERNAL);  
 ex.setRightToLeft(true);  
 ex.getRange(1, 1, 1, 4).setValues([['תאריך', 'שומר 22:00-02:00', 'שותף 02:00-06:00 (מהישוב)', 'טווח שותף']]);  
 styleHeader_(ex.getRange(1, 1, 1, 4));  
 ex.getRange(2, 1, 31, 1).setNumberFormat('dd/mm/yyyy');  
 const rangeRule = SpreadsheetApp.newDataValidation()  
 .requireValueInList(['02:00-06:00', '04:00-06:00'], true).setAllowInvalid(true).build();  
 ex.getRange(2, 4, 31, 1).setDataValidation(rangeRule);  
 ex.setColumnWidth(1, 110).setColumnWidths(2, 2, 200).setColumnWidth(4, 120).setFrozenRows(1);  
 ex.getRange(1, 6).setValue('💡 אם השותף ב-02-06 הוא אחד מהקבועים — המערכת מזהה לבד: קרדיט מלא + מנוחת לילה אחרי. טווח שותף ריק = משמרת מלאה (02-06). "04:00-06:00" = סיור קצר, ו-02-04 הופך לפנימי רגיל.')  
 .setFontColor('#666666');  
  
 const hi = ss.getSheetByName(SHEET_HISTORY) || ss.insertSheet(SHEET_HISTORY);  
 hi.setRightToLeft(true);  
 if (hi.getLastRow() === 0) {  
 const guards = names.map(r => r[0]);  
 const head = ['תאריך ריצה'].concat(  
 guards.map(n => n + ' — נק׳ חול'),  
 guards.map(n => n + ' — נק׳ שבת'),  
 guards.map(n => n + ' — חוב חול'),  
 guards.map(n => n + ' — חוב שבת'));  
 hi.getRange(1, 1, 1, head.length).setValues([head]);  
 styleHeader_(hi.getRange(1, 1, 1, head.length));  
 }  
  
 getCleanSheet_(ss, SHEET_SCHEDULE).setRightToLeft(true);  
 ss.toast('שדרוג מבנה דינמי הושלם.', '✅', 8);  
}  
  
/* ============================================================  
 * 4. 🔗 קובץ הזמינות המשותף  
 * ============================================================ */  
function createAvailabilityFile() {
  const mgmt = mgmt_();
  const guards = readGuards_(mgmt);
  if (guards.length === 0) { SpreadsheetApp.getUi().alert('אין שומרים ברשימה!'); return; }
  const seen = new Set();
  const dupes = guards.filter(g => { if (seen.has(g)) return true; seen.add(g); return false; });
  if (dupes.length > 0) {
    SpreadsheetApp.getUi().alert('⚠️ שמות שומרים כפולים: ' + dupes.join(', ') + '\nאנא תקן לפני המשך.');
    return;
  }
  rebuildAvailabilityIn_(mgmt, guards);
  SpreadsheetApp.getUi().alert('✅ לשונית הזמינות נוצרה/עודכנה עבור ' + guards.length + ' שומרים!');
}
  
function readExistingAvailabilityMarks_(ss, guards) {
  const result = {};
  const sh = ss.getSheetByName(SHEET_AVAIL);
  if (!sh || sh.getLastRow() < 3) return result;
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const data = sh.getRange(3, 1, sh.getLastRow() - 2, sh.getLastColumn()).getValues();
  guards.forEach(guardName => {
    const colIdx = header.findIndex(h => String(h).trim() === String(guardName).trim());
    if (colIdx < 0) return;
    result[guardName] = {};
    data.forEach(row => {
      const day = String(row[0]).trim();
      const label = String(row[1]).trim();
      if (day && label && row[colIdx] !== '' && row[colIdx] !== undefined)
        result[guardName][day + '|' + label] = row[colIdx];
    });
  });
  return result;
}

function readExistingRowData_(ss) {
  const result = {};
  const sh = ss.getSheetByName(SHEET_AVAIL);
  if (!sh || sh.getLastRow() < 3) return result;
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const manualColIdx = header.findIndex(h => String(h).includes('שיבוץ ידני'));
  const data = sh.getRange(3, 1, sh.getLastRow() - 2, sh.getLastColumn()).getValues();
  data.forEach(row => {
    const day = String(row[0]).trim();
    const label = String(row[1]).trim();
    if (!day || !label) return;
    result[day + '|' + label] = {
      status: String(row[3]).trim(),
      positions: row[4] !== '' && row[4] !== undefined ? Number(row[4]) : undefined,
      manual: manualColIdx >= 0 ? String(row[manualColIdx]).trim() : '',
    };
  });
  return result;
}

function rebuildAvailabilityIn_(ss, guards) {
 const savedMarks = readExistingAvailabilityMarks_(ss, guards);
 const savedRowData = readExistingRowData_(ss);

 const sh = getCleanSheet_(ss, SHEET_AVAIL);
 sh.setRightToLeft(true);
 const blocks = buildBlocks_();
 const numG = guards.length;
 const totalCols = 5 + numG + 2;

 sh.getRange(1, 1, 1, 5).setValues([['יום', 'בלוק זמן', 'שעות', 'סטטוס', 'עמדות']]);
 sh.getRange(1, 5).setNote('0 = שעה בוטלה\n1 = שומר אחד\n2 = שני שומרים');
 sh.getRange(1, 6, 1, numG).setValues([guards]);
 sh.getRange(1, 6 + numG).setValue('🔒 שיבוץ ידני');
 sh.getRange(1, 7 + numG).setValue('📅 שיבוץ נוכחי');
 sh.getRange(2, 1).setValue('🚦 רמזור ←');
 sh.getRange(2, 6, 1, numG).setValue('—').setHorizontalAlignment('center');

 const data = [];
 DAYS.forEach(day => blocks.forEach(b => {
   const key = day + '|' + b.label;
   const existingRow = savedRowData[key] || {};
   const status = existingRow.status || (b.external ? 'חיצוני בלבד' : 'פעיל');
   const positions = existingRow.positions !== undefined ? existingRow.positions : (b.external ? 0 : 1);
   const row = [day, b.label, b.hours, status, positions];
   guards.forEach(guardName => {
     const mark = (savedMarks[guardName] && savedMarks[guardName][key] !== undefined)
       ? savedMarks[guardName][key] : MARK_FREE;
     row.push(mark);
   });
   row.push(existingRow.manual || '');
   row.push('');
   data.push(row);
 }));
 sh.getRange(3, 1, data.length, totalCols).setValues(data);

 styleHeader_(sh.getRange(1, 1, 1, totalCols));
 sh.setFrozenRows(2);
 sh.setFrozenColumns(2);

 const statusRule = SpreadsheetApp.newDataValidation()
   .requireValueInList(['פעיל', 'חיצוני בלבד'], true).setAllowInvalid(false).build();
 sh.getRange(3, 4, data.length, 1).setDataValidation(statusRule);

 const posRule = SpreadsheetApp.newDataValidation()
   .requireValueInList(['0', '1', '2'], true).setAllowInvalid(false).build();
 sh.getRange(3, 5, data.length, 1).setDataValidation(posRule);

 const vxRule = SpreadsheetApp.newDataValidation()
   .requireValueInList(['1', '2', '3', '4', '5', MARK_BLOCK], true).setAllowInvalid(false).build();
 const manualRule = SpreadsheetApp.newDataValidation()
   .requireValueInList(guards, true).setAllowInvalid(false).build();
 sh.getRange(3, 6, data.length, numG).setDataValidation(vxRule);
 sh.getRange(3, 6 + numG, data.length, 1).setDataValidation(manualRule);

 const marksRange = sh.getRange(3, 6, data.length, numG);
 const greenRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('1')
   .setBackground('#b7e1cd').setRanges([marksRange]).build();
 const yellowRule = SpreadsheetApp.newConditionalFormatRule()
   .whenFormulaSatisfied('=AND(ISNUMBER(VALUE(F3)),VALUE(F3)>=3,VALUE(F3)<=5)')
   .setBackground('#fce8b2').setRanges([marksRange]).build();
 const blockRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(MARK_BLOCK)
   .setBackground('#f4c7c3').setRanges([marksRange]).build();

 const posRange = sh.getRange(3, 5, data.length, 1);
 const posZeroRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('0')
   .setBackground('#e0e0e0').setFontColor('#888888').setRanges([posRange]).build();
 const posTwoRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('2')
   .setBackground('#cfe2f3').setRanges([posRange]).build();
 sh.setConditionalFormatRules([greenRule, yellowRule, blockRule, posZeroRule, posTwoRule]);

 sh.setColumnWidths(1, 2, 95);
 sh.setColumnWidth(3, 55);
 sh.setColumnWidth(4, 110);
 sh.setColumnWidth(5, 65);
 sh.setColumnWidths(6, numG, 95);
 sh.setColumnWidth(6 + numG, 120);
 sh.setColumnWidth(7 + numG, 130);
 sh.setRowHeight(1, 30);
}
  
/* ============================================================  
 * 5. 📖 הוראות  
 * ============================================================ */  
function createInstructionsSheet() {  
 const ss = SpreadsheetApp.getActiveSpreadsheet();  
 const sh = getCleanSheet_(ss, SHEET_HELP);  
 sh.setRightToLeft(true);  
 const lines = [  
 ['📖 הוראות הפעלה — מערכת שיבוץ שמירות בית חוגלה'],  
 [''],  
 ['1. הגדרות ראשוניות'],  
 ['   • לחץ על 🏗️ שדרוג מבנה דינמי — יצור את כל הלשוניות הדרושות.'],  
 ['   • מלא שמות שומרים בלשונית "👥 שומרים" (עמודה A מ-A2 ואילך).'],  
 ['   • הגדר MAX_SHIFT_LENGTH, MIN_REST_TIME וכדומה ב-"⚙️ הגדרות".'],  
 [''],  
 ['2. זמינות שבועית'],  
 ['   • לחץ 🔗 צור/עדכן קובץ זמינות — יצור/יעדכן לשונית "📋 זמינות" בקובץ הנוכחי.'],  
 ['   • שלח לכל שומר קישור לממשק הזמינות (URL מ-doGet).'],  
 ['   • שומר ממלא זמינות: 1 = נוח, X = חסום קשיח, 5 = קשה מאוד.'],  
 [''],  
 ['3. ריצת שיבוץ'],  
 ['   • לחץ ▶️ הרץ שיבוץ — האלגוריתם יקרא זמינות, יבצע שיבוץ ויכתוב ללוח שמירות.'],  
 ['   • אם ישנם חיצוניים — מלא לשונית "📅 שומרים חיצוניים" לפני הריצה.'],  
 [''],  
 ['4. פריסה חלופית'],  
 ['   • לאחר ריצה, ניתן ללחוץ 🔄 פרוס מחדש — האלגוריתם יפרוס שיבוץ שונה.'],  
 ['   • ➕ הארך משמרות ופרוס — מגדיל את מכסת השעות ב-1 ומריץ מחדש.'],  
 [''],  
 ['5. שיבוץ ידני'],  
 ['   • ניתן לשים שם שומר בעמודת "🔒 שיבוץ ידני" בלשונית הזמינות.'],  
 ['   • שיבוצים ידניים נסרקים מראש — האלגוריתם מתחשב בהם לצורכי איזון.'],  
 [''],  
 ['6. עדכון אוטומטי (Triggers)'],  
 ['   • לחץ ⏰ הפעל טריגרים — יגדיר טריגר יומי שמנקה זמינות ישנה אוטומטית.'],  
 ];  
 sh.getRange(1, 1, lines.length, 1).setValues(lines);  
 sh.getRange(1, 1).setFontSize(14).setFontWeight('bold');  
 sh.setColumnWidth(1, 700);  
}  
  
/* ============================================================  
 * 6. 🔗 קובץ שומרים חיצוניים נפרד  
 * ============================================================ */  
function createExternalFile() {  
 const mgmt = mgmt_();  
 const cfg = readSettings_(mgmt);  
  
 let extId = cfg.EXTERNAL_SPREADSHEET_ID;  
 if (extId) {  
 try {  
 const extSs = SpreadsheetApp.openById(extId);  
 if (!extSs.getSheetByName(SHEET_EXTERNAL)) {  
 const sh = extSs.insertSheet(SHEET_EXTERNAL);  
 buildExternalSheet_(sh);  
 }  
 SpreadsheetApp.getUi().alert('✅ הקובץ כבר קיים: ' + extSs.getUrl());
 return;
 } catch(e) { Logger.log('createExternalFile: ' + e); }
 }  
  
 const newSs = SpreadsheetApp.create('שומרים חיצוניים — בית חוגלה');  
 const sh = newSs.getActiveSheet();  
 sh.setName(SHEET_EXTERNAL);  
 buildExternalSheet_(sh);  
  
 const newId = newSs.getId();  
 setSettingsValue_(mgmt, 'EXTERNAL_SPREADSHEET_ID', newId);  
 SpreadsheetApp.getUi().alert('✅ קובץ חיצוניים נוצר:\n' + newSs.getUrl() + '\n\nה-ID נשמר בהגדרות.');  
}  
  
function buildExternalSheet_(sh) {  
 sh.setRightToLeft(true);  
 sh.getRange(1, 1, 1, 4).setValues([['תאריך', 'שומר 22:00-02:00', 'שותף 02:00-06:00', 'טווח שותף']]);  
 styleHeader_(sh.getRange(1, 1, 1, 4));  
 sh.getRange(2, 1, 31, 1).setNumberFormat('dd/mm/yyyy');  
 const rr = SpreadsheetApp.newDataValidation().requireValueInList(['02:00-06:00', '04:00-06:00'], true).setAllowInvalid(true).build();  
 sh.getRange(2, 4, 31, 1).setDataValidation(rr);  
 sh.setColumnWidth(1, 110).setColumnWidths(2, 2, 200).setColumnWidth(4, 120).setFrozenRows(1);  
}  
  
/* ============================================================  
 * 7. ⚡ מילוי מהיר  
 * ============================================================ */  
function runQuickFill() {  
 const mgmt = mgmt_();  
 processQuickFill_(mgmt);  
 SpreadsheetApp.getUi().alert('✅ מילוי מהיר הושלם!');  
}  
  
function processQuickFill_(mgmt) {  
 const av = mgmt.getSheetByName(SHEET_AVAIL);  
 if (!av) return;  
 const qf = mgmt.getSheetByName(SHEET_QUICK);  
 if (!qf) return;  
  
 const guards = readGuards_(mgmt);  
 const numG = guards.length;  
 const blocks = buildBlocks_();  
 const numB = blocks.length;  
 const numDays = DAYS.length;  
  
 const qData = qf.getDataRange().getValues();  
 if (qData.length < 2) return;  
  
 const avData = av.getRange(3, 1, numDays * numB, 5 + numG).getValues();  
 const updates = [];  
  
 qData.slice(1).forEach(row => {  
 const gName = String(row[0]).trim();  
 const dayName = String(row[1]).trim();  
 const blockLabel = String(row[2]).trim();  
 const mark = String(row[3]).trim();  
 if (!gName || !dayName || !blockLabel || !mark) return;  
 const g = guards.indexOf(gName);  
 if (g < 0) return;  
 const rowIdx = avData.findIndex(r => r[0] === dayName && r[1] === blockLabel);  
 if (rowIdx < 0) return;  
 updates.push({ sheetRow: 3 + rowIdx, col: 6 + g, val: mark });  
 });  
  
 updates.forEach(u => av.getRange(u.sheetRow, u.col).setValue(u.val));  
}  
  
/* ============================================================  
 * 8. 🚦 רמזור זמינות  
 * ============================================================ */  
function updateTrafficLights() {  
 const mgmt = mgmt_();  
 const sh = mgmt.getSheetByName(SHEET_AVAIL);  
 if (!sh) { SpreadsheetApp.getUi().alert('גיליון זמינות לא נמצא!'); return; }  
  
 const guards = readGuards_(mgmt);  
 const numG = guards.length;  
 const numB = buildBlocks_().length;  
 const numDays = DAYS.length;  
  
 const data = sh.getRange(3, 6, numDays * numB, numG).getValues();  
 const scores = new Array(numG).fill(0);  
  
 data.forEach(row => {
 row.forEach((cell, g) => {
 const m = String(cell).trim().toUpperCase();
 if (m === MARK_BLOCK) scores[g] += 3;
 });  
 });  
  
 const cfg = readSettings_(mgmt);  
 const green = Number(cfg.GREEN_MAX_POINTS) || 20;  
 const yellow = Number(cfg.YELLOW_MAX_POINTS) || 40;  
  
 const lights = scores.map(s => s <= green ? '🟢' : s <= yellow ? '🟡' : '🔴');  
 sh.getRange(2, 6, 1, numG).setValues([lights]);  
}  
  
// ══════════════════════════════════════════════════════════
// § C · CORE SCHEDULING   runScheduler → buildPlan_ → chooseBest_ → backtrack_
// ══════════════════════════════════════════════════════════
/* ============================================================
 * 9. ▶️ הרץ שיבוץ
 * ============================================================ */

// סופר כמה שעות פנימיות נדרשות לכיסוי (לא כולל חיצוניים / position=0)
function calcRequiredHours_(mgmt, guards, cfg) {
  const blocks = buildBlocks_();
  const sh = mgmt.getSheetByName(SHEET_AVAIL);
  if (!sh) return 0;
  const lastRow = sh.getLastRow();
  if (lastRow < 3) return 0;
  const data = sh.getRange(3, 1, lastRow - 2, 5 + guards.length).getValues();
  let total = 0;
  data.forEach(v => {
    const label = String(v[1]).trim();
    if (!label) return;
    const block = blocks.find(b => b.label === label);
    if (!block || block.external) return;
    if (v[3] === 'חיצוני בלבד') return;
    const positions = Number(v[4]) || 0;
    if (positions === 0) return;
    total += block.hours * positions;
  });
  return total;
}

function runScheduler() {
  const mgmt = mgmt_();
  const guards = readGuards_(mgmt);
  if (guards.length === 0) { SpreadsheetApp.getUi().alert('אין שומרים ברשימה!'); return; }

  const seenG = new Set();
  const dupesG = guards.filter(g => { if (seenG.has(g)) return true; seenG.add(g); return false; });
  if (dupesG.length > 0) {
    SpreadsheetApp.getUi().alert('⚠️ שמות שומרים כפולים: ' + dupesG.join(', ') + '\nאנא תקן לפני שיבוץ.');
    return;
  }

  const avSh = mgmt.getSheetByName(SHEET_AVAIL);
  if (avSh && avSh.getLastRow() >= 1) {
    const avLastCol = avSh.getLastColumn();
    const avHeader = avLastCol >= 6
      ? avSh.getRange(1, 6, 1, avLastCol - 5).getValues()[0].map(h => String(h).trim())
      : [];
    const tableGuards = avHeader.filter(h => h && !h.includes('שיבוץ'));
    const mismatch = guards.length !== tableGuards.length ||
      guards.some((g, i) => g.trim() !== (tableGuards[i] || ''));
    if (mismatch) {
      SpreadsheetApp.getUi().alert(
        '⚠️ רשימת השומרים לא מסונכרנת עם טבלת הזמינות!\n\n' +
        'שומרים נוכחיים: ' + guards.join(', ') + '\n' +
        'עמודות בטבלה: ' + tableGuards.join(', ') + '\n\n' +
        'הרץ "📋 בנה טבלת זמינות" לפני שיבוץ.'
      );
      return;
    }
  }

  const cfg = readSettings_(mgmt);
  const settingsCap = Number(cfg.MAX_WEEKDAY_DEBT_HOURS) > 0 ? Number(cfg.MAX_WEEKDAY_DEBT_HOURS) + 20 : 24;

  // אוטומטי: חישוב שעות נדרשות והגדרת מכסה ריאלית
  const totalInternal = calcRequiredHours_(mgmt, guards, cfg);
  const minPerGuard = guards.length > 0 ? Math.ceil(totalInternal / guards.length) : 24;
  let hardCap = Math.max(settingsCap, minPerGuard + 2);

  // מכסה אישית לכל שומר (עמודה B ב-SHEET_GUARDS); ריק = ממוצע אוטומטי
  const targets = readGuardTargets_(mgmt, guards, totalInternal);

  // קרא זמינות פעם אחת — עוברת לכל buildPlan_ כדי לחסוך 17 קריאות Sheets
  const availBlocks = buildBlocks_();
  const availRows = readAvailabilityRows_(mgmt, guards, cfg, availBlocks);

  const emptyGuards = guards.filter((_, gIdx) =>
    !availRows.some(row => row.marks[gIdx] && String(row.marks[gIdx]).trim() !== MARK_FREE)
  );
  if (emptyGuards.length > 0) {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert(
      '⚠️ שומרים שלא מילאו זמינות:\n' + emptyGuards.join(', ') +
      '\n\nהם ישובצו כ"זמין תמיד" בכל המשמרות.\nלהמשיך בכל זאת?',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;
  }

  let plan = buildPlan_(mgmt, guards, cfg, hardCap, null, null, false, availRows, targets);
  let emptyCount = plan.decisions.filter(d => d.mode === 'ריק').length;

  // שלב א׳ — הגדל מכסה (עד +12 שעות)
  let capAdded = 0;
  while (emptyCount > 0 && capAdded < 12) {
    hardCap++;
    capAdded++;
    plan = buildPlan_(mgmt, guards, cfg, hardCap, null, null, false, availRows, targets);
    emptyCount = plan.decisions.filter(d => d.mode === 'ריק').length;
  }

  // שלב ב׳+ג׳ — הפחת זמן מנוחה שלב-שלב עד מינימום 2 שעות
  let restReduced = 0;
  const origRest = Number(cfg.MIN_REST_TIME) || 4;
  let bestCfg = cfg;
  while (emptyCount > 0 && origRest - restReduced > 2) {
    restReduced++;
    const relaxedCfg = Object.assign({}, cfg, { MIN_REST_TIME: origRest - restReduced });
    const rPlan = buildPlan_(mgmt, guards, relaxedCfg, hardCap, null, null, false, availRows, targets);
    const rEmpty = rPlan.decisions.filter(d => d.mode === 'ריק').length;
    if (rEmpty < emptyCount) { plan = rPlan; emptyCount = rEmpty; bestCfg = relaxedCfg; }
  }
  const restRelaxed = restReduced > 0;

  // שלב ד׳ — הארך משמרות מקסימום ב-+2 שעות
  let shiftExtended = false;
  let bestMaxShift = null;
  if (emptyCount > 0) {
    const extShift = (Number(cfg.MAX_SHIFT_LENGTH) || 4) + 2;
    const longShiftPlan = buildPlan_(mgmt, guards, bestCfg, hardCap, extShift, null, false, availRows, targets);
    const lsEmpty = longShiftPlan.decisions.filter(d => d.mode === 'ריק').length;
    if (lsEmpty < emptyCount) { plan = longShiftPlan; emptyCount = lsEmpty; shiftExtended = true; bestMaxShift = extShift; }
  }

  // שלב ה׳ — חירום עם ה-cfg הכי מרופה שנמצאה בשלבים הקודמים
  let emergencyUsed = false;
  if (emptyCount > 0) {
    const emergPlan = buildPlan_(mgmt, guards, bestCfg, hardCap, bestMaxShift, false, true, availRows, targets);
    const eEmpty = emergPlan.decisions.filter(d => d.mode === 'ריק').length;
    if (eEmpty < emptyCount) { plan = emergPlan; emptyCount = eEmpty; emergencyUsed = true; }
  }

  plan.totalInternal = totalInternal;
  plan.numGuards = guards.length;
  plan.optCap = hardCap;
  plan.settingsCap = settingsCap;
  plan.capAdded = capAdded;
  plan.restRelaxed = restRelaxed;
  plan.restReduced = restReduced;
  plan.shiftExtended = shiftExtended;
  plan.emergencyUsed = emergencyUsed;

  writeScheduleResult_(mgmt, guards, plan);
}  
  
function replanSchedule() {  
 const mgmt = mgmt_();  
 const guards = readGuards_(mgmt);  
 if (guards.length === 0) { SpreadsheetApp.getUi().alert('אין שומרים ברשימה!'); return; }  
  
 const cfg = readSettings_(mgmt);  
 const hardCap = Number(cfg.MAX_WEEKDAY_DEBT_HOURS) > 0 ? Number(cfg.MAX_WEEKDAY_DEBT_HOURS) + 20 : 24;  
  
 const plan = buildPlan_(mgmt, guards, cfg, hardCap, null, false);
 writeScheduleResult_(mgmt, guards, plan);
}

function extendAndReplan() {  
 const mgmt = mgmt_();  
 const guards = readGuards_(mgmt);  
 if (guards.length === 0) { SpreadsheetApp.getUi().alert('אין שומרים ברשימה!'); return; }  
  
 const cfg = readSettings_(mgmt);  
 let hardCap = Number(cfg.MAX_WEEKDAY_DEBT_HOURS) > 0 ? Number(cfg.MAX_WEEKDAY_DEBT_HOURS) + 20 : 24;  
 hardCap += 1;  
  
 const plan = buildPlan_(mgmt, guards, cfg, hardCap, null, false);  
 writeScheduleResult_(mgmt, guards, plan);  
}  
  
/* ============================================================  
 * 10. בניית תוכנית שיבוץ  
 * ============================================================ */  
function buildPlan_(mgmt, guards, cfg, hardCap, maxShiftOverride, jitter, emergencyMode, preloadedRows, targets) {
 const blocks = buildBlocks_();
 const rows = preloadedRows || readAvailabilityRows_(mgmt, guards, cfg, blocks);  
 const st = initState_(guards, mgmt, cfg);  
 const maxShift = maxShiftOverride || Number(cfg.MAX_SHIFT_LENGTH) || 4;  
  
 const futureManualHours = new Array(guards.length).fill(0);  
 rows.forEach(r => {  
 if (r.manual && r.manualIdx >= 0) futureManualHours[r.manualIdx] += r.hours;  
 });  
  
 const decisions = [];  
 let i = 0;  
 while (i < rows.length) {  
 const r = rows[i];  
  
 if (r.manual && r.manualIdx >= 0) {  
 const g = r.manualIdx;  
 decisions.push({ rowIdx: i, guard: g, mode: 'ידני', partner: r.partnerName || null });  
 applyAssign_(st, g, r);  
 futureManualHours[g] -= r.hours;  
 i++;  
 continue;  
 }  
  
 if (r.external && r.covered) {  
 decisions.push({ rowIdx: i, guard: -1, mode: 'חיצוני', name: r.extName, partner: r.partnerName || null });  
 if (r.partnerIdx >= 0) { applyAssign_(st, r.partnerIdx, r); }  
 i++;  
 continue;  
 }  
  
 if (!r.external && r.partnerName && r.partnerIdx >= 0) {  
 }  
  
 if (r.statusExternal) {  
 decisions.push({ rowIdx: i, guard: -1, mode: 'חיצוני', name: '—' });  
 i++;  
 continue;  
 }  
  
 const sameSlotExcluded = new Set(  
 decisions.filter(d => rows[d.rowIdx].sheetRow === r.sheetRow && d.guard >= 0).map(d => d.guard)  
 );  
 const g = chooseBest_(guards, r, st, hardCap, maxShift, futureManualHours, cfg, jitter, sameSlotExcluded, emergencyMode, targets);
 if (g === -1) {
 const bt = backtrack_(decisions, rows, st, guards, i, cfg, hardCap, maxShift, futureManualHours, jitter, emergencyMode, targets);  
 if (bt !== null) { i = bt; continue; }  
 decisions.push({ rowIdx: i, guard: -1, mode: 'ריק' });  
 i++;  
 continue;  
 }  
  
 let mode = 'רגיל';  
 const s = st[g];  
 if (s.hours >= hardCap) mode = 'חריגת שעות';  
 else if (s.run > maxShift) mode = 'חירום';  
  
 const partner = (r.night && !r.external) ? getPartner_(guards, g, r, st, cfg) : null;  
 decisions.push({ rowIdx: i, guard: g, mode, partner });  
 applyAssign_(st, g, r);  
 if (partner && guards.indexOf(partner) >= 0) {  
 const pg = guards.indexOf(partner);  
 if (partnerCoversBlock_(r.label, r.partnerRange)) applyAssign_(st, pg, r);  
 }  
 i++;  
 }  
  
 return { rows, decisions, st, hardCap, maxShift };  
}  
  
// ══════════════════════════════════════════════════════════
// § D · WRITERS   writeScheduleResult_ → writeSchedule_ / buildManagerView_ / writeHistory_ / publishSchedule_
// ══════════════════════════════════════════════════════════
function writeScheduleResult_(mgmt, guards, plan) {  
 const rows = plan.rows, decisions = plan.decisions, st = plan.st, hardCap = plan.hardCap, maxShift = plan.maxShift;  
  
 const alerts = [];  
 decisions.forEach(d => {  
 const r = rows[d.rowIdx];  
 if (d.mode === 'חירום') alerts.push('⚠️ חירום (נשברו חוקי מנוחה/רצף): ' + r.day + ' ' + r.label);  
 if (d.mode === 'חריגת שעות') alerts.push('➕ חריגת שעות: ' + r.day + ' ' + r.label);  
 if (d.mode === 'ריק') alerts.push('🚨 משמרת ריקה — כולם X: ' + r.day + ' ' + r.label);  
 if (r.external && !r.covered && d.guard >= 0)  
 alerts.push('ℹ️ אין חיצוני ב' + r.day + ' 22:00-02:00 — שובץ פנימי והמכסה עלתה בהתאם');  
 if (r.night && !r.external && !r.statusExternal && d.partner && guards.indexOf(d.partner) >= 0)  
 alerts.push('🛌 ' + d.partner + ' רשום בחיצוני 02:00-06:00 ב' + r.day + ' — חסום מפנימי עד 14:00');  
 if (r.external && r.covered && guards.indexOf(r.extName) >= 0)  
 alerts.push('🛌 ' + r.extName + ' רשום בחיצוני 22:00-02:00 ב' + r.day + ' — חסום מפנימי עד 10:00');  
 });  
  
 writeSchedule_(mgmt, rows, decisions, guards, st);
 syncCurrentSchedule_(mgmt, guards, rows, decisions);
 buildManagerView_(mgmt, guards, rows, decisions);
 writeHistory_(mgmt, guards, st);  
 const pubUrl = publishSchedule_(mgmt);  
  
  let msg = '✅ השיבוץ הושלם! (מכסה: ' + hardCap + ' שעות לשומר';
  if (maxShift) msg += ', משמרת עד ' + maxShift + ' שעות';
  msg += ')\n\n' + guards.map((n, g) =>
    n + ': ' + st[g].hours + ' שעות, ' + Math.round(st[g].weekdayPoints + st[g].shabbatPoints) + ' נק׳ קושי').join('\n');

  // דוח אופטימיזציה אוטומטי
  const emptyShifts = decisions.filter(d => d.mode === 'ריק').length;
  if (typeof plan.totalInternal === 'number' && plan.numGuards > 0) {
    const hpp = Math.ceil(plan.totalInternal / plan.numGuards);
    const hppPlus = Math.ceil(plan.totalInternal / (plan.numGuards + 1));
    msg += '\n\n📊 ניתוח אוטומטי: ' + plan.totalInternal + ' שעות ÷ ' + plan.numGuards + ' שומרים = ' + hpp + ' שעות/שומר';
    if (plan.capAdded > 0) msg += '\n   🔧 מכסה הוגדלה אוטומטית ב-' + plan.capAdded + ' שעות → ' + plan.optCap + ' שעות/שומר';
    if (plan.restRelaxed) msg += '\n   🔧 זמן מנוחה הופחת ב-' + plan.restReduced + ' שעה (כדי לכסות את הכל)';
    if (plan.shiftExtended) msg += '\n   🔧 אורך משמרת הוארך ב-+2 שעות (כדי לכסות את הכל)';
    if (plan.emergencyUsed) msg += '\n   🚨 מצב חירום הופעל — חלק מהשומרים שובצו ללא הגבלת מנוחה/שעות';
    if (emptyShifts > 0) {
      msg += '\n🚨 נותרו ' + emptyShifts + ' משמרות ריקות (כל השומרים חסומים ✕)';
      msg += '\n📌 פתרון: הוסף שומר נוסף → ' + hppPlus + ' שעות/שומר';
    } else if (hpp > 28) {
      msg += '\n⚠️ עומס כבד — מומלץ להוסיף שומר נוסף → ' + hppPlus + ' שעות/שומר';
    } else if (hpp > 22) {
      msg += '\n💡 אפשר להוסיף שומר נוסף → ' + hppPlus + ' שעות/שומר';
    } else {
      msg += '\n✅ עומס מאוזן — ' + plan.numGuards + ' שומרים מספיקים';
    }
  }

  msg += '\n\n💡 אם הפריסה לא טובה — תפריט 🛡️ ← "🔄 פרוס מחדש" לפריסה חלופית.';
  if (alerts.length) msg += '\n\n' + alerts.join('\n');
  if (pubUrl) msg += '\n\n🔗 קובץ הפרסום לשומרים:\n' + pubUrl;
  SpreadsheetApp.getUi().alert(msg);
}  
  
function syncCurrentSchedule_(mgmt, guards, rows, decisions) {
  const numG = guards.length;
  const sh = mgmt.getSheetByName(SHEET_AVAIL);
  if (!sh) return;
  const syncCol = 7 + numG;

  const byRow = {};
  decisions.forEach(d => {
    const r = rows[d.rowIdx];
    let name = '';
    if (d.mode === 'חיצוני' || d.mode === 'שותף') name = d.name || '';
    else if (d.guard >= 0) name = guards[d.guard];
    else name = '🚨 ריק';
    if (!byRow[r.sheetRow]) byRow[r.sheetRow] = [];
    if (name && !byRow[r.sheetRow].includes(name)) byRow[r.sheetRow].push(name);
  });

  const lastRow = sh.getLastRow();
  if (lastRow < 3) return;
  const numSyncRows = lastRow - 2;
  const colVals = new Array(numSyncRows).fill(null).map(() => ['']);
  Object.entries(byRow).forEach(([sheetRow, names]) => {
    const ri = Number(sheetRow) - 3;
    if (ri >= 0 && ri < numSyncRows) colVals[ri] = [names.join(' / ')];
  });
  sh.getRange(3, syncCol, numSyncRows, 1).setValues(colVals);
}

/* ============================================================
 * מבט מנהל — מה ביקשו + מה שובץ + חריגות
 * ============================================================ */
function rebuildManagerViewFromMenu() {
  SpreadsheetApp.getUi().alert('מבט מנהל מתעדכן רק בעת ריצת שיבוץ (▶️ הרץ שיבוץ).');
}

function buildManagerView_(mgmt, guards, rows, decisions) {
  const sh = getCleanSheet_(mgmt, SHEET_MANAGER);
  sh.setRightToLeft(true);
  const numG = guards.length;

  const headerVals = [['יום', 'שעות', 'עמדות', 'שובץ (נוכחי)'].concat(guards)];
  sh.getRange(1, 1, 1, 4 + numG).setValues(headerVals);
  styleHeader_(sh.getRange(1, 1, 1, 4 + numG));

  const assignedByRow = {};
  decisions.forEach(d => {
    const r = rows[d.rowIdx];
    let name = '';
    if (d.mode === 'חיצוני' || d.mode === 'שותף') name = d.name || '—';
    else if (d.guard >= 0) name = guards[d.guard];
    else name = '🚨 ריק';
    if (!assignedByRow[r.sheetRow]) assignedByRow[r.sheetRow] = { names: [], guards: [] };
    if (name && !assignedByRow[r.sheetRow].names.includes(name)) {
      assignedByRow[r.sheetRow].names.push(name);
    }
    if (d.guard >= 0 && !assignedByRow[r.sheetRow].guards.includes(d.guard)) {
      assignedByRow[r.sheetRow].guards.push(d.guard);
    }
  });

  const seen = new Set();
  const dataRows = [];
  const colorMatrix = [];

  rows.forEach(r => {
    if (seen.has(r.sheetRow)) return;
    seen.add(r.sheetRow);

    const assigned = assignedByRow[r.sheetRow] || { names: [], guards: [] };
    const assignedStr = assigned.names.join(' / ') || '—';
    const positions = r.positions || 1;

    const rowVals = [r.day, r.label, positions, assignedStr];
    const rowColors = ['#ffffff', '#ffffff', '#ffffff', '#ffffff'];

    if (assigned.names.includes('🚨 ריק')) rowColors[3] = '#f4c7c3';
    else if (positions > 1 && assigned.names.length < positions) rowColors[3] = '#fce8b2';

    guards.forEach((_, g) => {
      const mark = String(r.marks[g] || '').trim() || '1';
      const wasAssigned = assigned.guards.includes(g);
      rowVals.push(mark);
      if (wasAssigned) {
        if (mark === 'X') rowColors.push('#f4c7c3');
        else if (parseInt(mark) >= 4) rowColors.push('#ffe5cc');
        else if (parseInt(mark) >= 3) rowColors.push('#fff2cc');
        else rowColors.push('#d4edda');
      } else {
        rowColors.push('#ffffff');
      }
    });

    dataRows.push(rowVals);
    colorMatrix.push(rowColors);
  });

  if (dataRows.length === 0) return;
  sh.getRange(2, 1, dataRows.length, 4 + numG).setValues(dataRows);

  sh.getRange(2, 1, colorMatrix.length, 4 + numG).setBackgrounds(colorMatrix);

  sh.getRange(1, 4 + numG + 2).setValue('מקרא: 🟢 שובץ בנוחות | 🟡 שובץ בקושי | 🟠 קושי גדול | 🔴 שובץ למרות חסימה | 🟦 לא שובץ')
    .setFontColor('#555555').setFontSize(9).setFontStyle('italic');

  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.setColumnWidth(1, 75);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 60);
  sh.setColumnWidth(4, 160);
  sh.setColumnWidths(5, numG, 85);
}


function applyAssign_(st, g, r) {  
 const s = st[g];  
 s.run = (s.lastEnd === r.startAbs) ? s.run + r.hours : r.hours;  
 s.hours += r.hours;  
 if (r.isShabbat) s.shabbatPoints += r.weight * r.hours;  
 else s.weekdayPoints += r.weight * r.hours;  
 s.lastEnd = r.startAbs + r.hours;  
 s.lastNight = r.night || (s.lastNight && s.run > r.hours);  
}  
  
function chooseBest_(guards, r, st, hardCap, maxShift, futureManualHours, cfg, jitter, excluded, emergencyMode, targets) {
 const candidates = [];
 const excl = excluded || new Set();

 guards.forEach((name, g) => {
 if (excl.has(g)) return;
 const s = st[g];
 const mark = r.marks[g];
 if (isBlocked_(mark)) return;

 const isConsecutive = (s.lastEnd === r.startAbs);
 const curRun = isConsecutive ? s.run : 0;
 const maxRunLimit = emergencyMode ? (maxShift || 4) * 2 : maxShift;
 if (curRun >= maxRunLimit) return;
 if (!emergencyMode) {
 const guardCap = (targets && targets[g] > 0) ? targets[g] : hardCap;
 if (s.hours >= guardCap) return;
 const rest = r.external ? Number(cfg.NIGHT_REST_TIME) || 8 : Number(cfg.MIN_REST_TIME) || 4;
 if (!isConsecutive && s.lastEnd > 0 && r.startAbs < s.lastEnd + rest) return;
 }

 const debtSensitivity = Number(cfg.DEBT_SENSITIVITY) || 2;
 const adjustedGreen = (Number(cfg.GREEN_MAX_POINTS) || 20) - s.weekdayDebt * debtSensitivity;
 const adjustedYellow = (Number(cfg.YELLOW_MAX_POINTS) || 40) - s.weekdayDebt * debtSensitivity;

 let priority = emergencyMode ? 3 : 0;
 if (!emergencyMode) {
 if (s.weekdayPoints + s.shabbatPoints <= adjustedGreen) priority = 0;
 else if (s.weekdayPoints + s.shabbatPoints <= adjustedYellow) priority = 1;
 else priority = 2;
 }

 const cost = ratingToCost_(mark) * r.weight * (emergencyMode ? 100 : 1);
 const futureLoad = futureManualHours[g];
 const minShift = Number(cfg.MIN_SHIFT_LENGTH) || 2;
 const belowMin = isConsecutive && curRun > 0 && curRun < minShift;

 const guardTarget = (targets && targets[g] > 0) ? targets[g] : hardCap;
 candidates.push({ g, priority, cost, hours: s.hours, target: guardTarget, futureLoad, isConsecutive, belowMin });
 });

 if (candidates.length === 0) return -1;

 candidates.sort((a, b) => {
 if (a.belowMin !== b.belowMin) return a.belowMin ? -1 : 1; // השלם משמרת מינימלית לפני החלפה
 if (a.priority !== b.priority) return a.priority - b.priority;
 if (a.isConsecutive !== b.isConsecutive) return a.isConsecutive ? -1 : 1;
 const aRemain = a.target - a.hours;
 const bRemain = b.target - b.hours;
 if (Math.abs(aRemain - bRemain) > 0.5) return bRemain - aRemain; // מי שרחוק יותר ממכסתו — עדיפות
 if (Math.abs(a.futureLoad - b.futureLoad) > 0) return a.futureLoad - b.futureLoad;
 if (Math.abs(a.cost - b.cost) > 0.01) return a.cost - b.cost;
 if (jitter) return Math.random() - 0.5;
 return 0;
 });
  
 return candidates[0].g;  
}  
  
function getPartner_(guards, g, r, st, cfg) {  
 if (r.partnerName) return r.partnerName;  
  
 const rest = Number(cfg.MIN_REST_TIME) || 4;
 let best = null, bestHours = Infinity;

 guards.forEach((name, pg) => {
 if (pg === g) return;
 const s = st[pg];
 const mark = r.marks[pg];
 if (isBlocked_(mark)) return;
 const isConsecutive = (s.lastEnd === r.startAbs);
 if (!isConsecutive && s.lastEnd > 0 && r.startAbs < s.lastEnd + rest) return;  
 if (s.hours < bestHours) { best = name; bestHours = s.hours; }  
 });  
  
 return best;  
}  
  
function backtrack_(decisions, rows, st, guards, failIdx, cfg, hardCap, maxShift, futureManualHours, jitter, emergencyMode, targets) {  
 const maxBack = Number(cfg.MAX_BACKTRACK_HOURS) || 3;  
 const failRow = rows[failIdx];  
 const backLimit = failRow.startAbs - maxBack;  
  
 for (let j = decisions.length - 1; j >= 0; j--) {  
 const d = decisions[j];  
 const r = rows[d.rowIdx];  
 if (r.startAbs < backLimit) break;  
 if (r.manual || r.statusExternal || (r.external && r.covered)) continue;  
  
 const savedSt = JSON.parse(JSON.stringify(st));  
  
 for (let k = j; k < decisions.length; k++) {  
 const kd = decisions[k];  
 const kr = rows[kd.rowIdx];  
 if (kd.guard >= 0) {  
 const ks = st[kd.guard];  
 ks.hours -= kr.hours;  
 if (kr.isShabbat) ks.shabbatPoints -= kr.weight * kr.hours;  
 else ks.weekdayPoints -= kr.weight * kr.hours;  
 }  
 }  
  
 const excluded = new Set([d.guard]);
 const altG = chooseBestExcluding_(guards, r, st, hardCap, maxShift, futureManualHours, cfg, jitter, excluded, emergencyMode, targets);  
  
 if (altG === -1 || altG === d.guard) {  
 Object.assign(st, savedSt);  
 continue;  
 }  
  
 decisions.splice(j);  
 Object.keys(savedSt).forEach(k => { if (k <= j) st[k] = savedSt[k]; });  
 const cleanSt = initState_(guards);  
 decisions.forEach((dd, idx) => {  
 if (idx < j && dd.guard >= 0) applyAssign_(cleanSt, dd.guard, rows[dd.rowIdx]);  
 });  
 Object.assign(st, cleanSt);  
  
 decisions.push({ rowIdx: d.rowIdx, guard: altG, mode: 'חירום', partner: null });  
 applyAssign_(st, altG, r);  
 return j + 1;  
 }  
  
 return null;  
}  
  
function chooseBestExcluding_(guards, r, st, hardCap, maxShift, futureManualHours, cfg, jitter, excluded, emergencyMode, targets) {
 const candidates = [];
 guards.forEach((name, g) => {
 if (excluded.has(g)) return;
 const s = st[g];
 const mark = r.marks[g];
 if (isBlocked_(mark)) return;
 const isConsecutive = (s.lastEnd === r.startAbs);
 const curRun = isConsecutive ? s.run : 0;
 const maxRunLimit = emergencyMode ? (maxShift || 4) * 2 : maxShift;
 if (curRun >= maxRunLimit) return;
 if (!emergencyMode) {
 const guardCap = (targets && targets[g] > 0) ? targets[g] : hardCap;
 if (s.hours >= guardCap) return;
 const rest = r.external ? Number(cfg.NIGHT_REST_TIME) || 8 : Number(cfg.MIN_REST_TIME) || 4;
 if (!isConsecutive && s.lastEnd > 0 && r.startAbs < s.lastEnd + rest) return;
 }
 const cost = ratingToCost_(mark) * r.weight * (emergencyMode ? 100 : 1);
 const guardTarget = (targets && targets[g] > 0) ? targets[g] : hardCap;
 const minShift = Number(cfg.MIN_SHIFT_LENGTH) || 2;
 const belowMin = isConsecutive && curRun > 0 && curRun < minShift;
 candidates.push({ g, cost, hours: s.hours, target: guardTarget, isConsecutive, belowMin });
 });
 if (candidates.length === 0) return -1;
 candidates.sort((a, b) => {
 if (a.belowMin !== b.belowMin) return a.belowMin ? -1 : 1;
 if (a.isConsecutive !== b.isConsecutive) return a.isConsecutive ? -1 : 1;
 const aRemain = a.target - a.hours;
 const bRemain = b.target - b.hours;
 if (Math.abs(aRemain - bRemain) > 0.5) return bRemain - aRemain;
 if (Math.abs(a.cost - b.cost) > 0.01) return a.cost - b.cost;
 if (jitter) return Math.random() - 0.5;
 return 0;
 });
 return candidates[0].g;
}  
  
// ══════════════════════════════════════════════════════════
// § E · DATA READERS   readAvailabilityRows_ · initState_ · readSettings_
// ══════════════════════════════════════════════════════════
/* ============================================================
 * 11. קריאת זמינות  
 * ============================================================ */  
function readAvailabilityRows_(mgmt, guards, cfg, blocks) {
  const sh = mgmt.getSheetByName(SHEET_AVAIL);
  if (!sh) return [];
  const numGuards = guards.length;
  const totalCols = 5 + numGuards + 2;
  const lastRow = sh.getLastRow();
  if (lastRow < 3) return [];
  const data = sh.getRange(3, 1, lastRow - 2, totalCols).getValues();

  const extRows = readExternalRows_(mgmt, cfg);
  const rows = [];

  let absBase = 0;
  let prevDay = null;

  data.forEach((v, idx) => {
    const day = String(v[0]).trim();
    const label = String(v[1]).trim();
    if (!day || !label) return;

    const block = blocks.find(b => b.label === label);
    if (!block) return;

    if (day !== prevDay) {
      if (prevDay !== null) absBase += 24;
      prevDay = day;
    }

    const bStart = parseInt(label.slice(0, 2), 10);
    const startAbs = absBase + (bStart < 6 ? bStart + 24 : bStart);

    const statusExternal = v[3] === 'חיצוני בלבד';
    const positions = Number(v[4]) || 0;
    const marks = guards.map((_, g) => v[5 + g]);
    const manual = v[5 + numGuards] ? String(v[5 + numGuards]).trim() : '';
    const manualIdx = manual ? guards.indexOf(String(manual).trim()) : -1;

    const extMatch = extRows.find(e => e.day === day && e.blockLabel === label);
    const covered = !!(extMatch && extMatch.extName);
    const extName = extMatch ? extMatch.extName : '';
    const partnerName = extMatch ? extMatch.partnerName : '';
    const partnerRange = extMatch ? extMatch.partnerRange : '';
    const partnerIdx = partnerName ? guards.indexOf(partnerName) : -1;

    const dayIdx = DAYS.indexOf(day);
    const isShabbat = cfg ? isShabbat_(day, bStart, cfg) : false;
    const weights = cfg ? readWeights_(mgmt) : { 'יום': 1, 'ערב': 2, 'לילה': 3, 'מוצ"ש': 2, 'תפילות שבת': 3 };
    const weight = blockWeight_(day, block, weights, cfg, marks);

    if (!block.external && positions === 0) return;

    const posCount = block.external ? 1 : positions;
    for (let posIdx = 0; posIdx < posCount; posIdx++) {
      rows.push({
        day, label, dayIndex: dayIdx, startAbs, hours: block.hours,
        night: block.night, external: block.external,
        marks, manual: !!manual && posIdx === 0, manualIdx: posIdx === 0 ? manualIdx : -1,
        covered, extName, partnerName, partnerRange, partnerIdx,
        statusExternal, positions, positionIdx: posIdx,
        isShabbat, weight,
        sheetRow: 3 + idx,
      });
    }
  });

  return rows;
}
  
function readExternalRows_(mgmt, cfg) {  
 const extRows = [];  
 const weekStart = cfg.WEEK_START_DATE instanceof Date ? cfg.WEEK_START_DATE : null;  
 if (!weekStart) return extRows;  
  
 let extSh = null;  
 const extId = cfg.EXTERNAL_SPREADSHEET_ID;  
 if (extId) {  
 try { extSh = SpreadsheetApp.openById(extId).getSheetByName(SHEET_EXTERNAL); } catch(e) { Logger.log('readExternalRows_: ' + e); }  
 }  
 if (!extSh) extSh = mgmt.getSheetByName(SHEET_EXTERNAL);  
 if (!extSh) return extRows;  
  
 const data = extSh.getRange(2, 1, Math.max(1, extSh.getLastRow() - 1), 4).getValues();  
  
 data.forEach(row => {  
 const dateVal = row[0];  
 if (!dateVal || !(dateVal instanceof Date)) return;  
 const extName = String(row[1]).trim();  
 const partnerName = String(row[2]).trim();  
 const partnerRange = String(row[3]).trim();  
  
 const diff = Math.round((dateVal - weekStart) / 86400000);  
 if (diff < 0 || diff >= 7) return;  
  
 const dayName = DAYS[diff];  
 extRows.push({ day: dayName, blockLabel: '22:00-00:00', extName, partnerName, partnerRange });  
 extRows.push({ day: dayName, blockLabel: '00:00-02:00', extName, partnerName: '', partnerRange: '' });  
 });  
  
 return extRows;  
}  
  
/* ============================================================  
 * 12. ריצת היסטוריה  
 * ============================================================ */  
function writeHistory_(ss, guards, st) {  
 const sh = ss.getSheetByName(SHEET_HISTORY) || ss.insertSheet(SHEET_HISTORY);  
 sh.setRightToLeft(true);  
  
 const numG = guards.length;  
 const head = ['תאריך ריצה'].concat(  
 guards.map(n => n + ' — נק׳ חול'),  
 guards.map(n => n + ' — נק׳ שבת'),  
 guards.map(n => n + ' — חוב חול'),  
 guards.map(n => n + ' — חוב שבת'));  
  
 if (sh.getLastRow() === 0) {  
 sh.getRange(1, 1, 1, head.length).setValues([head]);  
 styleHeader_(sh.getRange(1, 1, 1, head.length));  
 } else if (sh.getLastRow() >= 1) {  
 const existingHead = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];  
 const existingGuards = existingHead.slice(1, numG + 1).map(h => h.replace(" — נק׳ חול", ''));  
 if (JSON.stringify(existingGuards) !== JSON.stringify(guards)) {  
 sh.clearContents();  
 sh.getRange(1, 1, 1, head.length).setValues([head]);  
 styleHeader_(sh.getRange(1, 1, 1, head.length));  
 }  
 }  
  
 const row = [new Date()].concat(  
 guards.map((_, g) => st[g].weekdayPoints),  
 guards.map((_, g) => st[g].shabbatPoints),  
 guards.map((_, g) => st[g].weekdayDebt),  
 guards.map((_, g) => st[g].shabbatDebt));  
 sh.appendRow(row);  
}  
  
/* ============================================================  
 * 13. פרסום לשומרים  
 * ============================================================ */  
function publishSchedule_(mgmt) {  
 const cfg = readSettings_(mgmt);  
 const pubId = cfg.PUBLISH_SPREADSHEET_ID;  
 if (!pubId) return null;  
  
 let pubSs;  
 try { pubSs = SpreadsheetApp.openById(pubId); } catch(e) { Logger.log('publishSchedule_: ' + e); return null; }  
  
 const src = mgmt.getSheetByName(SHEET_SCHEDULE);  
 if (!src) return null;  
  
 const dest = pubSs.getSheetByName(SHEET_SCHEDULE) || pubSs.insertSheet(SHEET_SCHEDULE);  
 dest.clearContents();  
 const vals = src.getDataRange().getValues();  
 if (vals.length > 0) dest.getRange(1, 1, vals.length, vals[0].length).setValues(vals);  
  
 return pubSs.getUrl();  
}  
  
/* ============================================================  
 * 14. כתיבת לוח שמירות  
 * ============================================================ */  
function writeSchedule_(ss, rows, decisions, guards, st) {  
 const sh = getCleanSheet_(ss, SHEET_SCHEDULE);  
 sh.setRightToLeft(true);  
 const cfg = readSettings_(ss);  
 const weekStart = cfg.WEEK_START_DATE instanceof Date ? cfg.WEEK_START_DATE : null;  
  
 sh.getRange(1, 1, 1, 4).merge()  
 .setValue('🗓️ לוח שמירות שבועי — בית חוגלה')  
 .setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center')  
 .setBackground('#1c4587').setFontColor('#ffffff');  
  
 let row = 3;  
 DAYS.forEach((day, di) => {  
 let header = '⭐ ' + day;  
 if (weekStart) {  
 const dd = new Date(weekStart);  
 const dayOffset = (di - weekStart.getDay() + 7) % 7;
      dd.setDate(dd.getDate() + dayOffset);  
 header += ' (' + dd.getDate() + '/' + (dd.getMonth() + 1) + ')';  
 }  
 sh.getRange(row, 1, 1, 4).merge()  
 .setValue(header)  
 .setFontWeight('bold').setBackground('#e6f2ff').setFontSize(12).setHorizontalAlignment('center');  
 row++;  
  
 sh.getRange(row, 1, 1, 4).setValues([['שעות', 'עמדה א׳ (פנימי)', 'עמדה ב׳ (חיצוני/שותף)', 'סטטוס']])  
 .setFontWeight('bold').setBackground('#f9f9f9').setHorizontalAlignment('center');  
 row++;  
  
 const dayStart = row;  
 const dayDecisions = decisions.filter(d => rows[d.rowIdx].dayIndex === di);  
  
 const cells = [];
 const labelCount = {};
 dayDecisions.forEach(d => {
   const lbl = rows[d.rowIdx].label;
   labelCount[lbl] = (labelCount[lbl] || 0) + 1;
 });

 const labelSeen = {};
 let idx = 0;
 while (idx < dayDecisions.length) {
   const d = dayDecisions[idx];
   const r = rows[d.rowIdx];
   labelSeen[r.label] = (labelSeen[r.label] || 0) + 1;
   const isSecond = labelCount[r.label] > 1 && labelSeen[r.label] > 1;

   // Merge consecutive same-guard single-position assignments into one row
   let displayLabel = isSecond ? '↳ עמ׳ ב׳' : r.label;
   let skipTo = idx + 1;
   if (!isSecond && d.guard >= 0 && d.mode !== 'חיצוני' && d.mode !== 'שותף') {
     let endLabel = r.label.slice(6);
     let endAbs = r.startAbs + r.hours;
     let j = idx + 1;
     while (j < dayDecisions.length) {
       const d2 = dayDecisions[j], r2 = rows[d2.rowIdx];
       if (labelCount[r2.label] > 1 || d2.guard !== d.guard || d2.mode !== d.mode || r2.startAbs !== endAbs) break;
       endLabel = r2.label.slice(6);
       endAbs = r2.startAbs + r2.hours;
       j++;
     }
     if (j > idx + 1) displayLabel = r.label.slice(0, 5) + '-' + endLabel;
     skipTo = j;
   }

   let posA, posB, status, cA = '#ffffff', cB = '#ffffff';
   if (d.mode === 'חיצוני') {
     posA = '—'; posB = d.name; status = '👥 חיצוני'; cB = '#d9d9d9';
   } else if (d.mode === 'שותף') {
     posA = '—'; posB = d.name + ' (סיור)'; status = '🚶 סיור/שותף'; cB = '#d0e8d0';
   } else if (d.guard === -1) {
     posA = '🚨 ריק'; posB = d.partner || '—'; status = '🚨 לא מאויש!'; cA = '#ff0000';
   } else {
     posA = guards[d.guard];
     if (r.night && !r.external) posB = d.partner || '—';
     else if (r.external) posB = '⚠️ אין חיצוני';
     else posB = '—';
     if (d.mode === 'חירום') { status = '⚠️ חירום'; cA = '#f9cb9c'; }
     else if (d.mode === 'ידני') { status = '🔒 ידני'; cA = '#d9d2e9'; }
     else { status = '✅ תקין'; }
   }
   cells.push([displayLabel, posA, posB, status, cA, cB]);
   idx = skipTo;
 }

 if (cells.length === 0) { row++; return; }
 sh.getRange(dayStart, 1, cells.length, 4).setValues(cells.map(c => [c[0], c[1], c[2], c[3]]));
 sh.getRange(dayStart, 2, cells.length, 1).setBackgrounds(cells.map(c => [c[4]]));
 sh.getRange(dayStart, 3, cells.length, 1).setBackgrounds(cells.map(c => [c[5]]));
 row += cells.length;
 row++;  
 });  
  
 sh.setColumnWidth(1, 130).setColumnWidth(2, 180).setColumnWidth(3, 200).setColumnWidth(4, 140);  
 sh.setFrozenRows(2);  
}  
  
/* ============================================================  
 * 15. אתחול מצב שומרים  
 * ============================================================ */  
function initState_(guards, mgmt, cfg) {  
 const st = {};  
 const numG = guards.length;  
  
 guards.forEach((_, g) => {  
 st[g] = {  
 hours: 0, run: 0, lastEnd: 0, lastNight: false,  
 weekdayPoints: 0, shabbatPoints: 0,  
 weekdayDebt: 0, shabbatDebt: 0,  
 };  
 });  
  
 if (!mgmt || !cfg) return st;  
  
 const hi = mgmt.getSheetByName(SHEET_HISTORY);  
 if (!hi || hi.getLastRow() < 2) return st;  
  
 const lastRow = hi.getRange(hi.getLastRow(), 1, 1, hi.getLastColumn()).getValues()[0];  
 const head = hi.getRange(1, 1, 1, hi.getLastColumn()).getValues()[0];  
  
 guards.forEach((name, g) => {  
 const wdi = head.findIndex(h => h === name + " — נק׳ חול");  
 const shi = head.findIndex(h => h === name + " — נק׳ שבת");  
 const cdhi = head.findIndex(h => h === name + " — חוב חול");  
 const cshi = head.findIndex(h => h === name + " — חוב שבת");  
  
 if (wdi >= 0) st[g].weekdayDebt = Number(lastRow[wdi]) || 0;  
 if (shi >= 0) st[g].shabbatDebt = Number(lastRow[shi]) || 0;  
 if (cdhi >= 0) st[g].weekdayDebt += Number(lastRow[cdhi]) || 0;  
 if (cshi >= 0) st[g].shabbatDebt += Number(lastRow[cshi]) || 0;  
 });  
  
 return st;  
}  
  
/* ============================================================  
 * 16. קריאת הגדרות  
 * ============================================================ */  
function readSettings_(ss) {  
 const sh = ss.getSheetByName(SHEET_SETTINGS);  
 if (!sh) return {};  
 const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 2).getValues();  
 const cfg = {};  
 data.forEach(r => {  
 if (r[0]) cfg[String(r[0]).trim()] = r[1];  
 });  
 if (cfg.WEEK_START_DATE && !(cfg.WEEK_START_DATE instanceof Date)) {  
 const d = new Date(cfg.WEEK_START_DATE);  
 if (!isNaN(d)) cfg.WEEK_START_DATE = d;  
 }  
 return cfg;  
}  
  
function readWeights_(ss) {  
 const sh = ss.getSheetByName(SHEET_SETTINGS);  
 if (!sh) return { 'יום': 1, 'ערב': 2, 'לילה': 3, 'מוצ"ש': 2, 'תפילות שבת': 3 };  
 const data = sh.getRange(2, 5, Math.max(1, sh.getLastRow() - 1), 2).getValues();  
 const w = { 'יום': 1, 'ערב': 2, 'לילה': 3, 'מוצ"ש': 2, 'תפילות שבת': 3 };  
 data.forEach(r => { if (r[0]) w[String(r[0]).trim()] = Number(r[1]) || 1; });  
 return w;  
}  
  
function setSettingsValue_(ss, key, value) {  
 const sh = ss.getSheetByName(SHEET_SETTINGS);  
 if (!sh) return;  
 const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();  
 for (let i = 0; i < data.length; i++) {  
 if (String(data[i][0]).trim() === key) {  
 sh.getRange(i + 2, 2).setValue(value);  
 return;  
 }  
 }  
 sh.appendRow([key, value]);  
}  
  
/* ============================================================  
 * 17. עזרים כלליים  
 * ============================================================ */  
function mgmt_() {  
 const id = PropertiesService.getScriptProperties().getProperty('MGMT_ID');  
 return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();  
}  
  
function readGuards_(ss) {
 const sh = ss.getSheetByName(SHEET_GUARDS);
 if (!sh || sh.getLastRow() < 2) return [];
 return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
 .map(r => String(r[0]).trim()).filter(n => n);
}

// קורא עמודה B מ-SHEET_GUARDS (מכסה שעות לכל שומר).
// תא ריק / 0 → totalHours / numGuards (ממוצע אוטומטי).
function readGuardTargets_(ss, guards, totalHours) {
 const avg = guards.length > 0 ? totalHours / guards.length : 0;
 const sh = ss.getSheetByName(SHEET_GUARDS);
 if (!sh || sh.getLastRow() < 2) return guards.map(() => avg);
 const vals = sh.getRange(2, 2, guards.length, 1).getValues();
 return guards.map((_, i) => {
 const v = Number(vals[i] ? vals[i][0] : 0);
 return v > 0 ? v : avg;
 });
}

// כתוב ממוצע שעות לתאים ריקים בעמודה B של SHEET_GUARDS + הצג סיכום.
function fillGuardTargetAverages() {
 const mgmt = mgmt_();
 const guards = readGuards_(mgmt);
 if (guards.length === 0) { SpreadsheetApp.getUi().alert('אין שומרים ברשימה!'); return; }
 const cfg = readSettings_(mgmt);
 const totalHours = calcRequiredHours_(mgmt, guards, cfg);
 const avg = Math.round(totalHours / guards.length * 10) / 10;

 const sh = mgmt.getSheetByName(SHEET_GUARDS);
 const vals = sh.getRange(2, 2, guards.length, 1).getValues();
 let filled = 0;
 vals.forEach((row, i) => { if (!Number(row[0])) { vals[i][0] = avg; filled++; } });
 sh.getRange(2, 2, guards.length, 1).setValues(vals);

 const summaryRow = guards.length + 3;
 sh.getRange(summaryRow, 1, 1, 2).setValues([['📊 סה"כ שבועי', totalHours + ' שעות | ממוצע: ' + avg]]);

 SpreadsheetApp.getUi().alert(
 'סה"כ שעות לשיבוץ: ' + totalHours +
 '\nממוצע לשומר: ' + avg +
 '\nמולאו ' + filled + ' תאים ריקים.\n\nערוך את עמודה B ידנית כדי לשנות מכסה לשומר ספציפי.');
}

function getCleanSheet_(ss, name) {  
 let sh = ss.getSheetByName(name);  
 if (sh) sh.clearContents().clearFormats().clearConditionalFormatRules();  
 else sh = ss.insertSheet(name);  
 return sh;  
}  
  
function styleHeader_(range) {  
 range.setFontWeight('bold').setBackground('#1c4587').setFontColor('#ffffff')  
 .setHorizontalAlignment('center');  
}  
  
/* ============================================================  
 * 18. אפס זמינות  
 * ============================================================ */  
function resetAvailability() {  
 const mgmt = mgmt_();  
 const sh = mgmt.getSheetByName(SHEET_AVAIL);  
 if (!sh) { SpreadsheetApp.getUi().alert('גיליון זמינות לא נמצא!'); return; }  
  
 const guards = readGuards_(mgmt);  
 const numG = guards.length;  
 const lastRow = sh.getLastRow();  
 if (lastRow < 3) return;  
  
 sh.getRange(3, 6, lastRow - 2, numG)  
 .setValue(MARK_FREE);  
 sh.getRange(3, 6 + numG, lastRow - 2, 1).clearContent();  
 sh.getRange(3, 7 + numG, lastRow - 2, 1).clearContent();  
 SpreadsheetApp.getUi().alert('✅ הזמינות אופסה — כל השומרים חזרו ל-1 (פנוי).');  
}  
  
/* ============================================================  
 * 19. טריגרים  
 * ============================================================ */  
function setupTriggers() {  
 ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));  
 ScriptApp.newTrigger('resetAvailability').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(6).create();  
 SpreadsheetApp.getUi().alert('✅ טריגר שבועי הוגדר: איפוס זמינות כל ראשון ב-06:00.');  
}  
  
/* ============================================================  
 * 20. מילוי חיצוניים — יוני 2026  
 * ============================================================ */  
function fillExternalJune() {  
 const mgmt = mgmt_();  
 const sh = mgmt.getSheetByName(SHEET_EXTERNAL);  
 if (!sh) { SpreadsheetApp.getUi().alert('גיליון חיצוניים לא נמצא!'); return; }  
  
 const june2026 = [  
 [new Date(2026, 5, 1), 'חיצוני א', '', ''],  
 [new Date(2026, 5, 2), 'חיצוני ב', '', ''],  
 [new Date(2026, 5, 3), 'חיצוני ג', '', ''],  
 [new Date(2026, 5, 4), 'חיצוני ד', '', ''],  
 [new Date(2026, 5, 5), 'חיצוני ה', '', ''],  
 [new Date(2026, 5, 6), 'חיצוני ו', '', ''],  
 [new Date(2026, 5, 7), 'חיצוני ז', '', ''],  
 ];  
  
 sh.getRange(2, 1, june2026.length, 4).setValues(june2026);  
 sh.getRange(2, 1, june2026.length, 1).setNumberFormat('dd/mm/yyyy');  
 SpreadsheetApp.getUi().alert('✅ לוח חיצוניים יוני 2026 הוזן.');  
}  
  
/* ============================================================  
 * 21. ממשק שומר  
 * ============================================================ */  
function doGet(e) {  
 const guardName = (e && e.parameter && e.parameter.guard) ? String(e.parameter.guard).trim().replace(/^["']+|["']+$/g, '').trim() : '';  
 const template = HtmlService.createTemplateFromFile('Index');  
 template.guardName = guardName;  
 return template.evaluate()  
 .setTitle('טופס זמינות שמירה')  
 .addMetaTag('viewport', 'width=device-width, initial-scale=1');  
}  
  
/* ============================================================  
 * 22. שמירת זמינות מהממשק  
 * ============================================================ */  
function saveGuardPreferences(payload) {
  try {
    const mgmt = mgmt_();
    const sh = mgmt.getSheetByName(SHEET_AVAIL);
    if (!sh) throw new Error('גיליון זמינות לא נמצא');

    const resolvedName = String(payload.guard || payload.name || '').trim().replace(/^["']+|["']+$/g, '').trim();
    const guards = readGuards_(mgmt);
    const guardCol = guards.findIndex(name => name.trim() === resolvedName);
    if (guardCol < 0) throw new Error('שומר לא נמצא ברשימה: [' + resolvedName + '] ' + GS_VERSION);

    const sheetCol = 6 + guardCol;
    const blocks = buildBlocks_();
    const numDays = DAYS.length;
    const numBlocks = blocks.length;

    const rowMap = {};
    const mapData = sh.getRange(3, 1, numDays * numBlocks, 2).getValues();
    mapData.forEach((r, i) => {
      const key = String(r[0]).trim() + '|' + String(r[1]).trim();
      rowMap[key] = 3 + i;
    });

    const daysArray = Array.isArray(payload.days)
      ? payload.days
      : Object.keys(payload.days).sort((a, b) => +a - +b).map(k => payload.days[k]);
    daysArray.forEach((dayData, di) => {
      const dayName = DAYS[di];
      Object.keys(dayData).forEach(bk => {
        const slotData = dayData[bk];
        if (!slotData || typeof slotData.slots !== 'object') return;
        Object.entries(slotData.slots).forEach(([slot, mark]) => {
          const slotKey = dayName + '|' + slot;
          const sheetRow = rowMap[slotKey];
          if (!sheetRow) return;
          const slotMark = mark ? String(mark).trim() : String(RATING_DEFAULT);
          sh.getRange(sheetRow, sheetCol).setValue(slotMark);
        });
      });
    });

    return { success: true, message: "הזמינות נשמרה בהצלחה" };
  } catch (error) {
    Logger.log("שגיאה בשמירה: " + error.toString());
    throw new Error("לא הצלחנו לשמור: " + error.toString());
  }
}

