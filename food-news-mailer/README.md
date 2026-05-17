# 飲食業界ニュース定期メール自動配信システム

毎日指定時刻に飲食業界ニュースとIR・決算情報をメールで自動配信します。

## 機能

- **飲食業界ニュース**: 複数のRSSフィードから最新ニュースを自動収集
- **IR・決算情報**: 上場飲食企業の適時開示情報をTDnetから収集
- **HTML メール**: 読みやすいデザインのHTMLメールで配信
- **定期実行**: cronまたは組み込みスケジューラーで毎日自動実行

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd food-news-mailer
pip install -r requirements.txt
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .env をエディタで開いて設定する
```

**.env の主要設定項目:**

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `SMTP_USER` | 送信元Gmailアドレス | `your@gmail.com` |
| `SMTP_PASSWORD` | Gmailアプリパスワード | `xxxx xxxx xxxx xxxx` |
| `TO_ADDRESSES` | 送信先 (カンマ区切り) | `a@co.jp,b@co.jp` |
| `SEND_TIME` | 配信時刻 (HH:MM) | `08:00` |

> **Gmail アプリパスワードの取得:**
> Googleアカウント → セキュリティ → 2段階認証を有効化 → アプリパスワードを生成

### 3. テスト送信

```bash
python3 main.py --now
```

### 4. 定期実行の設定

#### 方法A: cronを使う (推奨)

```bash
bash setup_cron.sh
```

#### 方法B: 組み込みスケジューラー

```bash
# バックグラウンドで常時起動
nohup python3 main.py &
```

## ディレクトリ構成

```
food-news-mailer/
├── main.py                  # エントリーポイント・オーケストレーター
├── requirements.txt         # 依存パッケージ
├── .env.example             # 環境変数テンプレート
├── setup_cron.sh            # cron設定スクリプト
├── scrapers/
│   ├── news_scraper.py      # 飲食業界ニュース収集 (RSS)
│   └── ir_scraper.py        # IR・決算情報収集 (TDnet)
└── email_sender/
    ├── composer.py          # HTMLメール生成
    └── sender.py            # SMTP送信
```

## ニュースソース

| ソース | 種別 |
|--------|------|
| Google News (飲食業界) | ニュース |
| Google News (外食産業) | ニュース |
| 飲食店.COM | ニュース |
| TDnet 適時開示 | IR情報 |

## 対応IRモニタリング企業

日本マクドナルドHD / すかいらーくHD / ゼンショーHD / 吉野家HD / サイゼリヤ /
くら寿司 / FOOD & LIFE COMPANIES / コメダHD / ペッパーフードサービス / ハイデイ日高 / 松屋フーズHD

## ログ

- `delivery.log`: 配信履歴ログ
- `cron.log`: cron実行ログ
