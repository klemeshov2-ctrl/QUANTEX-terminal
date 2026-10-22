#!/usr/bin/env bash
# ==============================================================================
# S&T Indicator Studio - Live Development Mode on VPS
# ==============================================================================
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "=================================================================="
echo "    🛠️ РЕЖИМ ЖИВОЙ РАЗРАБОТКИ (HOT RELOAD) НА СЕРВЕРЕ"
echo "=================================================================="
echo "В этом режиме изменения в коде подхватываются на лету без сборки."
echo "Редактируйте файлы в nano/vim или VS Code Remote и сохраняйте."
echo "Нажмите Ctrl+C для остановки."
echo "=================================================================="

# Stop PM2 production app to free port 3000 if PM2 is running
if command -v pm2 >/dev/null 2>&1; then
  echo "⏸️ Приостановка PM2 фонового процесса для освобождения порта 3000..."
  pm2 stop st-indicator-studio 2>/dev/null || true
fi

echo "🚀 Запуск dev-сервера (tsx server.ts)..."
npm run dev
