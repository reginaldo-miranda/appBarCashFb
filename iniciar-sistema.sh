#!/bin/bash

# ============================================
#    appBarCash - Sistema Completo (Mac / Linux)
# ============================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" || exit 1

echo ""
echo "============================================"
echo "    appBarCash - Iniciando Sistema Completo"
echo "============================================"
echo "Diretório: $ROOT_DIR"
echo ""

# 1. Detectar IP da LAN automaticamente (priorizando Wi-Fi / Ethernet 192.168.x.x)
LAN_IP=""
if command -v ipconfig &> /dev/null; then
  # macOS
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
  if [ -z "$LAN_IP" ]; then
    LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)
  fi
fi

if [ -z "$LAN_IP" ] && command -v hostname &> /dev/null; then
  # Linux
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$LAN_IP" ]; then
  LAN_IP="localhost"
fi

echo "📡 IP da Rede Local detectado: $LAN_IP"
echo ""

# 2. Limpar processos antigos nas portas 4000 e 8082
echo "[1/4] Limpando processos antigos nas portas 4000 e 8082..."
pkill -f "node server.js" 2>/dev/null
pkill -f "expo start" 2>/dev/null

kill_port() {
  local port=$1
  if command -v lsof &> /dev/null; then
    local pids=$(lsof -tiTCP:"$port" 2>/dev/null)
    if [ -n "$pids" ]; then
      kill -9 $pids 2>/dev/null
    fi
  fi
}
kill_port 4000
kill_port 8082
echo "      Portas liberadas com sucesso!"
echo ""

# 3. Verificar dependências
echo "[2/4] Verificando dependências..."
if [ ! -d "api/node_modules" ]; then
  echo "      Instalando dependências da API..."
  cd api && npm install --omit=dev && cd ..
fi
if [ ! -d "mobile/node_modules" ]; then
  echo "      Instalando dependências do Mobile..."
  cd mobile && npm install && cd ..
fi
echo "      Dependências OK!"
echo ""

# 4. Iniciar API na porta 4000
echo "[3/4] Iniciando API (porta 4000)..."
export HOST="0.0.0.0"
export PORT="4000"
(cd "$ROOT_DIR/api" && node server.js) &
API_PID=$!

echo "      Aguardando API inicializar (4 segundos)..."
sleep 4

# 5. Iniciar Mobile / Expo Web na porta 8082
echo "[4/4] Iniciando Expo Web (porta 8082)..."
export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:4000/api"

echo ""
echo "============================================"
echo "    SISTEMA INICIADO COM SUCESSO!"
echo "============================================"
echo ""
echo "  🌐 API:       http://${LAN_IP}:4000/api"
echo "  📱 Expo Web:  http://${LAN_IP}:8082"
echo "  💻 Local:     http://localhost:4000"
echo ""
echo "  Para parar: pressione Ctrl+C neste terminal."
echo "============================================"
echo ""

# Ao encerrar este script (Ctrl+C), encerra a API também
trap "echo ''; echo '🛑 Encerrando serviços...'; kill -9 $API_PID 2>/dev/null; kill_port 4000; kill_port 8082; exit 0" INT TERM EXIT

cd "$ROOT_DIR/mobile" && npx expo start --web --port 8082 -c
