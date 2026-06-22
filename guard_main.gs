/**  
 * 🛡️ מערכת שיבוץ שמירות — שלב 2.1: אלגוריתם דינמי עם סריקה מקדימה של שיבוצים ידניים  
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
  
/* ============================================================  
 * 1. בלוקי זמן  
 * ============================================================ */  
function buildBlocks_() {  
 // לילה מפוצל לבלוקים של שעתיים — מאפשר טווח חיצוני/סיור גמיש (למשל סיור 04:00-06:00).  
 // 22:00-00:00 ו-00:00-02:00 = חיצוני (תורנות ישוב). 02:00-06:00 = פנימי.  
 const blocks = [  
 { label: '22:00-00:00', hours: 2, night: true, external: true },  
 { label: '00:00-02:00', hours: 2, night: true, external: true },  
 { label: '02:00-04:00', hours: 2, night: true, external: false },  
 { label: '04:00-06:00', hours: 2, night: true, external: false },  
 ];  
 for (let h = 6; h < 22; h++) {  
 blocks.push({  
 label: ('0' + h).slice(-2) + ':00-' + ('0' + (h + 1)).slice(-2) + ':00',  
 hours: 1, night: false, external: false,  
 });  
 }  
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
// בחול: משקל קבוע לפי סוג הבלוק (לילה/ערב/יום) — כמו V1 המקורי.  
// בשבת: המשקלים הקבועים כבויים → המשקל = ממוצע הדירוג 1–5 של השומרים הזמינים.  
// marksForBlock אופציונלי — נדרש רק לחישוב השבת. cfg אופציונלי — בלעדיו מתנהג כמו חול.  
function blockWeight_(dayName, block, weights, cfg, marksForBlock) {  
 const h = parseInt(block.label.slice(0, 2), 10);  
  
 // שבת: משקל לפי דירוג השומרים בלבד  
 if (cfg && isShabbat_(dayName, h, cfg)) {  
 if (!marksForBlock || marksForBlock.length === 0) return 3;  
 const costs = marksForBlock.map(ratingToCost_).filter(c => isFinite(c));  
 if (costs.length === 0) return 3; // כולם חסומים  
 return costs.reduce((a, b) => a + b, 0) / costs.length;  
 }  
  
 // חול: משקל קבוע (לוגיקת V1 המקורית)  
 if (block.night) return weights['לילה'];  
 if (dayName === 'שבת') {  
 if (h >= 8 && h < 11) return weights['תפילות שבת'];  
 if (h >= 19) return weights['מוצ"ש'];  
 }  
 if (h >= 18) return weights['ערב'];  
 return weights['יום'];  
}  
  
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
 // ── ⏱ זמני משמרות ומנוחה ──
 ['⏱ זמני משמרות ומנוחה', '', ''],
 ['MAX_SHIFT_LENGTH', 4, 'מקסימום שעות רצופות למשמרת אחת (ברירת מחדל: 4)'],
 ['MIN_SHIFT_LENGTH', 2, 'מינימום שעות רצופות לפני החלפת שומר (ברירת מחדל: 2)'],
 ['MIN_REST_TIME', 4, 'שעות מנוחה מינימליות בין שתי משמרות רגילות (ברירת מחדל: 4)'],
 ['NIGHT_REST_TIME', 8, 'שעות מנוחה חובה אחרי משמרת לילה (שעות קטנות, ברירת מחדל: 8)'],
 ['MAX_BACKTRACK_HOURS', 3, 'מספר השעות שהאלגוריתם חוזר אחורה כשנתקע במבוי סתום (ברירת מחדל: 3)'],
 // ── 📊 ניקוד ואיזון ──
 ['📊 ניקוד ואיזון', '', ''],
 ['MAX_WEEKDAY_DEBT_HOURS', 2, 'סף הפרש שעות שבועי בין שומרים; מעל הסף — האלגוריתם מאזן (ברירת מחדל: 2)'],
 ['GREEN_MAX_POINTS', 20, 'עד כמה נקודות חסימה הצבורות השומר נשאר ירוק (פנוי לשיבוץ)'],
 ['YELLOW_MAX_POINTS', 40, 'עד כמה נקודות = רמזור צהוב; מעל זה = אדום (עמוס — ישובץ רק בהכרח)'],
 ['QUESTION_COST_FACTOR', 0.5, 'עלות "?" ביחס ל-"✕" (0.5 = חצי נקודה, 1.0 = שווה ל-✕)'],
 ['DEBT_SENSITIVITY', 2, 'כמה נקודות חוב מהשבוע הקודם מורידות את סף הרמזור של השומר'],
 // ── 📅 חלון שבת ──
 ['📅 חלון שבת', '', ''],
 ['SHABBAT_START_DAY', 'שישי', 'יום תחילת חלון שבת/חג (ברירת מחדל: שישי)'],
 ['SHABBAT_START_HOUR', 6, 'שעת פתיחת חלון שבת ביום ההתחלה — פורמט 24 שעות (ברירת מחדל: 6)'],
 ['SHABBAT_END_DAY', 'ראשון', 'יום סיום חלון שבת/חג (ברירת מחדל: ראשון)'],
 ['SHABBAT_END_HOUR', 6, 'שעת סגירת חלון שבת ביום הסיום — פורמט 24 שעות (ברירת מחדל: 6)'],
 // ── 🔗 גיליונות מקושרים ──
 ['🔗 גיליונות מקושרים', '', ''],
 ['WEEK_START_DATE', '', 'תאריך יום ראשון של השבוע המשובץ; משמש לייבוא שומרים חיצוניים מהקובץ המשותף'],
 ['AVAIL_SPREADSHEET_ID', '', 'מזהה Google Sheets של קובץ הזמינות (ממולא אוטומטית ע"י createAvailabilityFile)'],
 ['PUBLISH_SPREADSHEET_ID', '', 'מזהה Google Sheets לפרסום לוח השמירות לשומרים (ממולא אוטומטית)'],
 ['EXTERNAL_SPREADSHEET_ID', '', 'מזהה קובץ נפרד לשומרים חיצוניים; ריק = קריאה מהטבלה המקומית'],
 ];
 sh.getRange(1, 1, rows.length, 3).setValues(rows);
 styleHeader_(sh.getRange(1, 1, 1, 3));
 sh.getRange(2, 2, rows.length - 1, 1).setBackground('#fff2cc');
 // עיצוב כותרות סעיפים: שורות 2, 8, 14, 19 (אינדקס 1-based בגיליון)
 [2, 8, 14, 19].forEach(r => {
   const hdr = sh.getRange(r, 1, 1, 3);
   hdr.setBackground('#f3f3f3').setFontWeight('bold');
   sh.getRange(r, 2).setBackground('#f3f3f3'); // ביטול הצהוב לתאי ערך בשורת כותרת
 });
 sh.getRange(20, 2).setNumberFormat('dd/mm/yyyy'); // WEEK_START_DATE  
  
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
 gs.getRange(1, 1).setValue('שם השומר');  
 gs.getRange(2, 1, names.length, 1).setValues(names);  
 styleHeader_(gs.getRange(1, 1, 1, 1));  
  
 const ex = getCleanSheet_(ss, SHEET_EXTERNAL);  
 ex.setRightToLeft(true);  
 ex.getRange(1, 1, 1, 4).setValues([['תאריך', 'שומר 22:00-02:00', 'שותף 02:00-06:00 (מהישוב)', 'טווח שותף']]);  
 styleHeader_(ex.getRange(1, 1, 1, 4));  
 ex.getRange(2, 1, 31, 1).setNumberFormat('dd/mm/yyyy');  
 // dropdown לטווח השותף: מלא (02-06) או סיור (04-06). ריק = מלא.  
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
  rebuildAvailabilityIn_(mgmt, guards);
  SpreadsheetApp.getUi().alert('✅ לשונית הזמינות נוצרה/עודכנה עבור ' + guards.length + ' שומרים!');
}
  
function rebuildAvailabilityIn_(ss, guards) {  
 const sh = getCleanSheet_(ss, SHEET_AVAIL);  
 sh.setRightToLeft(true);  
 const blocks = buildBlocks_();  
 const numG = guards.length;  
 const totalCols = 4 + numG + 1;  
  
 sh.getRange(1, 1, 1, 4).setValues([['יום', 'בלוק זמן', 'שעות', 'סטטוס בלוק']]);  
 sh.getRange(1, 5, 1, numG).setValues([guards]);  
 sh.getRange(1, 5 + numG).setValue('🔒 שיבוץ ידני');  
 sh.getRange(2, 1).setValue('🚦 רמזור ←');  
 sh.getRange(2, 5, 1, numG).setValue('—').setHorizontalAlignment('center');  
  
 const data = [];  
 DAYS.forEach(day => blocks.forEach(b => {  
 const status = b.external ? 'שומר חיצוני' : 'פעיל';  
 const row = [day, b.label, b.hours, status];  
 guards.forEach(() => row.push(MARK_FREE));  
 row.push('');  
 data.push(row);  
 }));  
 sh.getRange(3, 1, data.length, totalCols).setValues(data);  
  
 styleHeader_(sh.getRange(1, 1, 1, totalCols));  
 sh.setFrozenRows(2);  
 sh.setFrozenColumns(2);  
  
 const vxRule = SpreadsheetApp.newDataValidation()  
 .requireValueInList(['1', '2', '3', '4', '5', MARK_BLOCK], true).setAllowInvalid(false).build();  
 const manualRule = SpreadsheetApp.newDataValidation()  
 .requireValueInList(guards, true).setAllowInvalid(false).build();  
 sh.getRange(3, 5, data.length, numG).setDataValidation(vxRule);  
 sh.getRange(3, 5 + numG, data.length, 1).setDataValidation(manualRule);  
  
 const marksRange = sh.getRange(3, 5, data.length, numG);  
 sh.setConditionalFormatRules([  
 SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('1').setBackground('#1a7a1a').setFontColor('#ffffff').setRanges([marksRange]).build(),  
 SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('2').setBackground('#5cb85c').setRanges([marksRange]).build(),  
 SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('3').setBackground('#fff2cc').setRanges([marksRange]).build(),  
 SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('4').setBackground('#f0a030').setRanges([marksRange]).build(),  
 SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('5').setBackground('#cc2222').setFontColor('#ffffff').setRanges([marksRange]).build(),  
 SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(MARK_BLOCK).setBackground('#888888').setFontColor('#ffffff').setRanges([marksRange]).build(),  
 ]);  
  
 for (let d = 0; d < DAYS.length; d++) {  
 const start = 3 + d * blocks.length;  
 sh.getRange(start, 1, 2, totalCols).setBackground('#cfe2f3');  
 sh.getRange(start, 1, 1, totalCols).setBackground('#d9d9d9');  
 sh.getRange(start, 1, blocks.length, totalCols).setBorder(true, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);  
 }  
 sh.getRange(3, 1, data.length, totalCols).setHorizontalAlignment('center');  
 sh.setColumnWidth(1, 70).setColumnWidth(2, 110).setColumnWidth(3, 55).setColumnWidth(4, 130)  
 .setColumnWidths(5, numG, 95).setColumnWidth(5 + numG, 120);  
  
 buildQuickFillSheet_(ss, guards);  
}  
  
function buildQuickFillSheet_(ss, guards) {  
 const sh = getCleanSheet_(ss, SHEET_QUICK);  
 sh.setRightToLeft(true);  
 sh.getRange(1, 1, 1, 6).setValues([['שם שומר', 'יום', 'משעה', 'עד שעה', 'סימון', 'סטטוס']]);  
 styleHeader_(sh.getRange(1, 1, 1, 6));  
 sh.setFrozenRows(1);  
  
 const N = 60;  
 sh.getRange(2, 1, N, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(guards, true).setAllowInvalid(false).build());  
 sh.getRange(2, 2, N, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(DAYS, true).setAllowInvalid(false).build());  
  
 const hoursFrom = [];  
 for (let h = 2; h <= 22; h++) hoursFrom.push(('0' + h).slice(-2) + ':00');  
 const hoursTo = ['06:00 (סוף לילה)'];  
 for (let h = 2; h <= 22; h++) hoursTo.push(('0' + h).slice(-2) + ':00');  
  
 sh.getRange(2, 3, N, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(hoursFrom, true).setAllowInvalid(false).build());  
 sh.getRange(2, 4, N, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(hoursTo, true).setAllowInvalid(false).build());  
 sh.getRange(2, 5, N, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3', '4', '5', MARK_BLOCK], true).setAllowInvalid(false).build());  
  
 const tips = [  
 '💡 בחר שם ← יום ← משעה ← עד שעה ← סימון. הסימון יופיע ב"📋 זמינות" תוך שניות.',  
 '✅ מופיע אוטומטית בעמודת "סטטוס" אחרי עיבוד. שורה שכבר עובדה לא תעובד שוב.',  
 'דירוג: 1=הכי נוח ... 5=קשה מאוד, X=חסום לחלוטין. ריק = נחשב כ-1.',  
 'לילה פנימי 02:00-06:00: הגדר משעה=02:00 ועד שעה=06:00 (סוף לילה).',  
 'לא פנוי כל היום: משעה=06:00, עד שעה=22:00, סימון=X.',  
 '⚠️ הבלוק 22:00-02:00 הוא תורנות ישוב — לא ניתן לחסום אותו כאן.',  
 '🔄 לחצן "⚡ הפעל מילוי מהיר" בתפריט מעבד את כל השורות הממתינות בבת אחת.',  
 ];  
 tips.forEach((t, i) => sh.getRange(i + 1, 8).setValue(t).setFontColor('#555555').setFontSize(10));  
 sh.setColumnWidths(1, 6, 100).setColumnWidth(8, 380);  
}  
  
/* ============================================================  
 * 5. ⏰ טריגר רמזור + מילוי מהיר  
 * ============================================================ */  
function setupTriggers() {  
 if (!id) { SpreadsheetApp.getUi().alert('קודם צור קובץ זמינות משותף'); return; }  
 ScriptApp.getProjectTriggers().forEach(t => {  
 if (t.getHandlerFunction() === 'onAvailEdit') ScriptApp.deleteTrigger(t);  
 });  
 ScriptApp.newTrigger('onAvailEdit').forSpreadsheet(id).onEdit().create();  
 SpreadsheetApp.getActiveSpreadsheet().toast('הרמזור יתעדכן אוטומטית', '✅', 6);  
}  
  
function onAvailEdit(e) {  
 try {  
 if (e && e.range && e.range.getSheet().getName() === SHEET_QUICK) {  
 processQuickFill_(e.source);  
 }  
 updateTrafficLights();  
 } catch (err) { /* שקט בטריגר */ }  
}  
  
function runQuickFill() {  
 const cfg = readSettings_(mgmt_());  
 const front = mgmt_();
 processQuickFill_(front);  
 SpreadsheetApp.getActiveSpreadsheet().toast('המילוי המהיר הופעל', '✅', 4);  
}  
  
function processQuickFill_(front) {  
 const mgmt = mgmt_();  
 const guards = readGuards_(mgmt);  
 const qs = front.getSheetByName(SHEET_QUICK);  
 const av = front.getSheetByName(SHEET_AVAIL);  
 if (!qs || !av) return;  
 const last = qs.getLastRow();  
 if (last < 2) return;  
 const vals = qs.getRange(2, 1, last - 1, 6).getValues();  
 const blocks = buildBlocks_();  
  
 vals.forEach((v, idx) => {  
 const [name, day, fromS, toRaw, mark, status] = v.map(x => String(x).trim());  
 if (status === '✅' || !name || !day || !fromS || !toRaw || !mark) return;  
 const g = guards.indexOf(name), d = DAYS.indexOf(day);  
 const toS = toRaw.startsWith('06:00') ? '06:00' : toRaw;  
 const from = parseInt(fromS, 10), to = parseInt(toS, 10);  
 if (g < 0 || d < 0 || isNaN(from) || isNaN(to) || to === from) {  
 qs.getRange(2 + idx, 6).setValue('⚠️ שגוי — ודא שם, יום ו"עד" שונה מ"מ"');  
 return;  
 }  
 if (to < from) {  
 qs.getRange(2 + idx, 6).setValue('⚠️ לא ניתן לחצות חצות — סמן לילה כ-02:00 עד 06:00');  
 return;  
 }  
 blocks.forEach((b, bi) => {  
 if (b.external) return;  
 const bs = parseInt(b.label.slice(0, 2), 10);  
 const be = b.night ? bs + b.hours : bs + 1;  
 if (from < be && to > bs) {  
 av.getRange(3 + d * blocks.length + bi, 5 + g).setValue(mark);  
 }  
 });  
 qs.getRange(2 + idx, 6).setValue('✅');  
 });  
}  
  
/* ============================================================  
 * 6. 🚦 רמזור  
 * ============================================================ */  
function updateTrafficLights() {  
 const mgmt = mgmt_();  
 const cfg = readSettings_(mgmt);  
 const guards = readGuards_(mgmt);  
 const numG = guards.length;  
 if (numG === 0) return;  
 const sh = mgmt.getSheetByName(SHEET_AVAIL);
 const rows = readAvailabilityRows_(sh, cfg, numG);  
 const debts = readLastDebts_(mgmt, guards);  
 const debtTotal = guards.map((_, g) => (debts.weekday[g] || 0) + (debts.shabbat[g] || 0));  
  
 const scores = guards.map(() => 0);  
 rows.forEach(r => {  
 if (r.external || r.statusExternal) return;  
 // מודל דירוג 1–5: X = עלות מלאה (כמו חסימה), דירוג גבוה = עלות חלקית.  
 // דירוג 1 (נוח) = 0 עלות, 5 (קשה מאוד) → קרוב לעלות חסימה.  
 const blockedCount = r.marks.filter(m => isBlocked_(m)).length;  
 const mult = Math.max(1, blockedCount);  
 r.marks.forEach((m, g) => {  
 if (isBlocked_(m)) {  
 scores[g] += r.weight * r.hours * mult; // X = עלות מלאה  
 } else {  
 const cost = ratingToCost_(m); // 1..5  
 const frac = (cost - RATING_MIN) / (RATING_MAX - RATING_MIN); // 0..1  
 scores[g] += r.weight * r.hours * mult * frac * cfg.QUESTION_COST_FACTOR;  
 }  
 });  
 });  
  
 const out = [], colors = [];  
 guards.forEach((name, g) => {  
 const debt = Math.max(0, debtTotal[g]);  
 const greenMax = Math.max(5, cfg.GREEN_MAX_POINTS - cfg.DEBT_SENSITIVITY * debt);  
 const yellowMax = Math.max(10, cfg.YELLOW_MAX_POINTS - cfg.DEBT_SENSITIVITY * debt);  
 const s = Math.round(scores[g]);  
 let label, color;  
 if (s <= greenMax) { label = '🟢 ' + s; color = '#d9ead3'; }  
 else if (s <= yellowMax) { label = '🟡 ' + s; color = '#fff2cc'; }  
 else { label = '🔴 ' + s; color = '#f4cccc'; }  
 if (debt > 0) label += ' (חוב ' + debt.toFixed(1) + ')';  
 out.push(label); colors.push(color);  
 });  
 sh.getRange(2, 5, 1, numG).setValues([out]).setBackgrounds([colors]);  
}  
  
/* ============================================================  
 * 7. ▶️ אלגוריתם ראשי  
 * ============================================================ */  
const EMERGENCY_THRESHOLD = 2;  
  
function runScheduler() { runSchedulerCore_(false); }  
function replanSchedule() { runSchedulerCore_(false); }  
function extendAndReplan() { runSchedulerCore_(true); }  
  
function runSchedulerCore_(startExtended) {  
 const mgmt = mgmt_();  
 const cfg = readSettings_(mgmt);  
 const guards = readGuards_(mgmt);  
 const numG = guards.length;  
 const ui = SpreadsheetApp.getUi();  
 if (numG === 0) { ui.alert('לא נמצאו שומרים בגיליון השומרים'); return; }  
  
 if (!(cfg.WEEK_START_DATE instanceof Date)) {  
 const resp = ui.alert('⚠️ חסר WEEK_START_DATE',  
 'לא הוגדר תאריך יום ראשון של השבוע בהגדרות.\n\n' +  
 'בלי זה המערכת לא תמשוך שומרים חיצוניים — כל בלוקי 22:00-02:00 יהפכו לפנימיים והמכסה תקפוץ.\n\n' +  
 'להמשיך בכל זאת?', ui.ButtonSet.YES_NO);  
 if (resp !== ui.Button.YES) return;  
 }  
  
 const availSheet = mgmt.getSheetByName(SHEET_AVAIL);
 const externalByDate = readExternalGuards_(mgmt);  
 const debts = readLastDebts_(mgmt, guards); // חוב חול/שבת משבוע שעבר → נקודות פתיחה  
  
 const baseMax = Number(cfg.MAX_SHIFT_LENGTH) || 4;  
 let maxShift = startExtended ? Math.min(8, baseMax + 1) : baseMax;  
 let plan;  
  
 while (true) {  
 const rows = readAvailabilityRows_(availSheet, cfg, numG);  
 const planCfg = Object.assign({}, cfg, { MAX_SHIFT_LENGTH: maxShift });  
 plan = planSchedule_(planCfg, guards, rows, externalByDate, debts);  
 plan.rows = rows;  
 plan.maxShift = maxShift;  
  
 const trouble = plan.decisions.filter(d => ['חירום', 'חריגת שעות', 'ריק'].includes(d.mode)).length;  
 if (trouble <= EMERGENCY_THRESHOLD || maxShift >= 8) break;  
  
 const resp = ui.alert('⚠️ ' + trouble + ' משמרות חירום/חריגה',  
 'נוצרו ' + trouble + ' משמרות בעייתיות בפריסה הנוכחית (משמרת עד ' + maxShift + ' שעות).\n\n' +  
 'אפשר להאריך לכולם את המשמרת ל-' + (maxShift + 1) + ' שעות ולפרוס מחדש — כך העומס מתחלק בשוויון ' +  
 'במקום ליפול על מעט משמרות.\n\nלהאריך ולפרוס מחדש?', ui.ButtonSet.YES_NO);  
 if (resp !== ui.Button.YES) break;  
 maxShift++;  
 }  
  
 writeScheduleResult_(mgmt, guards, plan);  
}  
  
function planSchedule_(cfg, guards, rows, externalByDate, debts) {  
 const numG = guards.length;  
 rows.forEach(r => {  
 if (r.external) {  
 const ext = lookupExternal_(externalByDate, cfg.WEEK_START_DATE, r.dayIndex);  
 r.extName = ext && ext.late ? ext.late : '';  
 r.covered = !!r.extName;  
 }  
 });  
  
 const futureManualHours = guards.map(() => 0);  
 rows.forEach(r => {  
 if (r.manual) { const g = guards.indexOf(r.manual); if (g >= 0) futureManualHours[g] += r.hours; }  
 });  
  
 const internalRows = rows.filter(r => (!r.external || !r.covered) && !r.statusExternal);  
 const hardCap = Math.ceil(internalRows.reduce((s, r) => s + r.hours, 0) / numG);  
  
 // חוב היסטורי כנקודות פתיחה: חוב חול → weekdayPoints, חוב שבת → shabbatPoints.  
 // שומר שחייב (חוב חיובי = שמר פחות מהממוצע) מתחיל עם פחות נקודות → יקבל יותר משמרות.  
 const d = debts || {};  
 const wd = d.weekday || guards.map(() => 0);  
 const sd = d.shabbat || guards.map(() => 0);  
 const st = guards.map((_, g) => ({  
 hours: 0,  
 weekdayPoints: -(wd[g] || 0), // חוב חיובי → נקודות פתיחה נמוכות → עדיפות לשיבוץ  
 shabbatPoints: -(sd[g] || 0),  
 lastEnd: -999, lastNight: false, run: 0,  
 }));  
 const snap = () => st.map(s => ({ ...s }));  
 const decisions = [];  
 const forbid = rows.map(() => new Set());  
 let safety = 0, backtracksLeft = 300, i = 0;  
  
 while (i < rows.length) {  
 if (++safety > 200000) break;  
 const r = rows[i];  
  
 if (r.external && r.covered) {  
 decisions.push({ rowIdx: i, guard: -2, name: r.extName, mode: 'חיצוני', stateBefore: snap() });  
 const gx = guards.indexOf(r.extName);  
 if (gx >= 0) applyExternalRest_(st[gx], r);  
 i++; continue;  
 }  
 if (r.statusExternal) {  
 decisions.push({ rowIdx: i, guard: -2, name: 'מאויש חיצונית', mode: 'חיצוני', stateBefore: snap() });  
 i++; continue;  
 }  
  
 // עמדת לילה כפולה: בבלוק לילה פנימי (02-04 / 04-06), בודקים אם יש שותף  
 // פנימי שמכסה אותו לפי הטווח שהוגדר. אם כן — השותף תופס את הבלוק (קרדיט מלא)  
 // והבלוק נחשב מאויש. אם לא — הבלוק הופך לפנימי רגיל שהמנוע משבץ.  
 let partnerName = '', partnerIdx = -1, partnerCovers = false;  
 if (r.night && !r.external) {  
 const ext = lookupExternal_(externalByDate, cfg.WEEK_START_DATE, r.dayIndex);  
 const hasExternal = ext && ext.late; // שותף רלוונטי רק כשיש חיצוני באותו לילה  
 partnerName = (hasExternal && ext.partner) ? ext.partner : '';  
 partnerIdx = guards.indexOf(partnerName);  
 if (partnerIdx >= 0) {  
 partnerCovers = partnerCoversBlock_(r.label, ext.partnerRange);  
 // השותף חסום מלהיות משובץ כפנימי רגיל בבלוק שהוא מכסה (אילוץ קשיח)  
 if (partnerCovers) r.marks[partnerIdx] = MARK_BLOCK;  
 }  
 }  
  
 // אם השותף מכסה את הבלוק הזה — הוא תופס אותו, קרדיט מלא, אין שיבוץ פנימי  
 if (partnerCovers && partnerIdx >= 0) {  
 decisions.push({ rowIdx: i, guard: -3, name: partnerName, mode: 'שותף', partner: partnerName, stateBefore: snap() });  
 applyPartnerShift_(st[partnerIdx], r);  
 i++; continue;  
 }  
  
 if (r.manual) {  
 const g = guards.indexOf(r.manual);  
 decisions.push({ rowIdx: i, guard: g, mode: 'ידני', partner: '', stateBefore: snap() });  
 if (g >= 0) { applyAssign_(st, g, r); futureManualHours[g] -= r.hours; }  
 i++; continue;  
 }  
  
 let cands = feasible_(guards, st, r, i, rows, decisions, cfg, hardCap, futureManualHours)  
 .filter(g => !forbid[i].has(g));  
  
 if (cands.length === 0) {  
 const anyAvailable = guards.some((_, g) => r.marks[g] !== MARK_BLOCK);  
 if (anyAvailable && backtracksLeft > 0 &&  
 tryBacktrack_(decisions, rows, st, forbid, cfg, futureManualHours)) {  
 backtracksLeft--;  
 i = nextRowIndex_(decisions);  
 continue;  
 }  
 const emerg = guards.map((_, g) => g).filter(g => !isBlocked_(r.marks[g]));  
 if (emerg.length > 0) {  
 const ptsOf = s => r.isShabbat ? s.shabbatPoints : s.weekdayPoints;  
 const g = emerg.sort((a, b) =>  
 ((st[a].hours + futureManualHours[a]) - (st[b].hours + futureManualHours[b])) ||  
 (ptsOf(st[a]) - ptsOf(st[b])) || (Math.random() - 0.5))[0];  
 decisions.push({ rowIdx: i, guard: g, mode: 'חירום', partner: '', stateBefore: snap() });  
 applyAssign_(st, g, r);  
 } else {  
 decisions.push({ rowIdx: i, guard: -1, mode: 'ריק', partner: '', stateBefore: snap() });  
 }  
 i++; continue;  
 }  
  
 const g = pickBest_(cands, st, r, hardCap, cfg, guards, futureManualHours);  
 const assignMode = (ratingToCost_(r.marks[g]) >= 4) ? 'רגיל (?)' : 'רגיל';  
 decisions.push({ rowIdx: i, guard: g, mode: assignMode, partner: '', stateBefore: snap() });  
 applyAssign_(st, g, r);  
 i++;  
 }  
  
 rebalanceSchedule_(decisions, rows, guards, st, cfg, hardCap, externalByDate);  
 return { decisions, st, hardCap };  
}  
  
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
 writeHistory_(mgmt, guards, st);  
 const pubUrl = publishSchedule_(mgmt);  
  
 let msg = '✅ השיבוץ הושלם! (מכסה: ' + hardCap + ' שעות לשומר';  
 if (maxShift) msg += ', משמרת עד ' + maxShift + ' שעות';  
 msg += ')\n\n' + guards.map((n, g) =>  
 n + ': ' + st[g].hours + ' שעות, ' + Math.round(st[g].weekdayPoints + st[g].shabbatPoints) + ' נק׳ קושי').join('\n');  
 msg += '\n\n💡 אם הפריסה לא טובה — תפריט 🛡️ ← "🔄 פרוס מחדש" לפריסה חלופית.';  
 if (alerts.length) msg += '\n\n' + alerts.join('\n');  
 if (pubUrl) msg += '\n\n🔗 קובץ הפרסום לשומרים:\n' + pubUrl;  
 SpreadsheetApp.getUi().alert(msg);  
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
  
function applyExternalRest_(s, r) {  
 s.lastEnd = r.startAbs + r.hours;  
 s.lastNight = true;  
 s.run = 0;  
}  
  
// שותף פנימי ששומר בעמדת הסיור/לילה: מקבל קרדיט מלא (שעות + נקודות),  
// ונחסם מפנימי אחרי (מנוחת לילה). בניגוד ל-applyExternalRest_ שרק חוסם.  
function applyPartnerShift_(s, r) {  
 s.hours += r.hours;  
 if (r.isShabbat) s.shabbatPoints += r.weight * r.hours;  
 else s.weekdayPoints += r.weight * r.hours;  
 s.lastEnd = r.startAbs + r.hours;  
 s.lastNight = true;  
 s.run = 0;  
}  
  
function feasible_(guards, st, r, i, rows, decisions, cfg, cap, futureManualHours) {  
 const prev = lastInternalDecision_(decisions);  
 if (prev && prev.guard >= 0) {  
 const pg = prev.guard, ps = st[pg];  
 if (ps.lastEnd === r.startAbs && ps.run < cfg.MIN_SHIFT_LENGTH &&  
 !isBlocked_(r.marks[pg]) && ps.run + r.hours <= cfg.MAX_SHIFT_LENGTH) {  
 return [pg];  
 }  
 }  
 return guards.map((_, g) => g).filter(g => {  
 if (isBlocked_(r.marks[g])) return false;  
 const s = st[g];  
 if (s.hours + r.hours + futureManualHours[g] > cap) return false;  
  
 if (s.lastEnd === r.startAbs && s.run > 0) {  
 return s.run + r.hours <= cfg.MAX_SHIFT_LENGTH;  
 }  
 const rest = r.startAbs - s.lastEnd;  
 const need = s.lastNight ? cfg.NIGHT_REST_TIME : cfg.MIN_REST_TIME;  
 if (rest < need) return false;  
 if (r.hours < cfg.MIN_SHIFT_LENGTH) {  
 const nx = rows[i + 1];  
 if (!nx || nx.statusExternal || nx.startAbs !== r.startAbs + r.hours) return false;  
 if (nx.marks[g] === MARK_BLOCK) return false;  
 if (r.hours + nx.hours > cfg.MAX_SHIFT_LENGTH) return false;  
 if (s.hours + r.hours + nx.hours + futureManualHours[g] > cap) return false;  
 }  
 return true;  
 });  
}  
  
/* ============================================================  
 * ⚖️ שלב איזון — פיזור עומס מהעמוס לפנוי (משמרות שלמות בלבד)  
 * הערה: משמרות שבת נעולות ולא ניתנות להעברה — איזון השבת מתבצע בשבוע הבא.  
 * ============================================================ */  
function rebalanceSchedule_(decisions, rows, guards, st, cfg, cap, externalByDate) {  
 const weekStart = cfg.WEEK_START_DATE;  
 const extBusy = guards.map(() => []);  
 rows.forEach(r => {  
 if (!r.night) return;  
 const ext = lookupExternal_(externalByDate, weekStart, r.dayIndex);  
 if (!ext) return;  
 // חיצוני (late): חוסם בבלוקי 22-02. שותף: חוסם רק בבלוקים שבטווח שלו.  
 const lateG = guards.indexOf(String(ext.late || '').trim());  
 if (lateG >= 0 && r.external) {  
 extBusy[lateG].push({ start: r.startAbs, end: r.startAbs + r.hours + cfg.NIGHT_REST_TIME });  
 }  
 const partnerG = guards.indexOf(String(ext.partner || '').trim());  
 if (partnerG >= 0 && !r.external && ext.late &&  
 partnerCoversBlock_(r.label, ext.partnerRange)) {  
 extBusy[partnerG].push({ start: r.startAbs, end: r.startAbs + r.hours + cfg.NIGHT_REST_TIME });  
 }  
 });  
  
 const intervalsOf = g => decisions.filter(d => d.guard === g).map(d => {  
 const r = rows[d.rowIdx];  
 return { rowIdx: d.rowIdx, start: r.startAbs, end: r.startAbs + r.hours, night: r.night };  
 }).sort((a, b) => a.start - b.start);  
  
 const segmentsOf = g => {  
 const segs = [];  
 intervalsOf(g).forEach(x => {  
 const last = segs[segs.length - 1];  
 if (last && last.end === x.start) { last.end = x.end; last.rowIdxs.push(x.rowIdx); last.night = last.night || x.night; }  
 else segs.push({ start: x.start, end: x.end, rowIdxs: [x.rowIdx], night: x.night });  
 });  
 return segs;  
 };  
  
 const canTakeSeg = (g, seg) => {  
 const segHours = seg.end - seg.start;  
 if (st[g].hours + segHours > cap) return false;  
 for (const ri of seg.rowIdxs) if (isBlocked_(rows[ri].marks[g])) return false;  
 for (const w of extBusy[g]) if (seg.start < w.end && seg.end > w.start) return false;  
 const iv = intervalsOf(g).concat([{ start: seg.start, end: seg.end, night: seg.night }]).sort((a, b) => a.start - b.start);  
 for (let k = 0; k + 1 < iv.length; k++) if (iv[k + 1].start < iv[k].end) return false;  
 const merged = [];  
 iv.forEach(x => {  
 const last = merged[merged.length - 1];  
 if (last && last.end === x.start) { last.end = x.end; last.night = last.night || x.night; }  
 else merged.push({ ...x });  
 });  
 for (let k = 0; k < merged.length; k++) {  
 const len = merged[k].end - merged[k].start;  
 if (len > cfg.MAX_SHIFT_LENGTH || len < cfg.MIN_SHIFT_LENGTH) return false;  
 if (k + 1 < merged.length) {  
 const gap = merged[k + 1].start - merged[k].end;  
 const need = merged[k].night ? cfg.NIGHT_REST_TIME : cfg.MIN_REST_TIME;  
 if (gap < need) return false;  
 }  
 }  
 return true;  
 };  
  
 const spreadCap = Number(cfg.MAX_WEEKDAY_DEBT_HOURS) || 2; // CAP הפרש שעות שבועי  
 let rounds = 0;  
 while (rounds++ < 500) {  
 const order = guards.map((_, g) => g).sort((a, b) => st[b].hours - st[a].hours);  
 const donor = order[0], receiver = order[order.length - 1];  
 if (st[donor].hours - st[receiver].hours <= spreadCap) break;  
 const segs = segmentsOf(donor).sort((a, b) => (a.end - a.start) - (b.end - b.start));  
 let moved = false;  
 for (const seg of segs) {  
 const segHours = seg.end - seg.start;  
 if (st[donor].hours - segHours < st[receiver].hours + segHours - spreadCap) continue;  
 if (seg.rowIdxs.some(ri => decisions.find(x => x.rowIdx === ri).mode === 'ידני')) continue;  
 // משמרות שבת נעולות — לא ניתנות להעברה בשלב האיזון (איזון השבת מתבצע בשבוע הבא).  
 if (seg.rowIdxs.some(ri => rows[ri].isShabbat)) continue;  
 if (canTakeSeg(receiver, seg)) {  
 seg.rowIdxs.forEach(ri => {  
 const d = decisions.find(x => x.rowIdx === ri), r = rows[ri];  
 st[donor].hours -= r.hours;  
 st[receiver].hours += r.hours;  
 // סגמנטים אלו הם ימי חול בלבד (שבת נחסמה למעלה) → עדכון weekdayPoints.  
 st[donor].weekdayPoints -= r.weight * r.hours;  
 st[receiver].weekdayPoints += r.weight * r.hours;  
 d.guard = receiver; d.mode = 'רגיל';  
 });  
 moved = true; break;  
 }  
 }  
 if (!moved) break;  
 }  
}  
  
function pickBest_(cands, st, r, cap, cfg, guards, futureManualHours) {  
 // בחירת זרם הנקודות לפי סוג הבלוק: בלוק שבת מאוזן מול shabbatPoints,  
 // בלוק חול מול weekdayPoints. כך נקודות שבת לא משפיעות על איזון ימי החול.  
 const ptsOf = s => r.isShabbat ? s.shabbatPoints : s.weekdayPoints;  
 const avg = st.reduce((sum, x) => sum + ptsOf(x), 0) / guards.length;  
 let best = cands[0], bestScore = -Infinity;  
 cands.forEach(g => {  
 let sc = score_(st[g], r, avg, cap, cfg, futureManualHours[g]);  
 // קנס לפי דירוג הזמינות 1–5: דירוג גבוה (קשה) → ציון נמוך יותר.  
 const cost = ratingToCost_(r.marks[g]);  
 if (isFinite(cost)) {  
 const frac = (cost - RATING_MIN) / (RATING_MAX - RATING_MIN); // 0..1  
 sc -= 60 * r.weight * frac;  
 }  
 sc += (Math.random() - 0.5) * 0.5;  
 if (sc > bestScore) { bestScore = sc; best = g; }  
 });  
 return best;  
}  
  
function score_(s, r, avgPts, cap, cfg, fManualHours) {  
 let sc = 0;  
 const continuing = s.lastEnd === r.startAbs && s.run > 0;  
 if (continuing) sc += 25;  
 if (continuing && s.run < cfg.MIN_SHIFT_LENGTH) sc += 500;  
 // איזון מול הזרם המתאים: בלוק שבת מול shabbatPoints, בלוק חול מול weekdayPoints.  
 const pts = r.isShabbat ? s.shabbatPoints : s.weekdayPoints;  
 sc -= (pts - avgPts) * 4;  
 sc += (cap - (s.hours + fManualHours)) * 1.5;  
 return sc;  
}  
  
function lastInternalDecision_(decisions) {  
 if (decisions.length === 0) return null;  
 const d = decisions[decisions.length - 1];  
 return (d.mode === 'חיצוני' || d.mode === 'שותף') ? null : d;  
}  
  
function nextRowIndex_(decisions) {  
 return decisions.length === 0 ? 0 : decisions[decisions.length - 1].rowIdx + 1;  
}  
  
function tryBacktrack_(decisions, rows, st, forbid, cfg, futureManualHours) {  
 let undone = 0;  
 while (decisions.length > 0 && undone < cfg.MAX_BACKTRACK_HOURS) {  
 const d = decisions[decisions.length - 1];  
 if (d.mode === 'ידני' || d.mode === 'חיצוני' || d.mode === 'שותף') break;  
 decisions.pop();  
 d.stateBefore.forEach((s, g) => Object.assign(st[g], s));  
 const r = rows[d.rowIdx];  
 undone += r.hours;  
 if (d.guard >= 0) {  
 forbid[d.rowIdx].add(d.guard);  
 for (let k = d.rowIdx + 1; k < forbid.length; k++) forbid[k].clear();  
 return true;  
 }  
 }  
 return false;  
}  
  
/* ============================================================  
 * 8. קריאה וכתיבה  
 * ============================================================ */  
function readSettings_(ss) {  
 const sh = ss.getSheetByName(SHEET_SETTINGS);  
 const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();  
 const cfg = {};  
 vals.forEach(r => { if (r[0]) cfg[r[0]] = r[1]; });  
 const w = sh.getRange(2, 5, 10, 2).getValues();  
 cfg.weights = {};  
 w.forEach(r => { if (r[0]) cfg.weights[r[0]] = Number(r[1]) || 1; });  
 return cfg;  
}  
  
function setSetting_(ss, key, value) {  
 const sh = ss.getSheetByName(SHEET_SETTINGS);  
 const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();  
 for (let i = 0; i < vals.length; i++) {  
 if (vals[i][0] === key) { sh.getRange(2 + i, 2).setValue(value); return; }  
 }  
 sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[key, value]]);  
}  
  
function getSetting_(key) {  
 return readSettings_(mgmt_())[key];  
}  
  
function readGuards_(ss) {  
 const sh = ss.getSheetByName(SHEET_GUARDS);  
 const lastRow = sh.getLastRow();  
 if (lastRow < 2) return [];  
 return sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]).trim()).filter(Boolean);  
}  
  
function readAvailabilityRows_(sh, cfg, numGuards) {  
 const blocks = buildBlocks_();  
 const n = DAYS.length * blocks.length;  
 const totalCols = 4 + numGuards + 1;  
 const vals = sh.getRange(3, 1, n, totalCols).getValues();  
 const rows = [];  
 let abs = 0;  
 vals.forEach((v, idx) => {  
 const b = blocks[idx % blocks.length];  
 const marks = [];  
 for (let g = 0; g < numGuards; g++) {  
 marks.push(String(v[4 + g]).trim().toUpperCase() || MARK_FREE);  
 }  
 const blockStartHour = parseInt(b.label.slice(0, 2), 10);  
 rows.push({  
 sheetRow: 3 + idx,  
 day: v[0], dayIndex: Math.floor(idx / blocks.length),  
 label: v[1], hours: Number(v[2]),  
 statusExternal: v[3] === 'מאויש חיצונית',  
 external: b.external, night: b.night,  
 isShabbat: isShabbat_(v[0], blockStartHour, cfg), // דגל שבת — מפריד ניקוד חול/שבת  
 marks: marks,  
 manual: String(v[4 + numGuards]).trim(),  
 weight: blockWeight_(v[0], b, cfg.weights, cfg, marks),  
 startAbs: abs,  
 });  
 abs += Number(v[2]);  
 });  
 return rows;  
}  
  
function externalSource_(mgmt) {  
 const cfg = readSettings_(mgmt);  
 if (cfg.EXTERNAL_SPREADSHEET_ID) {  
 try {  
 const ext = SpreadsheetApp.openById(cfg.EXTERNAL_SPREADSHEET_ID);  
 return ext.getSheetByName(SHEET_EXTERNAL) || ext.getSheets()[0];  
 } catch (e) { /* נפילה חזרה למקומי */ }  
 }  
 return mgmt.getSheetByName(SHEET_EXTERNAL);  
}  
  
function readExternalGuards_(ss) {  
 const sh = externalSource_(ss);  
 if (!sh || sh.getLastRow() < 2) return {};  
 const lastCol = Math.max(4, sh.getLastColumn());  
 const vals = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();  
 const map = {};  
 vals.forEach(r => {  
 if (r[0] instanceof Date) {  
 map[dateKey_(r[0])] = {  
 late: String(r[1] || '').trim(),  
 partner: String(r[2] || '').trim(),  
 partnerRange: String(r[3] || '').trim(), // טווח שותף: '02:00-06:00' / '04:00-06:00' / ריק=מלא  
 };  
 }  
 });  
 return map;  
}  
  
function lookupExternal_(map, weekStart, dayIndex) {  
 if (!(weekStart instanceof Date)) return null;  
 const d = new Date(weekStart);  
 const dayOffset = (dayIndex - weekStart.getDay() + 7) % 7;
  d.setDate(d.getDate() + dayOffset);  
 return map[dateKey_(d)] || null;  
}  
  
function dateKey_(d) {  
 return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();  
}  
  
function readLastDebts_(ss, guards) {  
 // מחזיר { weekday: [...], shabbat: [...] } — חוב מפוצל מהשורה האחרונה בהיסטוריה.  
 // תומך בפורמט הישן (עמודת "— חוב" אחת) ע"י מיפויו לחוב חול, חוב שבת = 0.  
 const empty = { weekday: guards.map(() => 0), shabbat: guards.map(() => 0) };  
 const sh = ss.getSheetByName(SHEET_HISTORY);  
 if (!sh || sh.getLastRow() < 2) return empty;  
 const lastCol = sh.getLastColumn();  
 const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];  
 const lastRow = sh.getRange(sh.getLastRow(), 1, 1, lastCol).getValues()[0];  
 const wdCol = {}, shCol = {}, legacyCol = {};  
 header.forEach((h, c) => {  
 const s = String(h);  
 if (s.indexOf(' — חוב חול') >= 0) wdCol[s.replace(' — חוב חול', '').trim()] = c;  
 else if (s.indexOf(' — חוב שבת') >= 0) shCol[s.replace(' — חוב שבת', '').trim()] = c;  
 else if (s.indexOf(' — חוב') >= 0) legacyCol[s.replace(' — חוב', '').trim()] = c;  
 });  
 const pick = (col, g) => (col[g] !== undefined ? (Number(lastRow[col[g]]) || 0) : 0);  
 return {  
 weekday: guards.map(g => (wdCol[g] !== undefined ? pick(wdCol, g) : pick(legacyCol, g))),  
 shabbat: guards.map(g => pick(shCol, g)),  
 };  
}  
  
function writeHistory_(ss, guards, st) {  
 const sh = ss.getSheetByName(SHEET_HISTORY);  
 if (!sh) return;  
 // שתי עמודות חוב נפרדות לכל שומר: חוב חול וחוב שבת.  
 // חוב = ממוצע הזרם פחות נקודות השומר באותו זרם (חיובי = שמר פחות → זכאי ליותר).  
 const head = ['תאריך ריצה']  
 .concat(guards.map(n => n + ' — נק׳ חול'))  
 .concat(guards.map(n => n + ' — נק׳ שבת'))  
 .concat(guards.map(n => n + ' — חוב חול'))  
 .concat(guards.map(n => n + ' — חוב שבת'));  
 sh.getRange(1, 1, 1, head.length).setValues([head]);  
 styleHeader_(sh.getRange(1, 1, 1, head.length));  
  
 const avgWd = st.reduce((s, x) => s + x.weekdayPoints, 0) / guards.length;  
 const avgSh = st.reduce((s, x) => s + x.shabbatPoints, 0) / guards.length;  
 const r1 = v => Math.round(v * 10) / 10;  
 const row = [new Date()]  
 .concat(st.map(s => r1(s.weekdayPoints)))  
 .concat(st.map(s => r1(s.shabbatPoints)))  
 .concat(st.map(s => r1(avgWd - s.weekdayPoints)))  
 .concat(st.map(s => r1(avgSh - s.shabbatPoints)));  
 sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);  
}  
  
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
 dayDecisions.forEach(d => {  
 const r = rows[d.rowIdx];  
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
 else if (d.mode === 'רגיל (?)') { status = '? עדיפות שנייה'; cA = '#fff2cc'; }  
 else if (r.night) { status = '🌙 לילה'; cA = '#cfe2f3'; }  
 else { status = 'תקין'; }  
 }  
 const parts = r.label.split('-');  
 cells.push({ from: parts[0], to: parts[1], posA, posB, status, cA, cB });  
 });  
  
 const merged = [];  
 cells.forEach(c => {  
 const last = merged[merged.length - 1];  
 if (last && last.posA === c.posA && last.posB === c.posB && last.status === c.status) {  
 last.to = c.to;  
 } else {  
 merged.push({ ...c });  
 }  
 });  
  
 const out = merged.map(c => [c.from + '-' + c.to, c.posA, c.posB, c.status]);  
 const bg = merged.map(c => ['#ffffff', c.cA, c.cB, '#ffffff']);  
 sh.getRange(row, 1, out.length, 4).setValues(out).setBackgrounds(bg).setHorizontalAlignment('center');  
 row += out.length;  
  
 sh.getRange(dayStart - 1, 1, out.length + 1, 4)  
 .setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.SOLID);  
 row++;  
 });  
  
 sh.getRange(row, 1).setValue('📊 סיכום').setFontWeight('bold');  
 row++;  
 sh.getRange(row, 1, 1, 3).setValues([['שומר', 'שעות', 'נק׳ קושי']]);  
 styleHeader_(sh.getRange(row, 1, 1, 3));  
 row++;  
 guards.forEach((n, g) => {  
 sh.getRange(row + g, 1, 1, 3).setValues([[n, st[g].hours, Math.round(st[g].weekdayPoints + st[g].shabbatPoints)]]);  
 });  
  
 sh.setColumnWidth(1, 115).setColumnWidth(2, 155).setColumnWidth(3, 175).setColumnWidth(4, 140);  
 sh.setFrozenRows(1);  
  
}  
  
function updateScheduleSummary_(sched, guards, dPoints, dHours) {  
 const colA = sched.getRange(1, 1, sched.getLastRow(), 1).getValues();  
 let sumRow = -1;  
 for (let k = 0; k < colA.length; k++) {  
 if (String(colA[k][0]) === 'שומר' && k + 1 < colA.length) { sumRow = k + 2; break; }  
 }  
 if (sumRow < 0) return;  
 for (let g = 0; g < guards.length; g++) {  
 const cell = sched.getRange(sumRow + g, 1, 1, 3);  
 const vals = cell.getValues()[0];  
 if (vals[0] === guards[g]) {  
 vals[1] = Number(vals[1]) + (dHours[guards[g]] || 0);  
 vals[2] = Number(vals[2]) + (dPoints[guards[g]] || 0);  
 cell.setValues([vals]);  
 }  
 }  
}  
  
function adjustLastHistory_(ss, guards, dPoints) {  
 const sh = ss.getSheetByName(SHEET_HISTORY);  
 if (!sh || sh.getLastRow() < 2) return;  
 const r = sh.getLastRow();  
 const G = guards.length;  
 // מבנה: [תאריך] [נק׳ חול ×G] [נק׳ שבת ×G] [חוב חול ×G] [חוב שבת ×G]  
 // תיקון בלתם הוא של ימי חול → מתווסף לנק׳ חול וחוב החול מחושב מחדש.  
 const wdPts = sh.getRange(r, 2, 1, G).getValues()[0];  
 const newWd = wdPts.map((p, g) => Math.round((Number(p) + (dPoints[guards[g]] || 0)) * 10) / 10);  
 const avg = newWd.reduce((a, b) => a + b, 0) / G;  
 sh.getRange(r, 2, 1, G).setValues([newWd]); // נק׳ חול  
 sh.getRange(r, 2 + 2 * G, 1, G) // חוב חול  
 .setValues([newWd.map(p => Math.round((avg - p) * 10) / 10)]);  
}  
  
function resetAvailability() {  
 const cfg = readSettings_(mgmt_());  
 const guards = readGuards_(mgmt_());  
 const numG = guards.length;  
 const front = mgmt_();
 const sh = front.getSheetByName(SHEET_AVAIL);  
 const blocks = buildBlocks_();  
 const ui = SpreadsheetApp.getUi();  
 if (ui.alert('איפוס זמינות', 'לאפס את כל הסימונים לשבוע חדש?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;  
 for (let d = 0; d < DAYS.length; d++) {  
 const start = 3 + d * blocks.length;  
 // איפוס סטטוס לפי סוג הבלוק: חיצוני נשאר "שומר חיצוני", אחר → "פעיל"  
 blocks.forEach((b, bi) => {  
 sh.getRange(start + bi, 4).setValue(b.external ? 'שומר חיצוני' : 'פעיל');  
 });  
 sh.getRange(start, 5, blocks.length, numG).setValue(MARK_FREE);  
 sh.getRange(start, 5 + numG, blocks.length, 1).clearContent();  
 }  
 const qs = front.getSheetByName(SHEET_QUICK);  
 if (qs && qs.getLastRow() > 1) qs.getRange(2, 1, qs.getLastRow() - 1, 6).clearContent();  
 SpreadsheetApp.getActiveSpreadsheet().toast('הזמינות אופסה לשבוע חדש', '✅', 5);  
}  
  
function createExternalFile() {  
 const mgmt = mgmt_();  
 const cfg = readSettings_(mgmt);  
 let ext;  
 if (cfg.EXTERNAL_SPREADSHEET_ID) {  
 try { ext = SpreadsheetApp.openById(cfg.EXTERNAL_SPREADSHEET_ID); } catch (e) {}  
 }  
 if (!ext) {  
 ext = SpreadsheetApp.create('📅 שומרים חיצוניים — בית חוגלה');  
 setSetting_(mgmt, 'EXTERNAL_SPREADSHEET_ID', ext.getId());  
 }  
 let sh = ext.getSheetByName(SHEET_EXTERNAL);  
 if (!sh) { sh = ext.getSheets()[0]; sh.setName(SHEET_EXTERNAL); }  
 if (sh.getLastRow() === 0) {  
 sh.setRightToLeft(true);  
 sh.getRange(1, 1, 1, 4).setValues([['תאריך', 'שומר 22:00-02:00', 'שותף 02:00-06:00 (מהישוב)', 'טווח שותף']]);  
 styleHeader_(sh.getRange(1, 1, 1, 4));  
 sh.getRange(2, 1, 60, 1).setNumberFormat('dd/mm/yyyy');  
 const rangeRule = SpreadsheetApp.newDataValidation()  
 .requireValueInList(['02:00-06:00', '04:00-06:00'], true).setAllowInvalid(true).build();  
 sh.getRange(2, 4, 60, 1).setDataValidation(rangeRule);  
 sh.setColumnWidth(1, 110).setColumnWidths(2, 2, 200).setColumnWidth(4, 120).setFrozenRows(1);  
 }  
 SpreadsheetApp.getUi().alert(  
 '✅ קובץ השומרים החיצוניים הנפרד מוכן!\n\n' +  
 'מערכת השומרים החיצוניים תנהל את הקובץ הזה בנפרד, והשיבוץ הפנימי רק יקרא ממנו.\n\nקישור:\n' + ext.getUrl());  
}  
  
function fillExternalJune() {  
 const sh = externalSource_(mgmt_());  
 if (!sh) { SpreadsheetApp.getUi().alert('לא נמצא יעד לשומרים חיצוניים'); return; }  
 const june = [  
 [1,'עמיחי','אבוהב'],[2,'מימון','עזריאל'],[3,'ציון',''],[4,'אמיתי','נוריאל'],  
 [5,'וקסלר',''],[6,'ספיר',''],[7,'איתמר','אלישיב'],[8,'ביטאן','אבוהב'],  
 [9,'אבנים','שראל'],[10,'לרך',''],[11,'דעאל','נחמן'],[12,'שוקי חזן','אסף פישר'],  
 [13,'גרינשפן',''],[14,'עמר','קארו'],[15,'בן משה','עומר'],[16,'שימי',''],  
 [17,'מעוז','סלוק'],[18,'פנחס','סמי'],[19,'עקיבא',''],[20,'מתניה','אליחי'],  
 [21,'קדם','יוחאי'],[22,'הר זהב','שר שלום'],[23,'מויאל',''],[24,'שטרנברג','הושעיה'],  
 [25,'שמואל-זיו','רובכה'],[26,'אסף איתן','קהת'],[27,'ריאן',''],  
 [28,'','אביחי'],[29,'אליאור',''],[30,'מרגוליס','איתן גריינר'],  
 ];  
 const rows = june.map(r => [new Date(2026, 5, r[0]), r[1], r[2]]);  
 sh.getRange(2, 1, rows.length, 3).setValues(rows);  
 sh.getRange(2, 1, rows.length, 1).setNumberFormat('dd/mm/yyyy');  
 SpreadsheetApp.getActiveSpreadsheet().toast('לוח יוני נטען — ' + rows.length + ' תאריכים', '✅', 6);  
}  
  
/* ============================================================  
 * 9. 📖 לשונית הוראות הפעלה  
 * ============================================================ */  
function createInstructionsSheet() {  
 const ss = mgmt_();  
 let sheet = ss.getSheetByName(SHEET_HELP);  
 if (sheet) ss.deleteSheet(sheet);  
  
 sheet = ss.insertSheet(SHEET_HELP, 0);  
 sheet.setRightToLeft(true);  
 sheet.setHiddenGridlines(true);  
 sheet.setColumnWidth(1, 40);  
 for (let col = 2; col <= 7; col++) sheet.setColumnWidth(col, 110);  
  
 const headerRange = sheet.getRange('B2:G2');  
 headerRange.merge()  
 .setValue('🛡️ מערכת שיבוץ שמירות — פרוטוקול עבודה לאחראי')  
 .setBackground('#1c4587').setFontColor('#ffffff')  
 .setFontSize(14).setFontWeight('bold')  
 .setHorizontalAlignment('center').setVerticalAlignment('middle');  
  
 const contentRange = sheet.getRange('B4:G30');  
 contentRange.merge();  
 const instructionsText =  
 '📋 פרוטוקול עבודה שבועי לאחראי:\n\n' +  
 '1. עדכון תאריך:\n' +  
 ' היכנס ללשונית ⚙️ הגדרות ועדכן את תאריך יום ראשון של השבוע הבא (בשדה WEEK_START_DATE).\n\n' +  
 '2. טעינת שומרים חיצוניים:\n' +  
 ' ודא שלשונית 📅 שומרים חיצוניים מעודכנת (אפשר דרך התפריט: טען לוח חיצוניים).\n\n' +  
 '3. איפוס זמינות:\n' +  
 ' לחץ בתפריט 🛡️ שיבוץ שמירות ← 🔄 אפס זמינות לשבוע חדש.\n\n' +  
 '4. איסוף זמינויות:\n' +  
 ' חכה שהשומרים ימלאו את ה-1-5 / X שלהם בקובץ הזמינות (ידנית או דרך ⚡ מילוי מהיר).\n\n' +  
 '5. שיבוצים ידניים (אופציונלי):\n' +  
 ' אם יש אילוץ מיוחד, שבץ אותו בעמודה 🔒 שיבוץ ידני בלשונית הזמינות לפני ההרצה.\n\n' +  
 '6. הפעלת האלגוריתם:\n' +  
 ' לחץ בתפריט 🛡️ שיבוץ שמירות ← ▶️ הרץ שיבוץ.\n\n' +  
 '7. בדיקת התוצאה:\n' +  
 ' הלוח המוכן יופיע בלשונית 🗓️ לוח שמירות, עם סיכום שעות ונקודות בתחתית.\n\n' +  
 '🔁 תיקון בלתם (החלפת שומר באמצע השבוע):\n' +  
 ' אם שומר לא הגיע ואחר החליף אותו — היכנס ללשונית 🔁 תיקוני בלתם,\n' +  
 ' רשום: יום + בלוק + שם המחליף, ואז לחץ בתפריט 🛡️ ← 🔁 החלף שומר במשמרת.\n' +  
 ' הנקודות והשעות יעברו אוטומטית מהמקורי למחליף, והתא בלוח יסומן "(בלתם)".\n' +  
 ' כך המחליף מקבל קרדיט מלא וההיסטוריה לשבוע הבא מתעדכנת בהתאם.';  
  
 contentRange.setValue(instructionsText)  
 .setBackground('#f8f9fa').setFontSize(11)  
 .setWrap(true)  
 .setHorizontalAlignment('right').setVerticalAlignment('top')  
 .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);  
  
 ss.toast('לשונית ההוראות נוצרה', '✅', 5);  
}  
  
/* ============================================================  
 * 📢 פרסום לשומרים  
 * ============================================================ */  
function publishSchedule_(mgmt) {  
 const cfg = readSettings_(mgmt);  
 let pub;  
 if (cfg.PUBLISH_SPREADSHEET_ID) {  
 try { pub = SpreadsheetApp.openById(cfg.PUBLISH_SPREADSHEET_ID); } catch (e) {}  
 }  
 if (!pub) {  
 pub = SpreadsheetApp.create('🗓️ לוח שמירות — בית חוגלה (לשומרים)');  
 setSetting_(mgmt, 'PUBLISH_SPREADSHEET_ID', pub.getId());  
 }  
  
 const ws = cfg.WEEK_START_DATE instanceof Date ? new Date(cfg.WEEK_START_DATE) : new Date();  
 const we = new Date(ws); we.setDate(we.getDate() + 6);  
 const fmt = d => d.getDate() + '.' + (d.getMonth() + 1);  
 const tabName = '📅 ' + fmt(ws) + '-' + fmt(we);  
  
 const existing = pub.getSheetByName(tabName);  
 if (existing) pub.deleteSheet(existing);  
  
 const src = mgmt.getSheetByName(SHEET_SCHEDULE);  
 const copied = src.copyTo(pub);  
 copied.setName(tabName);  
 pub.setActiveSheet(copied);  
 pub.moveActiveSheet(1);  
  
 ['Sheet1', 'גיליון1'].forEach(n => {  
 const s = pub.getSheetByName(n);  
 if (s && pub.getSheets().length > 1) pub.deleteSheet(s);  
 });  
  
 return pub.getUrl();  
}  
  
function mgmt_() {  
 const active = SpreadsheetApp.getActiveSpreadsheet();  
 if (active && active.getSheetByName(SHEET_SETTINGS)) return active;  
 const id = PropertiesService.getScriptProperties().getProperty('MGMT_ID');  
 return SpreadsheetApp.openById(id);  
}  
  
function getCleanSheet_(ss, name) {  
 let sh = ss.getSheetByName(name);  
 if (sh) { sh.clear(); sh.clearConditionalFormatRules(); }  
 else { sh = ss.insertSheet(name); }  
 return sh;  
}  
  
function styleHeader_(range) {  
 range.setBackground('#1c4587').setFontColor('#ffffff')  
      .setFontWeight('bold').setHorizontalAlignment('center');  
}

function doGet(e) {
  const guardName = (e && e.parameter && e.parameter.guard) ? e.parameter.guard : "אורח";
  const html = HtmlService.createTemplateFromFile("Index");
  html.guardName = guardName;
  return html.evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function saveGuardPreferences(payload) {
  try {
    if (!payload || !payload.guard) throw new Error("שם השומר חסר");
    const ss = mgmt_();
    const sh = ss.getSheetByName(SHEET_AVAIL);
    if (!sh) throw new Error("לשונית '" + SHEET_AVAIL + "' לא נמצאה — הרץ תפריט > יצירת לשונית זמינות");

    const lastCol = sh.getLastColumn();
    const headerRow = sh.getRange(1, 5, 1, Math.max(1, lastCol - 4)).getValues()[0];
    const guardCol = headerRow.findIndex(v => String(v).trim() === String(payload.guard).trim());
    if (guardCol < 0) throw new Error("שומר '" + payload.guard + "' לא נמצא בטבלה");
    const sheetCol = 5 + guardCol;

    const blocks = buildBlocks_();
    const days = payload.days || {};

    function getMarkForBlock(di, blockLabel) {
      const bStart = parseInt(blockLabel.slice(0, 2), 10);
      const bEnd = parseInt(blockLabel.slice(6, 8), 10); // 0 = חצות (לולאה while תטפל נכון)
      const dayData = days[String(di)];
      if (!dayData) return MARK_FREE;
      const allSlots = {};
      Object.values(dayData).forEach(bg => { if (bg && bg.slots) Object.assign(allSlots, bg.slots); });
      let worst = MARK_FREE;
      let h = bStart;
      while (h !== bEnd) {
        const nextH = (h + 1) % 24;
        const key = ("0" + h).slice(-2) + ":00-" + ("0" + nextH).slice(-2) + ":00";
        const m = String(allSlots[key] || MARK_FREE).trim().toUpperCase();
        if (m === MARK_BLOCK) { worst = MARK_BLOCK; break; }
        const nm = parseInt(m, 10) || 1;
        const nw = parseInt(worst, 10) || 1;
        if (nm > nw) worst = String(nm);
        h = nextH;
      }
      return worst;
    }

    blocks.forEach((b, bi) => {
      for (let di = 0; di < DAYS.length; di++) {
        sh.getRange(3 + di * blocks.length + bi, sheetCol).setValue(getMarkForBlock(di, b.label));
      }
    });

    return { success: true, message: "הזמינות נשמרה בהצלחה" };
  } catch (error) {
    Logger.log("שגיאה בשמירה: " + error.toString());
    throw new Error("לא הצלחנו לשמור: " + error.toString());
  }
}
