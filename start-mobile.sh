#!/bin/bash

echo "📱 Iniciando Aplicativo Mobile..."
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR/mobile"

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Detectar IP da LAN automaticamente no macOS (fallback para valor definido)
DETECTED_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
LAN_IP=${REACT_NATIVE_PACKAGER_HOSTNAME:-$DETECTED_IP}
if [ -z "$LAN_IP" ]; then
  LAN_IP=192.168.0.176
fi

# Configurar IP da LAN e URL da API (evitar localhost/127.0.0.1)
export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:4000/api"
echo "🔗 REACT_NATIVE_PACKAGER_HOSTNAME=${REACT_NATIVE_PACKAGER_HOSTNAME}"
echo "🔗 EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"

# Garantir API ativa: health-check e auto start se necessário
if ! curl -s --max-time 2 "http://${LAN_IP}:4000/api/health" >/dev/null; then
  echo "🚀 Iniciando API automaticamente..."
  GNOME_CMD="cd $ROOT_DIR && ./start-api.sh; exec bash"
  OSASCRIPT_CMD='tell app "Terminal" to do script "cd '"$ROOT_DIR"' && ./start-api.sh"'
  gnome-terminal -- bash -c "$GNOME_CMD" 2>/dev/null || \
  osascript -e "$OSASCRIPT_CMD" 2>/dev/null || \
  echo "⚠️  Abra um novo terminal e execute: cd $ROOT_DIR && ./start-api.sh"
  sleep 5
fi

# Iniciar Expo em modo LAN (-c limpa cache) na porta 8082
# Nota: 'network' não é aceito pelo CLI atual; 'lan' cumpre o mesmo objetivo
echo "🔧 Iniciando Expo em modo LAN na porta 8082 com cache limpo..."
npx @expo/cli start --host lan --port 8082 -c

