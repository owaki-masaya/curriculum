// ========================================
// 週次スライド自動作成ツール
// ========================================

const CONFIG = {
  UNITS: [
    '原島ユニット', '山本ユニット', '岡本ユニット', '飯塚ユニット', '岩崎ユニット',
    '大口ユニット', '中野ユニット', '伊藤ユニット', '佐藤ユニット', '大脇ユニット'
  ],
  COLOR: {
    HEADER_BG:       '#1f4e79',
    HEADER_FG:       '#ffffff',
    SECTION_BG:      '#2e75b6',
    SECTION_FG:      '#ffffff',
    TABLE_HEAD_BG:   '#2e75b6',
    TABLE_HEAD_FG:   '#ffffff',
    ROW_ALT_BG:      '#dae3f3',
    ROW_BG:          '#ffffff',
    TEXT:            '#1f1f1f',
    SUMMARY_TEXT:    '#1f4e79',
    BORDER:          '#9dc3e6'
  },
  SHEET_NAME: '入力',
  CELLS: {
    TEMPLATE_ID:     'B3',  // テンプレートスライドのURL or ID
    DATE:            'B2',
    PREV_RATE:       'B5',
    PREV_REMAINING:  'B6',
    CURR_RATE:       'B9',
    CURR_REMAINING:  'B10',
    OTHER:           'B13',
    UNITS_START_ROW: 19
  },
  UNIT_COLS: {
    NAME:          1,  // A
    PREV_RATE:     2,  // B
    PREV_SCHED:    3,  // C
    PREV_UNSCHED:  4,  // D
    // E列 (5) はスペーサー
    CURR_RATE:     6,  // F
    CURR_SCHED:    7,  // G
    CURR_UNSCHED:  8   // H
  }
};

// ========================================
// カスタムメニュー
// ========================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 スライド作成')
    .addItem('▶ スライドを作成する', 'createWeeklySlides')
    .addSeparator()
    .addItem('📋 テンプレートを新規作成する', 'createSampleTemplate')
    .addItem('🏷 使えるタグ一覧を確認する', 'showTagList')
    .addSeparator()
    .addItem('⚙ 初期セットアップ（初回のみ）', 'setupInputSheet')
    .addToUi();
}

// ========================================
// メインエントリポイント
// ========================================
function createWeeklySlides() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'エラー',
      '「入力」シートが見つかりません。\nメニュー「スライド作成 > 初期セットアップ」を先に実行してください。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  try {
    ss.toast('スライドを作成中です...', '処理中', -1);
    const data       = readData(sheet);
    const templateId = extractIdFromUrl(sheet.getRange(CONFIG.CELLS.TEMPLATE_ID).getValue());
    const pres       = templateId
      ? fillTemplate(templateId, data)
      : buildPresentation(data);

    ss.toast('', '', 1);
    const url = pres.getUrl();
    logSlideUrl(url, data.date);

    SpreadsheetApp.getUi().alert(
      '✅ スライド作成完了！',
      'スライドが作成されました。\n下記URLをコピーしてご確認ください:\n\n' + url,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    ss.toast('', '', 1);
    SpreadsheetApp.getUi().alert(
      'エラー',
      'スライド作成中にエラーが発生しました:\n' + e.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    Logger.log(e.stack);
  }
}

// ========================================
// テンプレートモード: コピー → タグ置換
// ========================================
function fillTemplate(templateId, data) {
  const dateStr      = Utilities.formatDate(data.date, 'Asia/Tokyo', 'yyyy/MM/dd');
  const templateFile = DriveApp.getFileById(templateId);
  const newFile      = templateFile.makeCopy('水曜定例_' + dateStr);
  const pres         = SlidesApp.openById(newFile.getId());

  const tags = buildTags(data);
  Object.entries(tags).forEach(([placeholder, value]) => {
    pres.replaceAllText(placeholder, value);
  });

  pres.saveAndClose();
  return SlidesApp.openById(newFile.getId());
}

// ========================================
// タグ（プレースホルダー）定義
// ========================================
// テンプレートスライドに下記のタグを入れておくと自動置換されます
function buildTags(data) {
  const dateStr = Utilities.formatDate(data.date, 'Asia/Tokyo', 'yyyy年MM月dd日');
  const tags = {
    '{{date}}':           dateStr,
    '{{prev_rate}}':      formatRate(data.prevRate),
    '{{prev_remaining}}': String(data.prevRemaining === '' ? '-' : data.prevRemaining),
    '{{curr_rate}}':      formatRate(data.currRate),
    '{{curr_remaining}}': String(data.currRemaining === '' ? '-' : data.currRemaining),
    '{{other}}':          data.other ? String(data.other) : '（記入なし）'
  };

  // ユニット別タグ: {{u1_prev_rate}}, {{u1_prev_sched}}, {{u1_prev_unsched}} など
  // ユニット番号は UNITS 配列の順番 (1〜10)
  data.prevUnits.forEach((unit, i) => {
    const n = i + 1;
    tags[`{{u${n}_prev_rate}}`]    = formatRate(unit.rate);
    tags[`{{u${n}_prev_sched}}`]   = unit.scheduled   !== '' ? String(unit.scheduled)   : '-';
    tags[`{{u${n}_prev_unsched}}`] = unit.unscheduled !== '' ? String(unit.unscheduled) : '-';
  });
  data.currUnits.forEach((unit, i) => {
    const n = i + 1;
    tags[`{{u${n}_curr_rate}}`]    = formatRate(unit.rate);
    tags[`{{u${n}_curr_sched}}`]   = unit.scheduled   !== '' ? String(unit.scheduled)   : '-';
    tags[`{{u${n}_curr_unsched}}`] = unit.unscheduled !== '' ? String(unit.unscheduled) : '-';
  });

  return tags;
}

// ========================================
// タグ一覧をダイアログで表示
// ========================================
function showTagList() {
  const lines = [
    '■ 共通タグ',
    '{{date}}           → 対象日付（yyyy年MM月dd日）',
    '{{prev_rate}}      → 前月 在庫進捗率（例: 75.5%）',
    '{{prev_remaining}} → 前月 残件数（数値のみ）',
    '{{curr_rate}}      → 今月 在庫進捗率',
    '{{curr_remaining}} → 今月 残件数',
    '{{other}}          → その他共有事項',
    '',
    '■ ユニット別タグ（n = 1〜10）',
    '{{u1_prev_rate}}    → 原島ユニット 前月 掲出率',
    '{{u1_prev_sched}}   → 原島ユニット 前月 設定予定',
    '{{u1_prev_unsched}} → 原島ユニット 前月 アポ未調整',
    '{{u1_curr_rate}}    → 原島ユニット 今月 掲出率',
    '{{u1_curr_sched}}   → 原島ユニット 今月 設定予定',
    '{{u1_curr_unsched}} → 原島ユニット 今月 アポ未調整',
    '',
    '  ※ u2=山本, u3=岡本, u4=飯塚, u5=岩崎',
    '     u6=大口, u7=中野, u8=伊藤, u9=佐藤, u10=大脇'
  ];

  const html = HtmlService.createHtmlOutput(
    '<pre style="font-family:monospace;font-size:13px;line-height:1.6">'
    + lines.join('\n')
    + '</pre>'
  ).setWidth(520).setHeight(420);

  SpreadsheetApp.getUi().showModalDialog(html, '🏷 使えるタグ一覧');
}

// ========================================
// URL または ID から Slides ID を抽出
// ========================================
function extractIdFromUrl(val) {
  if (!val) return null;
  const s = String(val).trim();
  // Google スライドの URL 形式: .../d/{ID}/...
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (m) return m[1];
  // ID のみ（英数字 25文字以上）
  if (/^[a-zA-Z0-9_-]{25,}$/.test(s)) return s;
  return null;
}

// ========================================
// データ読み込み
// ========================================
function readData(sheet) {
  const C = CONFIG.CELLS;

  const dateVal = sheet.getRange(C.DATE).getValue();
  const date    = dateVal instanceof Date ? dateVal : new Date();

  const prevRate      = sheet.getRange(C.PREV_RATE).getValue();
  const prevRemaining = sheet.getRange(C.PREV_REMAINING).getValue();
  const currRate      = sheet.getRange(C.CURR_RATE).getValue();
  const currRemaining = sheet.getRange(C.CURR_REMAINING).getValue();
  const other         = sheet.getRange(C.OTHER).getValue();

  const prevUnits = [];
  const currUnits = [];
  const UC        = CONFIG.UNIT_COLS;

  CONFIG.UNITS.forEach((name, i) => {
    const row = C.UNITS_START_ROW + i;
    prevUnits.push({
      name,
      rate:        sheet.getRange(row, UC.PREV_RATE).getValue(),
      scheduled:   sheet.getRange(row, UC.PREV_SCHED).getValue(),
      unscheduled: sheet.getRange(row, UC.PREV_UNSCHED).getValue()
    });
    currUnits.push({
      name,
      rate:        sheet.getRange(row, UC.CURR_RATE).getValue(),
      scheduled:   sheet.getRange(row, UC.CURR_SCHED).getValue(),
      unscheduled: sheet.getRange(row, UC.CURR_UNSCHED).getValue()
    });
  });

  return { date, prevRate, prevRemaining, currRate, currRemaining, other, prevUnits, currUnits };
}

// ========================================
// テンプレートスライドを新規作成して B3 に自動設定
// ========================================
function createSampleTemplate() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'エラー',
      '先に「初期セットアップ」を実行してください。',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  try {
    ss.toast('テンプレートスライドを作成中...', '処理中', -1);

    const pres          = SlidesApp.create('【テンプレート】水曜定例');
    const defaultSlides = pres.getSlides();
    const dim           = { w: pres.getPageWidth(), h: pres.getPageHeight() };

    addTemplateTitleSlide(pres, dim);
    addInventoryTemplateSlide(pres, dim, '前月', 'prev');
    addInventoryTemplateSlide(pres, dim, '今月', 'curr');
    addOtherTemplateSlide(pres, dim);
    defaultSlides.forEach(s => s.remove());

    const url = pres.getUrl();
    sheet.getRange(CONFIG.CELLS.TEMPLATE_ID).setValue(url);

    ss.toast('', '', 1);
    SpreadsheetApp.getUi().alert(
      '✅ テンプレート作成完了！',
      'テンプレートスライドを作成し、B3 に自動設定しました。\n\n' +
      'そのまま「スライドを作成する」を実行できます。\n\n' +
      'テンプレートのデザインは自由に変更できます。\n' +
      '（{{タグ}} の文字列は削除しないでください）\n\n' +
      url,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    ss.toast('', '', 1);
    SpreadsheetApp.getUi().alert('エラー', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log(e.stack);
  }
}

// テンプレート: タイトルスライド
function addTemplateTitleSlide(pres, dim) {
  const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C     = CONFIG.COLOR;

  slide.getBackground().setSolidFill(C.HEADER_BG);
  insertRect(slide, 0, dim.h - 10, dim.w, 10, '#9dc3e6');

  const titleBox = slide.insertTextBox('水曜定例');
  titleBox.setLeft(60).setTop(dim.h * 0.22).setWidth(dim.w - 120).setHeight(100);
  applyTextStyle(titleBox, { size: 54, bold: true, color: C.HEADER_FG, align: 'CENTER' });

  const dateBox = slide.insertTextBox('{{date}}');
  dateBox.setLeft(60).setTop(dim.h * 0.58).setWidth(dim.w - 120).setHeight(50);
  applyTextStyle(dateBox, { size: 24, bold: false, color: '#9dc3e6', align: 'CENTER' });
}

// テンプレート: 前月 / 今月 在庫進捗率スライド（ネイティブテーブルにタグ配置）
function addInventoryTemplateSlide(pres, dim, label, prefix) {
  const slide     = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C         = CONFIG.COLOR;
  const PAD       = 25;
  const HEADER_H  = 62;
  const SUMMARY_H = 44;
  const TABLE_TOP = HEADER_H + SUMMARY_H + 6;
  const TABLE_W   = dim.w - PAD * 2;

  // ヘッダー帯
  insertRect(slide, 0, 0, dim.w, HEADER_H, C.HEADER_BG);
  const headerBox = slide.insertTextBox(label + ' 在庫進捗率');
  headerBox.setLeft(PAD).setTop(8).setWidth(TABLE_W).setHeight(HEADER_H - 16);
  applyTextStyle(headerBox, { size: 30, bold: true, color: C.HEADER_FG });

  // サマリー行（タグ埋め込み）
  const summaryBox = slide.insertTextBox(
    '在庫進捗率: {{' + prefix + '_rate}}　　残件数: {{' + prefix + '_remaining}}件'
  );
  summaryBox.setLeft(PAD).setTop(HEADER_H + 4).setWidth(TABLE_W).setHeight(SUMMARY_H - 4);
  applyTextStyle(summaryBox, { size: 20, bold: true, color: C.SUMMARY_TEXT });

  // ネイティブテーブル（ヘッダー行 + 10ユニット行）
  const numRows = CONFIG.UNITS.length + 1;
  const table   = slide.insertTable(numRows, 4);
  table.setLeft(PAD).setTop(TABLE_TOP).setWidth(TABLE_W);

  // 列幅
  [TABLE_W * 0.30, TABLE_W * 0.18, TABLE_W * 0.26, TABLE_W * 0.26]
    .forEach((w, i) => table.getColumn(i).setWidth(w));

  // ヘッダー行
  ['ユニット名', '掲出率', '設定予定(件)', 'アポ未調整(件)'].forEach((text, col) => {
    const cell = table.getCell(0, col);
    cell.getText().setText(text);
    cell.getText().getTextStyle()
      .setFontSize(12).setBold(true).setForegroundColor(C.TABLE_HEAD_FG);
    cell.getFill().setSolidFill(C.TABLE_HEAD_BG);
    cell.getText().getParagraphStyle()
      .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  });

  // データ行（ユニット名 + タグ）
  CONFIG.UNITS.forEach((name, i) => {
    const row    = i + 1;
    const n      = i + 1;
    const bg     = i % 2 === 0 ? C.ROW_BG : C.ROW_ALT_BG;
    const values = [
      name,
      '{{u' + n + '_' + prefix + '_rate}}',
      '{{u' + n + '_' + prefix + '_sched}}',
      '{{u' + n + '_' + prefix + '_unsched}}'
    ];
    values.forEach((val, col) => {
      const cell = table.getCell(row, col);
      cell.getText().setText(val);
      cell.getText().getTextStyle().setFontSize(11).setForegroundColor(C.TEXT);
      cell.getFill().setSolidFill(bg);
      if (col > 0) {
        cell.getText().getParagraphStyle()
          .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      }
    });
  });
}

// テンプレート: その他共有事項スライド
function addOtherTemplateSlide(pres, dim) {
  const slide    = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C        = CONFIG.COLOR;
  const PAD      = 25;
  const HEADER_H = 62;

  insertRect(slide, 0, 0, dim.w, HEADER_H, C.HEADER_BG);
  const headerBox = slide.insertTextBox('その他共有事項');
  headerBox.setLeft(PAD).setTop(8).setWidth(dim.w - PAD * 2).setHeight(HEADER_H - 16);
  applyTextStyle(headerBox, { size: 30, bold: true, color: C.HEADER_FG });

  const contentBox = slide.insertTextBox('{{other}}');
  contentBox.setLeft(PAD).setTop(HEADER_H + PAD)
    .setWidth(dim.w - PAD * 2).setHeight(dim.h - HEADER_H - PAD * 2);
  applyTextStyle(contentBox, { size: 18, bold: false, color: C.TEXT });
}

// ========================================
// 自動生成モード（テンプレートIDなし時のフォールバック）
// ========================================
function buildPresentation(data) {
  const dateStr       = Utilities.formatDate(data.date, 'Asia/Tokyo', 'yyyy/MM/dd');
  const pres          = SlidesApp.create('水曜定例_' + dateStr);
  const defaultSlides = pres.getSlides();
  const dim           = { w: pres.getPageWidth(), h: pres.getPageHeight() };

  addTitleSlide(pres, dim, data);
  addInventorySlide(pres, dim, '前月', data.prevRate, data.prevRemaining, data.prevUnits);
  addInventorySlide(pres, dim, '今月', data.currRate, data.currRemaining, data.currUnits);
  addOtherItemsSlide(pres, dim, data.other);

  defaultSlides.forEach(s => s.remove());
  return pres;
}

function addTitleSlide(pres, dim, data) {
  const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C     = CONFIG.COLOR;

  slide.getBackground().setSolidFill(C.HEADER_BG);
  insertRect(slide, 0, dim.h - 10, dim.w, 10, '#9dc3e6');

  const titleBox = slide.insertTextBox('水曜定例');
  titleBox.setLeft(60).setTop(dim.h * 0.22).setWidth(dim.w - 120).setHeight(100);
  applyTextStyle(titleBox, { size: 54, bold: true, color: C.HEADER_FG, align: 'CENTER' });

  const dateStr = Utilities.formatDate(data.date, 'Asia/Tokyo', 'yyyy年MM月dd日');
  const dateBox = slide.insertTextBox(dateStr);
  dateBox.setLeft(60).setTop(dim.h * 0.58).setWidth(dim.w - 120).setHeight(50);
  applyTextStyle(dateBox, { size: 24, bold: false, color: '#9dc3e6', align: 'CENTER' });
}

function addInventorySlide(pres, dim, label, rate, remaining, units) {
  const slide     = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C         = CONFIG.COLOR;
  const PAD       = 25;
  const HEADER_H  = 62;
  const SUMMARY_H = 44;
  const TABLE_TOP = HEADER_H + SUMMARY_H + 6;
  const TABLE_H   = dim.h - TABLE_TOP - PAD;

  insertRect(slide, 0, 0, dim.w, HEADER_H, C.HEADER_BG);
  const headerBox = slide.insertTextBox(label + ' 在庫進捗率');
  headerBox.setLeft(PAD).setTop(8).setWidth(dim.w - PAD * 2).setHeight(HEADER_H - 16);
  applyTextStyle(headerBox, { size: 30, bold: true, color: C.HEADER_FG });

  const summaryBox = slide.insertTextBox(
    '在庫進捗率: ' + formatRate(rate) + '　　残件数: ' + formatCount(remaining, '件')
  );
  summaryBox.setLeft(PAD).setTop(HEADER_H + 4).setWidth(dim.w - PAD * 2).setHeight(SUMMARY_H - 4);
  applyTextStyle(summaryBox, { size: 20, bold: true, color: C.SUMMARY_TEXT });

  drawUnitTable(slide, units, PAD, TABLE_TOP, dim.w - PAD * 2, TABLE_H);
}

function addOtherItemsSlide(pres, dim, content) {
  const slide    = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C        = CONFIG.COLOR;
  const PAD      = 25;
  const HEADER_H = 62;

  insertRect(slide, 0, 0, dim.w, HEADER_H, C.HEADER_BG);
  const headerBox = slide.insertTextBox('その他共有事項');
  headerBox.setLeft(PAD).setTop(8).setWidth(dim.w - PAD * 2).setHeight(HEADER_H - 16);
  applyTextStyle(headerBox, { size: 30, bold: true, color: C.HEADER_FG });

  const text       = content ? String(content) : '（今週の共有事項はありません）';
  const contentBox = slide.insertTextBox(text);
  contentBox.setLeft(PAD).setTop(HEADER_H + PAD).setWidth(dim.w - PAD * 2).setHeight(dim.h - HEADER_H - PAD * 2);
  applyTextStyle(contentBox, { size: 18, bold: false, color: C.TEXT });
}

function drawUnitTable(slide, units, left, top, tableW, tableH) {
  const C       = CONFIG.COLOR;
  const numRows = units.length + 1;
  const rowH    = Math.floor(tableH / numRows);
  const colW    = [tableW * 0.30, tableW * 0.18, tableW * 0.26, tableW * 0.26];

  drawTableRow(slide, ['ユニット名', '掲出率', '設定予定', 'アポ未調整件数'],
    left, top, colW, rowH, {
      bgColor: C.TABLE_HEAD_BG, textColor: C.TABLE_HEAD_FG,
      fontSize: 12, bold: true,
      aligns: ['CENTER', 'CENTER', 'CENTER', 'CENTER']
    });

  units.forEach((unit, i) => {
    const bgColor = i % 2 === 0 ? C.ROW_BG : C.ROW_ALT_BG;
    drawTableRow(slide,
      [unit.name, formatRate(unit.rate), formatCount(unit.scheduled, '件'), formatCount(unit.unscheduled, '件')],
      left, top + rowH * (i + 1), colW, rowH, {
        bgColor, textColor: C.TEXT, fontSize: 11, bold: false,
        aligns: ['START', 'CENTER', 'CENTER', 'CENTER']
      });
  });
}

function drawTableRow(slide, values, left, top, colWidths, rowH, opts) {
  const C = CONFIG.COLOR;
  let x   = left;
  values.forEach((val, col) => {
    const cell = slide.insertShape(SlidesApp.ShapeType.RECTANGLE);
    cell.setLeft(x).setTop(top).setWidth(colWidths[col]).setHeight(rowH);
    cell.getFill().setSolidFill(opts.bgColor);
    cell.getBorder().setWeight(0.5).getLineFill().setSolidFill(C.BORDER);

    const tb    = slide.insertTextBox(String(val));
    tb.setLeft(x + 3).setTop(top + 2).setWidth(colWidths[col] - 6).setHeight(rowH - 4);
    const align = opts.aligns[col] === 'CENTER'
      ? SlidesApp.ParagraphAlignment.CENTER
      : SlidesApp.ParagraphAlignment.START;
    applyTextStyle(tb, { size: opts.fontSize, bold: opts.bold, color: opts.textColor, paraAlign: align });

    x += colWidths[col];
  });
}

// ========================================
// ユーティリティ
// ========================================
function insertRect(slide, l, t, w, h, color) {
  const shape = slide.insertShape(SlidesApp.ShapeType.RECTANGLE);
  shape.setLeft(l).setTop(t).setWidth(w).setHeight(h);
  shape.getFill().setSolidFill(color);
  shape.getBorder().setTransparent();
  return shape;
}

function applyTextStyle(textBox, opts) {
  const ts    = textBox.getText().getTextStyle();
  ts.setFontSize(opts.size).setBold(!!opts.bold).setForegroundColor(opts.color);
  const align = opts.align === 'CENTER'
    ? SlidesApp.ParagraphAlignment.CENTER
    : (opts.paraAlign || SlidesApp.ParagraphAlignment.START);
  textBox.getText().getParagraphStyle().setParagraphAlignment(align);
}

function formatRate(val) {
  if (val === '' || val === null || val === undefined) return '-';
  if (typeof val === 'number') return val.toFixed(1) + '%';
  const s = String(val).trim();
  return s.includes('%') ? s : s + '%';
}

function formatCount(val, suffix) {
  if (val === '' || val === null || val === undefined) return '-';
  return val + suffix;
}

// ========================================
// 作成履歴の記録
// ========================================
function logSlideUrl(url, date) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let log   = ss.getSheetByName('作成履歴');
  if (!log) {
    log = ss.insertSheet('作成履歴');
    log.appendRow(['作成日時', '対象日付', 'スライドURL']);
    log.getRange('1:1').setBackground('#1f4e79').setFontColor('#ffffff').setFontWeight('bold');
    log.setColumnWidth(3, 400);
  }
  const now     = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');
  log.appendRow([now, dateStr, url]);
}

// ========================================
// 初期セットアップ（初回のみ実行）
// ========================================
function setupInputSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (sheet) {
    const res = SpreadsheetApp.getUi().alert(
      '確認',
      '「入力」シートは既に存在します。\n上書きして再セットアップしますか？\n（入力済みデータは消去されます）',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );
    if (res !== SpreadsheetApp.getUi().Button.YES) return;
    sheet.clear();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME, 0);
  }

  buildInputSheet(sheet);

  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了',
    '「入力」シートを作成しました。\n\n' +
    '【はじめて使う場合】\n' +
    '① メニュー「📋 テンプレートを新規作成する」を実行\n' +
    '   → テンプレートが自動作成され B3 に設定されます\n\n' +
    '【既存のテンプレートがある場合】\n' +
    '① B3 にテンプレートスライドのURLを貼り付ける\n\n' +
    '② 各セルに数値を入力する\n' +
    '③ メニュー「▶ スライドを作成する」を実行する',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function buildInputSheet(sheet) {
  const C  = CONFIG.CELLS;

  // 列幅
  sheet.setColumnWidth(1, 190);  // A: ラベル
  sheet.setColumnWidth(2, 130);  // B: 値 / 前月掲出率
  sheet.setColumnWidth(3, 130);  // C: 前月設定予定
  sheet.setColumnWidth(4, 140);  // D: 前月アポ未調整
  sheet.setColumnWidth(5, 18);   // E: スペーサー
  sheet.setColumnWidth(6, 130);  // F: 今月掲出率
  sheet.setColumnWidth(7, 130);  // G: 今月設定予定
  sheet.setColumnWidth(8, 140);  // H: 今月アポ未調整

  // ---- Row 1: ヘッダー ----
  sheet.setRowHeight(1, 48);
  sheet.getRange('A1:H1').merge()
    .setValue('📊 週次スライド自動作成 — 入力フォーム')
    .setBackground('#1f4e79').setFontColor('#ffffff')
    .setFontSize(15).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // ---- Row 2: 日付 ----
  setLabel(sheet, 'A2', '対象日付');
  sheet.getRange('B2').setValue(new Date())
    .setNumberFormat('yyyy/MM/dd')
    .setBackground('#fffde7')
    .setBorder(true, true, true, true, null, null, '#f0b400', SpreadsheetApp.BorderStyle.SOLID);

  // ---- Row 3: テンプレートURL ----
  setLabel(sheet, 'A3', 'テンプレートURL/ID');
  sheet.getRange('B3:H3').merge()
    .setBackground('#e8f4fd')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
    .setBorder(true, true, true, true, null, null, '#4a90d9', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('A3').setFontColor('#0a5c8c');

  // ---- Row 4: 前月 セクションヘッダー ----
  setSectionHeader(sheet, 'A4:H4', '■ 前月 在庫進捗率');

  // ---- Row 5: 前月進捗率 ----
  setLabel(sheet, 'A5', '在庫進捗率 (%)');
  setInputCell(sheet, 'B5');

  // ---- Row 6: 前月残件数 ----
  setLabel(sheet, 'A6', '残件数 (件)');
  setInputCell(sheet, 'B6');

  // ---- Row 8: 今月 セクションヘッダー ----
  setSectionHeader(sheet, 'A8:H8', '■ 今月 在庫進捗率');

  // ---- Row 9: 今月進捗率 ----
  setLabel(sheet, 'A9', '在庫進捗率 (%)');
  setInputCell(sheet, 'B9');

  // ---- Row 10: 今月残件数 ----
  setLabel(sheet, 'A10', '残件数 (件)');
  setInputCell(sheet, 'B10');

  // ---- Row 12: その他 セクションヘッダー ----
  setSectionHeader(sheet, 'A12:H12', '■ その他共有事項');

  // ---- Row 13-15: 共有事項テキスト ----
  setLabel(sheet, 'A13', '共有事項（改行可）');
  sheet.getRange('A13').setVerticalAlignment('top');
  sheet.getRange('B13:H15').merge()
    .setBackground('#fffde7')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setVerticalAlignment('top')
    .setBorder(true, true, true, true, null, null, '#f0b400', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(13, 28);
  sheet.setRowHeight(14, 28);
  sheet.setRowHeight(15, 28);

  // ---- Row 17: ユニット別 セクションヘッダー ----
  setSectionHeader(sheet, 'A17:H17', '■ ユニット別データ（数値のみ入力）');

  // ---- Row 18: テーブルヘッダー ----
  sheet.getRange('A18:H18').setValues([[
    'ユニット名',
    '前月 掲出率(%)', '前月 設定予定(件)', '前月 アポ未調整(件)',
    '',
    '今月 掲出率(%)', '今月 設定予定(件)', '今月 アポ未調整(件)'
  ]])
    .setBackground('#dae3f3').setFontWeight('bold')
    .setHorizontalAlignment('center').setWrap(true);
  sheet.setRowHeight(18, 36);

  // ---- Row 19-28: ユニット行 ----
  const UC = CONFIG.UNIT_COLS;
  CONFIG.UNITS.forEach((name, i) => {
    const row     = C.UNITS_START_ROW + i;
    const bg      = i % 2 === 0 ? '#ffffff' : '#f5f8ff';
    const inputBg = i % 2 === 0 ? '#fffde7' : '#fff9db';

    sheet.getRange(row, UC.NAME).setValue(name).setBackground(bg).setFontWeight('bold');
    sheet.getRange(row, UC.PREV_RATE, 1, 3).setBackground(inputBg);
    sheet.getRange(row, 5).setBackground(bg);
    sheet.getRange(row, UC.CURR_RATE, 1, 3).setBackground(inputBg);
    sheet.getRange(row, 1, 1, 8).setBorder(
      false, true, true, true, true, false,
      '#c8d8ec', SpreadsheetApp.BorderStyle.SOLID_LIGHT
    );
    sheet.setRowHeight(row, 26);
  });

  sheet.setFrozenRows(1);
}

// ---- 補助関数 ----
function setSectionHeader(sheet, range, text) {
  sheet.getRange(range).merge()
    .setValue(text)
    .setBackground('#2e75b6').setFontColor('#ffffff')
    .setFontSize(12).setFontWeight('bold');
}

function setLabel(sheet, cell, text) {
  sheet.getRange(cell).setValue(text)
    .setFontWeight('bold').setBackground('#f0f4f8').setFontColor('#1f4e79');
}

function setInputCell(sheet, cell) {
  sheet.getRange(cell)
    .setBackground('#fffde7')
    .setBorder(true, true, true, true, null, null, '#f0b400', SpreadsheetApp.BorderStyle.SOLID);
}
