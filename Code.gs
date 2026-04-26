/**
 * Quran Recitation Listener — Apps Script BACKEND v5
 * ─────────────────────────────────────────────────────
 * This file is a pure JSON API. The frontend (HTML/JS) is
 * hosted on GitHub Pages where microphone works perfectly.
 *
 * HOW IT WORKS:
 *   GitHub Pages page  →  fetch(SCRIPT_URL + "?action=...")
 *   Apps Script        →  returns JSON + CORS headers
 *
 * DEPLOY SETTINGS:
 *   Execute as:   Me
 *   Who can access: Anyone (anonymous)
 *
 * REQUIRED SCOPES (appsscript.json):
 *   spreadsheets, drive, drive.file,
 *   script.external_request, script.scriptapp,
 *   userinfo.email
 */

var HARDCODED_SHEET_ID = '';   // Optional: paste your Sheet ID here
var PROP_KEY           = 'QURAN_SHEET_ID';
var CACHE_KEY_LIST     = 'QURAN_SURAH_LIST';
var CACHE_KEY_SURAH    = 'QURAN_SURAH_';
var QURAN_API          = 'https://api.alquran.cloud/v1';

// ── CORS helper ────────────────────────────────────────────
function _cors(data) {
  var output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Router — handles all GET requests ─────────────────────
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  try {
    switch (action) {
      case 'getSurahList':
        return _cors(JSON.parse(getSurahList()));

      case 'getSurahDetail':
        var num = e.parameter.number || '1';
        return _cors(JSON.parse(getSurahDetail(num)));

      case 'getSheetConfig':
        return _cors(JSON.parse(getSheetConfig()));

      case 'validateSheetId':
        return _cors(JSON.parse(validateSheetId(e.parameter.id || '')));

      case 'saveSheetId':
        return _cors(JSON.parse(saveSheetId(e.parameter.id || '')));

      case 'clearSheetId':
        return _cors(JSON.parse(clearSheetId()));

      case 'generateSheet':
        return _cors(JSON.parse(generateQuranSheet()));

      case 'saveSession':
        return _cors(JSON.parse(saveSession(e.parameter.data || '{}')));

      case 'ping':
        return _cors({ ok: true, message: 'Apps Script API is running' });

      default:
        // No action = return API info page (helpful for setup)
        return _cors({
          ok: true,
          name: 'Quran Recitation API',
          version: 5,
          actions: [
            'ping',
            'getSurahList',
            'getSurahDetail?number=1',
            'getSheetConfig',
            'validateSheetId?id=SHEET_ID',
            'saveSheetId?id=SHEET_ID',
            'clearSheetId',
            'generateSheet',
            'saveSession?data=JSON'
          ]
        });
    }
  } catch (err) {
    return _cors({ ok: false, error: err.message || String(err) });
  }
}

// ── POST handler (for saveSession with large data) ─────────
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action || '';

    if (action === 'saveSession') {
      return _cors(JSON.parse(saveSession(JSON.stringify(body.data || {}))));
    }
    return _cors({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return _cors({ ok: false, error: err.message || String(err) });
  }
}

// ══════════════════════════════════════════════════════════
//  QURAN DATA
// ══════════════════════════════════════════════════════════
function getSurahList() {
  try {
    var cache  = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY_LIST);
    if (cached) return cached;

    var resp = UrlFetchApp.fetch(QURAN_API + '/surah', {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });

    if (resp.getResponseCode() !== 200)
      return JSON.stringify({ ok: false, error: 'API ' + resp.getResponseCode(), surahs: _fallback() });

    var raw  = JSON.parse(resp.getContentText());
    var list = raw.data.map(function(s) {
      return {
        number: s.number, name: s.englishName,
        arabicName: s.name, meaning: s.englishNameTranslation,
        totalAyahs: s.numberOfAyahs, type: s.revelationType
      };
    });
    var result = JSON.stringify({ ok: true, surahs: list });
    cache.put(CACHE_KEY_LIST, result, 21600);
    return result;
  } catch(e) {
    return JSON.stringify({ ok: false, error: e.message, surahs: _fallback() });
  }
}

function getSurahDetail(number) {
  try {
    number = parseInt(number, 10);
    if (!number || number < 1 || number > 114)
      return JSON.stringify({ ok: false, error: 'Invalid surah number' });

    var cache    = CacheService.getScriptCache();
    var cacheKey = CACHE_KEY_SURAH + number;
    var cached   = cache.get(cacheKey);
    if (cached) return cached;

    var resp = UrlFetchApp.fetch(QURAN_API + '/surah/' + number + '/quran-uthmani', {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });

    if (resp.getResponseCode() !== 200)
      return JSON.stringify({ ok: false, error: 'API ' + resp.getResponseCode() });

    var raw = JSON.parse(resp.getContentText());
    var s   = raw.data;
    var result = JSON.stringify({
      ok: true, number: s.number,
      name: s.englishName, arabicName: s.name,
      totalAyahs: s.numberOfAyahs,
      ayahs: s.ayahs.map(function(a) { return { n: a.numberInSurah, ar: a.text }; })
    });
    if (result.length < 95000) cache.put(cacheKey, result, 21600);
    return result;
  } catch(e) {
    return JSON.stringify({ ok: false, error: e.message });
  }
}

function _fallback() {
  return [
    {number:1,  name:'Al-Fatiha', arabicName:'الفاتحة', totalAyahs:7  },
    {number:2,  name:'Al-Baqarah',arabicName:'البقرة',  totalAyahs:286},
    {number:18, name:'Al-Kahf',   arabicName:'الكهف',   totalAyahs:110},
    {number:36, name:'Ya-Sin',    arabicName:'يس',      totalAyahs:83 },
    {number:55, name:'Ar-Rahman', arabicName:'الرحمن',  totalAyahs:78 },
    {number:67, name:'Al-Mulk',   arabicName:'الملك',   totalAyahs:30 },
    {number:112,name:'Al-Ikhlas', arabicName:'الإخلاص', totalAyahs:4  },
    {number:113,name:'Al-Falaq',  arabicName:'الفلق',   totalAyahs:5  },
    {number:114,name:'An-Nas',    arabicName:'الناس',   totalAyahs:6  }
  ];
}

// ══════════════════════════════════════════════════════════
//  SHEET CONFIG
// ══════════════════════════════════════════════════════════
function getSheetConfig() {
  try {
    var id = PropertiesService.getScriptProperties().getProperty(PROP_KEY) || HARDCODED_SHEET_ID || '';
    if (!id) return JSON.stringify({ ok: true, id: '', title: '', url: '' });
    var ss = SpreadsheetApp.openById(id);
    return JSON.stringify({ ok: true, id: id, title: ss.getName(), url: ss.getUrl() });
  } catch(e) {
    PropertiesService.getScriptProperties().deleteProperty(PROP_KEY);
    return JSON.stringify({ ok: true, id: '', title: '', url: '', warning: 'Saved Sheet not accessible.' });
  }
}

function validateSheetId(id) {
  id = (id || '').trim();
  if (!id) return JSON.stringify({ ok: false, error: 'No ID entered.' });
  try {
    var ss = SpreadsheetApp.openById(id);
    return JSON.stringify({ ok: true, id: id, title: ss.getName(), url: ss.getUrl(),
      hasSessions: !!ss.getSheetByName('Sessions') });
  } catch(e) {
    return JSON.stringify({ ok: false, error: 'Cannot open Sheet. Check ID and sharing.' });
  }
}

function saveSheetId(id) {
  id = (id || '').trim();
  if (!id) return JSON.stringify({ ok: false, error: 'Empty ID.' });
  try {
    var ss = SpreadsheetApp.openById(id);
    PropertiesService.getScriptProperties().setProperty(PROP_KEY, id);
    return JSON.stringify({ ok: true, id: id, title: ss.getName(), url: ss.getUrl() });
  } catch(e) {
    return JSON.stringify({ ok: false, error: 'Sheet not accessible.' });
  }
}

function clearSheetId() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_KEY);
  return JSON.stringify({ ok: true });
}

// ══════════════════════════════════════════════════════════
//  GENERATE SHEET
// ══════════════════════════════════════════════════════════
function generateQuranSheet() {
  try {
    var tz    = Session.getScriptTimeZone();
    var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
    var ss, title, isNew = false;

    var savedId = PropertiesService.getScriptProperties().getProperty(PROP_KEY) || HARDCODED_SHEET_ID || '';
    if (savedId) {
      try { ss = SpreadsheetApp.openById(savedId); title = ss.getName(); }
      catch(e) { savedId = ''; }
    }
    if (!savedId) {
      title = 'Quran Recitation — ' + stamp;
      ss    = SpreadsheetApp.create(title);
      PropertiesService.getScriptProperties().setProperty(PROP_KEY, ss.getId());
      isNew = true;
    }

    var sheet = ss.getSheetByName('Sessions');
    if (!sheet) {
      sheet = isNew ? ss.getActiveSheet() : ss.insertSheet('Sessions');
      sheet.setName('Sessions');
      _buildSessionsSheet(sheet);
    }
    if (!ss.getSheetByName('Summary')) _buildSummarySheet(ss);

    SpreadsheetApp.flush();
    return JSON.stringify({ ok: true, url: ss.getUrl(), title: title, id: ss.getId() });
  } catch(err) {
    return JSON.stringify({ ok: false, error: err.message || String(err) });
  }
}

function _buildSessionsSheet(sheet) {
  var H = ['Session ID','Date','Surah Name','Surah No.',
           'Start Ayah','End Ayah','Duration (s)',
           'Accuracy (%)','Ayahs Done','Total Ayahs','Status','Notes'];
  var hR = sheet.getRange(1,1,1,H.length);
  hR.setValues([H]).setBackground('#1a472a').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  sheet.setRowHeight(1,32);

  var rows = [
    ['QRS-001','2025-01-10','Al-Fatiha', 1, 1,7,45,92,7,7,'Completed','Sample'],
    ['QRS-002','2025-01-11','Al-Ikhlas',112,1,4,30,88,4,4,'Completed','Sample'],
    ['QRS-003','2025-01-12','Al-Falaq', 113,1,5,38,75,4,5,'Partial',  'Sample'],
    ['QRS-004','2025-01-13','An-Nas',   114,1,6,42,95,6,6,'Completed','Sample'],
    ['QRS-005','2025-01-14','Ya-Sin',    36,1,10,120,85,9,10,'Partial','Sample'],
  ];
  sheet.getRange(2,1,rows.length,H.length).setValues(rows);
  for (var i=0;i<rows.length;i++)
    sheet.getRange(i+2,1,1,H.length).setBackground(i%2===0?'#f4faf6':'#ffffff');

  var acc = sheet.getRange(2,8,rows.length,1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(90)
      .setBackground('#c8e6c9').setFontColor('#1b5e20').setRanges([acc]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(70,89)
      .setBackground('#fff9c4').setFontColor('#e65100').setRanges([acc]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(70)
      .setBackground('#ffcdd2').setFontColor('#b71c1c').setRanges([acc]).build()
  ]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,H.length);
}

function _buildSummarySheet(ss) {
  var s = ss.insertSheet('Summary');
  s.getRange('A1').setValue('Quran Recitation Summary')
   .setFontSize(15).setFontWeight('bold').setFontColor('#1a472a');
  var rows=[
    ['Total Sessions',   '=COUNTA(Sessions!A2:A1000)'],
    ['Completed',        '=COUNTIF(Sessions!K2:K1000,"Completed")'],
    ['Avg Accuracy',     '=ROUND(AVERAGE(Sessions!H2:H1000),1)&"%"'],
    ['Total Time (min)', '=ROUND(SUM(Sessions!G2:G1000)/60,1)'],
    ['Surahs Practiced', '=COUNTUNIQUE(Sessions!C2:C1000)']
  ];
  s.getRange(3,1,rows.length,2).setValues(rows);
  s.getRange(3,1,rows.length,1).setFontWeight('bold').setBackground('#e8f5e9');
  s.getRange(3,2,rows.length,1).setBackground('#f1f8e9');
  s.autoResizeColumns(1,2);
}

// ══════════════════════════════════════════════════════════
//  SAVE SESSION
// ══════════════════════════════════════════════════════════
function saveSession(jsonStr) {
  try {
    var data = JSON.parse(jsonStr);
    var id   = (data.sheetId || '').trim()
               || PropertiesService.getScriptProperties().getProperty(PROP_KEY)
               || HARDCODED_SHEET_ID || '';

    if (!id) {
      var g = JSON.parse(generateQuranSheet());
      if (!g.ok) return JSON.stringify({ ok: false, error: 'Sheet create failed: ' + g.error });
      id = g.id;
    }

    var ss    = SpreadsheetApp.openById(id);
    var sheet = ss.getSheetByName('Sessions');
    if (!sheet) { _buildSessionsSheet(ss.insertSheet('Sessions')); sheet = ss.getSheetByName('Sessions'); }

    var tz  = Session.getScriptTimeZone();
    var sid = 'QRS-' + String(sheet.getLastRow()).padStart(3,'0');
    sheet.appendRow([
      sid,
      Utilities.formatDate(new Date(),tz,'yyyy-MM-dd'),
      data.surahName||'', data.surahNumber||'',
      data.startAyah||'', data.endAyah||'',
      data.duration||0,   data.accuracy||0,
      data.ayahsDone||0,  data.totalAyahs||0,
      data.status||'Completed', data.notes||''
    ]);
    SpreadsheetApp.flush();
    return JSON.stringify({ ok: true, sessionId: sid, url: ss.getUrl(), sheetId: id });
  } catch(err) {
    return JSON.stringify({ ok: false, error: err.message || String(err) });
  }
}
