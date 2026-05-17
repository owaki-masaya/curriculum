#!/bin/bash
# =============================================
# 定期メール配信 cron ジョブ セットアップスクリプト
# =============================================
# 使い方: bash setup_cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$(which python3)"
CRON_LOG="$SCRIPT_DIR/cron.log"

echo "=== 飲食業界ニュースメール 定期配信セットアップ ==="
echo "スクリプトディレクトリ: $SCRIPT_DIR"
echo "Python: $PYTHON_BIN"

# .env の存在確認
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo ""
    echo "[警告] .env ファイルが見つかりません。"
    echo "  cp $SCRIPT_DIR/.env.example $SCRIPT_DIR/.env"
    echo "  を実行して設定を行ってください。"
    exit 1
fi

# crontab に追記 (毎朝8時)
CRON_JOB="0 8 * * * cd $SCRIPT_DIR && $PYTHON_BIN main.py --now >> $CRON_LOG 2>&1"

# 既存のジョブと重複しないようにチェック
if crontab -l 2>/dev/null | grep -q "food-news-mailer/main.py"; then
    echo ""
    echo "[情報] cron ジョブは既に登録されています。"
    crontab -l | grep "food-news-mailer"
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo ""
    echo "[完了] cron ジョブを登録しました:"
    echo "  $CRON_JOB"
fi

echo ""
echo "テスト送信を実行するには:"
echo "  cd $SCRIPT_DIR && python3 main.py --now"
