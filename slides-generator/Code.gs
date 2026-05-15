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
  // スプレッドシートのセル位置
  CELLS: {
    DATE:            'B2',
    PREV_RATE:       'B5',
    PREV_REMAINING:  'B6',
    CURR_RATE:       'B9',
    CURR_REMAINING:  'B10',
    OTHER:           'B13',
    UNITS_START_ROW: 19   // 18行目がヘッダー、19行目からデータ
  },
  // ユニットデータの列番号（1-indexed）
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
    .addItem('⚙ 初期セットアップ（初回のみ）', 'setupInputSheet')
    .addToUi();
}

// ========================================
// メインエントリポイント
// ========================================
function createWeeklySlides() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    const data = readData(sheet);
    const presentation = buildPresentation(data);
    ss.toast('', '', 1);

    const url = presentation.getUrl();
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
// データ読み込み
// ========================================
function readData(sheet) {
  const C = CONFIG.CELLS;

  const dateVal = sheet.getRange(C.DATE).getValue();
  const date = dateVal instanceof Date ? dateVal : new Date();

  const prevRate      = sheet.getRange(C.PREV_RATE).getValue();
  const prevRemaining = sheet.getRange(C.PREV_REMAINING).getValue();
  const currRate      = sheet.getRange(C.CURR_RATE).getValue();
  const currRemaining = sheet.getRange(C.CURR_REMAINING).getValue();
  const other         = sheet.getRange(C.OTHER).getValue();

  const prevUnits = [];
  const currUnits = [];
  const UC = CONFIG.UNIT_COLS;

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
// プレゼンテーション作成
// ========================================
function buildPresentation(data) {
  const dateStr    = Utilities.formatDate(data.date, 'Asia/Tokyo', 'yyyy/MM/dd');
  const pres       = SlidesApp.create('水曜定例_' + dateStr);
  const defaultSlides = pres.getSlides();
  const dim        = { w: pres.getPageWidth(), h: pres.getPageHeight() };

  addTitleSlide(pres, dim, data);
  addInventorySlide(pres, dim, '前月', data.prevRate, data.prevRemaining, data.prevUnits);
  addInventorySlide(pres, dim, '今月', data.currRate, data.currRemaining, data.currUnits);
  addOtherItemsSlide(pres, dim, data.other);

  // デフォルトの空スライドを削除（カスタムスライドを追加後でないと削除できない）
  defaultSlides.forEach(s => s.remove());

  return pres;
}

// ========================================
// スライド1: タイトル
// ========================================
function addTitleSlide(pres, dim, data) {
  const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C = CONFIG.COLOR;

  slide.getBackground().setSolidFill(C.HEADER_BG);

  // 下部アクセントライン
  insertRect(slide, 0, dim.h - 10, dim.w, 10, '#9dc3e6');

  // タイトル
  const titleBox = slide.insertTextBox('水曜定例');
  titleBox.setLeft(60).setTop(dim.h * 0.22).setWidth(dim.w - 120).setHeight(100);
  applyTextStyle(titleBox, { size: 54, bold: true, color: C.HEADER_FG, align: 'CENTER' });

  // 日付
  const dateStr = Utilities.formatDate(data.date, 'Asia/Tokyo', 'yyyy年MM月dd日');
  const dateBox = slide.insertTextBox(dateStr);
  dateBox.setLeft(60).setTop(dim.h * 0.58).setWidth(dim.w - 120).setHeight(50);
  applyTextStyle(dateBox, { size: 24, bold: false, color: '#9dc3e6', align: 'CENTER' });
}

// ========================================
// スライド2/3: 在庫進捗率
// ========================================
function addInventorySlide(pres, dim, label, rate, remaining, units) {
  const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C     = CONFIG.COLOR;

  const PAD       = 25;
  const HEADER_H  = 62;
  const SUMMARY_H = 44;
  const TABLE_TOP = HEADER_H + SUMMARY_H + 6;
  const TABLE_H   = dim.h - TABLE_TOP - PAD;

  // ヘッダー帯
  insertRect(slide, 0, 0, dim.w, HEADER_H, C.HEADER_BG);
  const headerBox = slide.insertTextBox(label + ' 在庫進捗率');
  headerBox.setLeft(PAD).setTop(8).setWidth(dim.w - PAD * 2).setHeight(HEADER_H - 16);
  applyTextStyle(headerBox, { size: 30, bold: true, color: C.HEADER_FG });

  // サマリー行
  const rateStr   = formatRate(rate);
  const remainStr = formatCount(remaining, '件');
  const summaryBox = slide.insertTextBox(
    '在庫進捗率: ' + rateStr + '　　残件数: ' + remainStr
  );
  summaryBox.setLeft(PAD).setTop(HEADER_H + 4).setWidth(dim.w - PAD * 2).setHeight(SUMMARY_H - 4);
  applyTextStyle(summaryBox, { size: 20, bold: true, color: C.SUMMARY_TEXT });

  // ユニット別テーブル
  drawUnitTable(slide, units, PAD, TABLE_TOP, dim.w - PAD * 2, TABLE_H);
}

// ========================================
// スライド4: その他共有事項
// ========================================
function addOtherItemsSlide(pres, dim, content) {
  const slide = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  const C     = CONFIG.COLOR;
  const PAD   = 25;
  const HEADER_H = 62;

  // ヘッダー帯
  insertRect(slide, 0, 0, dim.w, HEADER_H, C.HEADER_BG);
  const headerBox = slide.insertTextBox('その他共有事項');
  headerBox.setLeft(PAD).setTop(8).setWidth(dim.w - PAD * 2).setHeight(HEADER_H - 16);
  applyTextStyle(headerBox, { size: 30, bold: true, color: C.HEADER_FG });

  // 本文
  const text = content ? String(content) : '（今週の共有事項はありません）';
  const contentBox = slide.insertTextBox(text);
  contentBox.setLeft(PAD).setTop(HEADER_H + PAD).setWidth(dim.w - PAD * 2).setHeight(dim.h - HEADER_H - PAD * 2);
  applyTextStyle(contentBox, { size: 18, bold: false, color: C.TEXT });
}

// ========================================
// ユニットテーブル描画
// ========================================
function drawUnitTable(slide, units, left, top, tableW, tableH) {
  const C       = CONFIG.COLOR;
  const numRows = units.length + 1;
  const rowH    = Math.floor(tableH / numRows);
  const colW    = [tableW * 0.30, tableW * 0.18, tableW * 0.26, tableW * 0.26];
  const headers = ['ユニット名', '掲出率', '設定予定', 'アポ未調整件数'];

  // ヘッダー行
  drawTableRow(slide, headers, left, top, colW, rowH, {
    bgColor: C.TABLE_HEAD_BG, textColor: C.TABLE_HEAD_FG,
    fontSize: 12, bold: true, aligns: ['CENTER', 'CENTER', 'CENTER', 'CENTER']
  });

  // データ行
  units.forEach((unit, i) => {
    const y      = top + rowH * (i + 1);
    const bgColor = i % 2 === 0 ? C.ROW_BG : C.ROW_ALT_BG;
    const values = [
      unit.name,
      formatRate(unit.rate),
      formatCount(unit.scheduled, '件'),
      formatCount(unit.unscheduled, '件')
    ];
    drawTableRow(slide, values, left, y, colW, rowH, {
      bgColor, textColor: C.TEXT,
      fontSize: 11, bold: false,
      aligns: ['START', 'CENTER', 'CENTER', 'CENTER']
    });
  });
}

function drawTableRow(slide, values, left, top, colWidths, rowH, opts) {
  const C = CONFIG.COLOR;
  let x = left;
  values.forEach((val, col) => {
    const cell = slide.insertShape(SlidesApp.ShapeType.RECTANGLE);
    cell.setLeft(x).setTop(top).setWidth(colWidths[col]).setHeight(rowH);
    cell.getFill().setSolidFill(opts.bgColor);
    cell.getBorder().setWeight(0.5).getLineFill().setSolidFill(C.BORDER);

    const tb = slide.insertTextBox(String(val));
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
  const ts = textBox.getText().getTextStyle();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log  = ss.getSheetByName('作成履歴');
  if (!log) {
    log = ss.insertSheet('作成履歴');
    log.appendRow(['作成日時', '対象日付', 'スライドURL']);
    log.getRange('1:1')
      .setBackground('#1f4e79')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

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
    '「入力」シートを作成しました。\n\n各セルに数値を入力後、メニューの\n「スライド作成 > スライドを作成する」を実行してください。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function buildInputSheet(sheet) {
  const C = CONFIG.CELLS;

  // 列幅
  sheet.setColumnWidth(1, 190);  // A: ラベル
  sheet.setColumnWidth(2, 130);  // B: 前月 掲出率 / 値
  sheet.setColumnWidth(3, 130);  // C: 前月 設定予定
  sheet.setColumnWidth(4, 140);  // D: 前月 アポ未調整
  sheet.setColumnWidth(5, 18);   // E: スペーサー
  sheet.setColumnWidth(6, 130);  // F: 今月 掲出率
  sheet.setColumnWidth(7, 130);  // G: 今月 設定予定
  sheet.setColumnWidth(8, 140);  // H: 今月 アポ未調整

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
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.setRowHeight(18, 36);

  // ---- Row 19-28: ユニット行 ----
  const UC = CONFIG.UNIT_COLS;
  CONFIG.UNITS.forEach((name, i) => {
    const row = C.UNITS_START_ROW + i;
    const bg  = i % 2 === 0 ? '#ffffff' : '#f5f8ff';
    const inputBg = i % 2 === 0 ? '#fffde7' : '#fff9db';

    sheet.getRange(row, UC.NAME).setValue(name)
      .setBackground(bg).setFontWeight('bold');
    sheet.getRange(row, UC.PREV_RATE, 1, 3).setBackground(inputBg);
    sheet.getRange(row, 5).setBackground(bg);
    sheet.getRange(row, UC.CURR_RATE, 1, 3).setBackground(inputBg);

    sheet.getRange(row, 1, 1, 8)
      .setBorder(false, true, true, true, true, false,
        '#c8d8ec', SpreadsheetApp.BorderStyle.SOLID_LIGHT);
    sheet.setRowHeight(row, 26);
  });

  // 行1を固定
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
