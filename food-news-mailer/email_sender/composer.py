from datetime import datetime
from typing import Optional
import html


ACCENT = "#E85327"
BG_MAIN = "#ffffff"
BG_HEADER = "#1a1a1a"
BG_SECTION = "#f7f7f7"
TEXT_MAIN = "#222222"
TEXT_MUTED = "#666666"
TEXT_LIGHT = "#999999"
BORDER = "#e0e0e0"


def _esc(text: str) -> str:
    """Escape text for safe HTML embedding."""
    return html.escape(str(text), quote=True)


def _format_date_jp(date_str: str) -> str:
    """Try to reformat an ISO-ish date string to Japanese style YYYY年MM月DD日."""
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            dt = datetime.strptime(date_str[:len(fmt)], fmt)
            return f"{dt.year}年{dt.month:02d}月{dt.day:02d}日"
        except (ValueError, TypeError):
            continue
    return _esc(str(date_str))


def _news_row(item: dict) -> str:
    title = _esc(item.get("title", "（タイトルなし）"))
    url = _esc(item.get("url", "#"))
    source = _esc(item.get("source", ""))
    date_raw = item.get("date", item.get("published_at", ""))
    date_jp = _format_date_jp(date_raw) if date_raw else ""
    summary = _esc(item.get("summary", item.get("description", "")))

    meta_parts = []
    if source:
        meta_parts.append(source)
    if date_jp:
        meta_parts.append(date_jp)
    meta_html = "　|　".join(meta_parts)

    return f"""
      <tr>
        <td style="padding:0 0 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 0 4px 0;">
                <a href="{url}"
                   style="font-size:16px;font-weight:bold;color:{ACCENT};
                          text-decoration:none;line-height:1.4;"
                >{title}</a>
              </td>
            </tr>
            {"" if not meta_html else f'''
            <tr>
              <td style="padding:0 0 6px 0;font-size:12px;color:{TEXT_LIGHT};">
                {meta_html}
              </td>
            </tr>'''}
            {"" if not summary else f'''
            <tr>
              <td style="font-size:14px;color:{TEXT_MUTED};line-height:1.7;">
                {summary}
              </td>
            </tr>'''}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:16px 0 0 0;border-bottom:1px solid {BORDER};"></td>
            </tr>
          </table>
        </td>
      </tr>"""


def _ir_row(item: dict) -> str:
    company = _esc(item.get("company_name", item.get("company", "（会社名なし）")))
    title = _esc(item.get("title", "（タイトルなし）"))
    url = _esc(item.get("url", "#"))
    disclosure_type = _esc(item.get("disclosure_type", item.get("type", "")))
    date_raw = item.get("date", item.get("disclosed_at", item.get("published_at", "")))
    date_jp = _format_date_jp(date_raw) if date_raw else ""

    badge_html = ""
    if disclosure_type:
        badge_html = f"""<span style="display:inline-block;padding:2px 8px;
            background:{ACCENT};color:#fff;font-size:11px;border-radius:3px;
            margin-right:8px;">{disclosure_type}</span>"""

    return f"""
      <tr>
        <td style="padding:0 0 20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 0 4px 0;font-size:13px;font-weight:bold;color:{TEXT_MAIN};">
                {company}
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 6px 0;">
                {badge_html}
                <a href="{url}"
                   style="font-size:15px;font-weight:bold;color:{ACCENT};
                          text-decoration:none;line-height:1.4;"
                >{title}</a>
              </td>
            </tr>
            {"" if not date_jp else f'''
            <tr>
              <td style="font-size:12px;color:{TEXT_LIGHT};">
                開示日：{date_jp}
              </td>
            </tr>'''}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:12px 0 0 0;border-bottom:1px solid {BORDER};"></td>
            </tr>
          </table>
        </td>
      </tr>"""


def _section(heading: str, icon: str, rows_html: str, empty_msg: str = "本日の情報はありません") -> str:
    content = rows_html if rows_html.strip() else f"""
      <tr>
        <td style="padding:24px 0;text-align:center;color:{TEXT_LIGHT};font-size:14px;">
          {empty_msg}
        </td>
      </tr>"""

    return f"""
    <!-- Section: {heading} -->
    <tr>
      <td style="padding:0 0 8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-radius:6px;overflow:hidden;">
          <!-- Section header -->
          <tr>
            <td style="background:{BG_SECTION};padding:14px 24px;
                       border-left:4px solid {ACCENT};margin-bottom:16px;">
              <span style="font-size:18px;font-weight:bold;color:{TEXT_MAIN};">
                {icon}　{_esc(heading)}
              </span>
            </td>
          </tr>
          <!-- Section body -->
          <tr>
            <td style="padding:20px 24px 4px 24px;background:{BG_MAIN};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                {content}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Section spacer -->
    <tr><td style="padding:0 0 32px 0;"></td></tr>"""


def compose_email(
    news_items: list[dict],
    ir_items: list[dict],
    report_date: Optional[datetime] = None,
) -> tuple[str, str]:
    """
    Compose a Japanese-language food industry newsletter email.

    Parameters
    ----------
    news_items : list[dict]
        Each dict may contain: title, url, source, date, summary/description
    ir_items : list[dict]
        Each dict may contain: company_name, title, url, disclosure_type, date
    report_date : datetime, optional
        Date shown in subject and header. Defaults to today.

    Returns
    -------
    tuple[str, str]
        (subject, html_body)
    """
    if report_date is None:
        report_date = datetime.now()

    date_str = f"{report_date.year}年{report_date.month:02d}月{report_date.day:02d}日"
    subject = f"【飲食業界レポート】{date_str} の最新ニュース・IR情報"

    news_rows = "".join(_news_row(item) for item in news_items)
    ir_rows = "".join(_ir_row(item) for item in ir_items)

    news_section = _section("飲食業界ニュース", "📰", news_rows)
    ir_section = _section("IR・決算情報", "📊", ir_rows)

    html_body = f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{_esc(subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {{font-family: 'メイリオ', Meiryo, sans-serif !important;}}
  </style>
  <![endif]-->
  <style type="text/css">
    body {{
      margin: 0;
      padding: 0;
      background-color: #f0f0f0;
      font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans',
                   'メイリオ', Meiryo, 'MS PGothic', sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }}
    img {{border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;}}
    table {{border-collapse: collapse !important;}}
    a {{color: {ACCENT}; text-decoration: none;}}
    a:hover {{text-decoration: underline;}}
    @media only screen and (max-width: 620px) {{
      .wrapper {{width: 100% !important; max-width: 100% !important;}}
      .inner-td {{padding: 16px !important;}}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;">

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#f0f0f0;">
  <tr>
    <td align="center" style="padding:24px 8px;">

      <!-- Email container -->
      <table class="wrapper" width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background-color:{BG_MAIN};
                    border-radius:8px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- ===== HEADER ===== -->
        <tr>
          <td style="background-color:{BG_HEADER};padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-size:22px;font-weight:bold;color:#ffffff;
                               letter-spacing:2px;">
                    🍽 飲食業界レポート
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:6px;">
                  <span style="font-size:13px;color:#aaaaaa;">
                    {date_str}　最新ニュース・IR情報
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== ACCENT BAR ===== -->
        <tr>
          <td style="height:4px;background-color:{ACCENT};font-size:0;line-height:0;">
            &nbsp;
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="inner-td" style="padding:32px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              {news_section}
              {ir_section}
            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td style="background-color:#2b2b2b;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <a href="#" style="color:#aaaaaa;font-size:13px;
                                     text-decoration:underline;">
                    配信停止はこちら
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center"
                    style="font-size:11px;color:#666666;line-height:1.8;">
                  このメールは飲食業界レポート自動配信システムによって送信されています。<br>
                  情報は各社公式サイト・プレスリリースを基に収集しています。<br>
                  © {report_date.year} 飲食業界レポート
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Email container -->

    </td>
  </tr>
</table>
<!-- /Outer wrapper -->

</body>
</html>"""

    return subject, html_body
