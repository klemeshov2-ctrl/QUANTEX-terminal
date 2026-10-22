#!/usr/bin/env bash
# ==============================================================================
# S&T Indicator Studio - Automated VPS Server Deployment & Management Script
# Tested on: Ubuntu 20.04/22.04/24.04 LTS, Debian 11/12, CentOS Stream / Rocky Linux
# ==============================================================================

set -e

# Color palette
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

APP_NAME="st-indicator-studio"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

echo -e "${CYAN}${BOLD}"
echo "=================================================================="
echo "    🚀 SYNC & TRADE (S&T) INDICATOR STUDIO SERVER DEPLOYMENT     "
echo "=================================================================="
echo -e "${NC}"
echo -e "${PURPLE}Версия:${NC} Production v2.0"
echo -e "${PURPLE}Директория:${NC} $APP_DIR"
echo -e "${PURPLE}Порт по умолчанию:${NC} $PORT"
echo ""

# Check root or sudo
is_root() {
  if [ "$(id -u)" -ne 0 ]; then
    return 1
  fi
  return 0
}

# 1. Check system architecture & OS
echo -e "${BLUE}[1/6] Проверка операционной системы и архитектуры...${NC}"
ARCH=$(uname -m)
OS="unknown"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
fi
echo -e "  ОС: ${GREEN}$OS ($VERSION_ID)${NC}, Архитектура: ${GREEN}$ARCH${NC}"

# 2. Check Node.js and npm
echo -e "\n${BLUE}[2/6] Проверка среды выполнения (Node.js & npm)...${NC}"
NODE_INSTALLED=false
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v)
  echo -e "  Node.js найден: ${GREEN}$NODE_VER${NC}"
  NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    NODE_INSTALLED=true
  else
    echo -e "  ${YELLOW}Версия Node.js ниже 18. Рекомендуется обновить до v20 или v22 LTS.${NC}"
  fi
fi

if [ "$NODE_INSTALLED" = false ]; then
  echo -e "  ${YELLOW}Установка Node.js 22 LTS...${NC}"
  if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    if is_root; then
      apt-get update -y
      apt-get install -y curl ca-certificates gnupg
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
    else
      echo -e "  ${RED}Требуются права sudo/root для автоматической установки Node.js!${NC}"
      echo -e "  Выполните: sudo apt-get update && sudo apt-get install -y nodejs npm"
      exit 1
    fi
  else
    echo -e "  ${YELLOW}Пожалуйста, установите Node.js 20+ вручную для вашей ОС ($OS)${NC}"
  fi
fi

# 3. Check environment file
echo -e "\n${BLUE}[3/6] Проверка конфигурации (.env)...${NC}"
if [ ! -f "$APP_DIR/.env" ]; then
  if [ -f "$APP_DIR/.env.production.example" ]; then
    echo -e "  ${YELLOW}.env не найден. Создаем из шаблона .env.production.example...${NC}"
    cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
  elif [ -f "$APP_DIR/.env.example" ]; then
    echo -e "  ${YELLOW}.env не найден. Создаем из шаблона .env.example...${NC}"
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  else
    cat << 'EOF' > "$APP_DIR/.env"
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
GEMINI_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
WEBHOOK_SECRET="st_secret_tradingview_token"
DISCORD_WEBHOOK_URL=""
EOF
  fi
  echo -e "  ${GREEN}Файл .env успешно создан.${NC}"
  echo -e "  ${YELLOW}Совет: отредактируйте .env для указания вашего GEMINI_API_KEY и TELEGRAM_BOT_TOKEN.${NC}"
else
  echo -e "  ${GREEN}Файл конфигурации .env обнаружен.${NC}"
fi

# 4. Install dependencies and Build
echo -e "\n${BLUE}[4/6] Установка зависимостей и компиляция проекта...${NC}"
cd "$APP_DIR"
npm install --production=false
echo -e "  ${CYAN}Сборка фронтенда (Vite) и бэкенда (esbuild server)...${NC}"
npm run build

if [ -f "$APP_DIR/dist/server.cjs" ]; then
  echo -e "  ${GREEN}✓ Успешно собрано! Артефакт dist/server.cjs готов к запуску.${NC}"
else
  echo -e "  ${RED}Ошибка сборки: файл dist/server.cjs не найден.${NC}"
  exit 1
fi

# 5. Deployment Options Selector
echo -e "\n${BLUE}[5/6] Выберите способ запуска сервера на VPS:${NC}"
echo -e "  ${BOLD}1)${NC} Запуск через ${GREEN}PM2 Process Manager${NC} (Рекомендуется для Node.js серверов)"
echo -e "  ${BOLD}2)${NC} Запуск через ${CYAN}Docker Compose${NC} (Изолированный контейнер)"
echo -e "  ${BOLD}3)${NC} Запуск через ${PURPLE}Systemd Service${NC} (Системная служба Linux)"
echo -e "  ${BOLD}4)${NC} Прямой фоновый запуск (Standalone Node)"

if [ -n "$1" ]; then
  CHOICE="$1"
else
  read -r -p "Введите номер варианта [1-4] (по умолчанию: 1): " CHOICE
  CHOICE=${CHOICE:-1}
fi

case $CHOICE in
  1)
    echo -e "\n${CYAN}--- Настройка PM2 ---${NC}"
    if ! command -v pm2 >/dev/null 2>&1; then
      echo "Установка PM2 глобально..."
      npm install -g pm2
    fi
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 start ecosystem.config.cjs
    pm2 save
    echo -e "${GREEN}✓ Сервер запущен под управлением PM2!${NC}"
    pm2 status
    ;;
  2)
    echo -e "\n${CYAN}--- Запуск в Docker Compose ---${NC}"
    if ! command -v docker >/dev/null 2>&1; then
      echo -e "${RED}Docker не установлен на этой машине. Пожалуйста, установите docker или выберите вариант 1 (PM2).${NC}"
      exit 1
    fi
    docker compose down 2>/dev/null || true
    docker compose up -d --build
    echo -e "${GREEN}✓ Контейнер Docker успешно собран и запущен!${NC}"
    docker compose ps
    ;;
  3)
    echo -e "\n${CYAN}--- Настройка Systemd Службы ---${NC}"
    if ! is_root; then
      echo -e "${RED}Настройка systemd требует прав root/sudo! Запустите скрипт через sudo.${NC}"
      exit 1
    fi
    sed -e "s|/var/www/st-indicator-studio|$APP_DIR|g" "$APP_DIR/st-indicator-studio.service" > /etc/systemd/system/st-indicator-studio.service
    systemctl daemon-reload
    systemctl enable st-indicator-studio
    systemctl restart st-indicator-studio
    echo -e "${GREEN}✓ Системная служба st-indicator-studio запущена и добавлена в автозагрузку!${NC}"
    systemctl status st-indicator-studio --no-pager
    ;;
  4)
    echo -e "\n${CYAN}--- Запуск в фоне через nohup ---${NC}"
    pkill -f "dist/server.cjs" || true
    nohup node dist/server.cjs > server.log 2>&1 &
    echo -e "${GREEN}✓ Сервер запущен в фоновом режиме (PID: $!)! Логи пишутся в server.log${NC}"
    ;;
  *)
    echo -e "${YELLOW}Неизвестный вариант. Запускаем стандартный PM2...${NC}"
    if command -v pm2 >/dev/null 2>&1; then
      pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs
    else
      npm start &
    fi
    ;;
esac

# 6. Summary and Access Info
SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
echo -e "\n${GREEN}${BOLD}"
echo "=================================================================="
echo "    🎉 РАЗВЕРТЫВАНИЕ УСПЕШНО ЗАВЕРШЕНО! СЕРВЕР АКТИВЕН         "
echo "=================================================================="
echo -e "${NC}"
echo -e "  🌐 ${BOLD}Веб-интерфейс:${NC}         http://${SERVER_IP}:${PORT}"
echo -e "  🏠 ${BOLD}Локальный адрес:${NC}       http://localhost:${PORT}"
echo -e "  ⚡ ${BOLD}TradingView Webhook:${NC}  http://${SERVER_IP}:${PORT}/api/webhook/tradingview"
echo -e "  🩺 ${BOLD}Проверка статуса:${NC}     http://${SERVER_IP}:${PORT}/api/health"
echo -e "  📜 ${BOLD}Просмотр логов:${NC}       http://${SERVER_IP}:${PORT}/api/server/logs"
echo ""
echo -e "Для включения SSL (HTTPS) используйте готовые конфиги ${BOLD}nginx.conf${NC} или ${BOLD}Caddyfile${NC}."
echo ""
