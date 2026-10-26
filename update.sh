#!/bin/bash
# 🚀 Автоматический скрипт обновления приложения на сервере через GitHub
set -e

echo "=========================================="
echo "📥 1. Загрузка свежих обновлений из GitHub..."
echo "=========================================="
git pull origin main || git pull origin master

echo "=========================================="
echo "📦 2. Установка новых зависимостей (npm install)..."
echo "=========================================="
npm install

echo "=========================================="
echo "⚙️ 3. Сборка фронтенда и сервера (npm run build)..."
echo "=========================================="
npm run build

echo "=========================================="
echo "🔄 4. Перезапуск процесса приложения..."
echo "=========================================="
# Если используется PM2:
if command -v pm2 &> /dev/null; then
    pm2 restart ecosystem.config.cjs --update-env 2>/dev/null || pm2 restart all --update-env 2>/dev/null || pm2 start ecosystem.config.cjs --env production
    echo "✅ PM2 успешно перезапущен в режиме production!"
# Если используется systemd сервис:
elif systemctl is-active --quiet gold-server; then
    sudo systemctl restart gold-server
    echo "✅ Systemd сервис gold-server перезапущен!"
else
    echo "ℹ️ PM2 или systemd не обнаружены. Запустите сервер вручную:"
    echo "   npm start   (или 'npm run dev' для режима разработки)"
fi

echo "=========================================="
echo "🎉 Обновление успешно завершено!"
echo "=========================================="
