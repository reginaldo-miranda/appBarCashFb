#!/bin/bash

echo "🎯 Iniciando Sistema Completo do Bar..."
echo "=================================="

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ===== Funções utilitárias =====
cleanup_all() {
  echo "🛑 Encerrando processos existentes (API, Expo, LocalTunnel)..."
  # Encerrar API (node server.js)
  pkill -f "node server.js" 2>/dev/null
  # Encerrar Expo
  pkill -f "expo start" 2>/dev/null
  # Encerrar LocalTunnel
  pkill -f "localtunnel" 2>/dev/null
  # Garantir portas livres
  kill_by_port 4000
  kill_by_port 8082
}

kill_by_port() {
  local PORT_TO_KILL="$1"
  local PIDS=$(lsof -tiTCP:"$PORT_TO_KILL")
  if [ -n "$PIDS" ]; then
    echo "🧹 Encerrando processos na porta $PORT_TO_KILL: $PIDS"
    kill -9 $PIDS 2>/dev/null
  fi
}

# Detectar IP da LAN automaticamente no macOS (fallback para valor definido)
DETECTED_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
LAN_IP=${REACT_NATIVE_PACKAGER_HOSTNAME:-$DETECTED_IP}
if [ -z "$LAN_IP" ]; then
  LAN_IP=192.168.0.176
fi

# ===== Fluxo de seleção de base =====
select_db_target() {
  if [ -n "$1" ]; then
    DB_TARGET="$1"
  else
    DB_TARGET="local"
  fi
  echo "📊 Banco de dados selecionado: $DB_TARGET"
}

start_api() {
  local TARGET="$1"
  echo "1️⃣ Iniciando API com base: $TARGET..."
  # Abrir em novo terminal (Linux/macOS) e repassar seleção para start-api.sh
  GNOME_CMD="cd $ROOT_DIR && ./start-api.sh $TARGET; exec bash"
  OSASCRIPT_CMD='tell app "Terminal" to do script "cd '"$ROOT_DIR"' && ./start-api.sh '$TARGET'"'

  gnome-terminal -- bash -c "$GNOME_CMD" 2>/dev/null || \
  osascript -e "$OSASCRIPT_CMD" 2>/dev/null || \
  echo "⚠️  Abra um novo terminal e execute: cd $ROOT_DIR && ./start-api.sh $TARGET"
}

start_mobile() {
  echo "2️⃣ Iniciando Mobile App (Expo LAN)..."
  GNOME_CMD_MOBILE="cd $ROOT_DIR && ./start-mobile.sh; exec bash"
  OSASCRIPT_CMD_MOBILE='tell app "Terminal" to do script "cd '"$ROOT_DIR"' && ./start-mobile.sh"'

  gnome-terminal -- bash -c "$GNOME_CMD_MOBILE" 2>/dev/null || \
  osascript -e "$OSASCRIPT_CMD_MOBILE" 2>/dev/null || \
  echo "⚠️  Abra um novo terminal e execute: cd $ROOT_DIR && ./start-mobile.sh"
}

show_status() {
  local API_URL="http://${LAN_IP}:4000/api"
  local EXPO_URL="http://${LAN_IP}:8082"
  echo ""
  echo "✅ Sistemas iniciados!"
  echo "📊 API (LAN): ${API_URL} (DB_TARGET=${DB_TARGET})"
  echo ""
}

# ===== Processo principal =====
# Seleção inicial de base (argumento ou prompt) ANTES de iniciar qualquer serviço
select_db_target "$1"

# Garantir que nada esteja rodando antes de iniciar com a base selecionada
cleanup_all

# Iniciar serviços
start_api "$DB_TARGET"
# Aguardar alguns segundos para a API subir antes do mobile (garante login apontando para base correta)
sleep 6
start_mobile
show_status

# Menu interativo para troca de base e controle
echo "Pressione Ctrl+C para parar todos os sistemas, ou use o menu abaixo:"
echo "=================================="

while true; do
  echo ""
  echo "🔁 Menu:"
  echo "  [1] Reiniciar API e Mobile"
  echo "  [q] Sair e encerrar tudo"
  read -p "👉 Escolha uma opção: " option
  case "$option" in
    1)
      echo "🔄 Reiniciando API e Mobile com base atual (${DB_TARGET})..."
      cleanup_all
      start_api "$DB_TARGET"
      sleep 6
      start_mobile
      show_status
      ;;
    q|Q)
      echo "👋 Encerrando todos os serviços..."
      cleanup_all
      exit 0
      ;;
    *)
      echo "⚠️ Opção inválida. Tente novamente." 
      ;;
  esac
  # Pequena pausa
  sleep 1
done

