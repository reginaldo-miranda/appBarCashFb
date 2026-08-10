#!/bin/bash

# ============================================
#  Garante que a API está rodando antes de iniciar o Expo
#  Chamado automaticamente pelo 'prestart' do mobile
# ============================================

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
API_DIR="$ROOT_DIR/api"

# Detectar IP da LAN automaticamente no macOS
DETECTED_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
fi
LAN_IP=${REACT_NATIVE_PACKAGER_HOSTNAME:-$DETECTED_IP}
if [ -z "$LAN_IP" ]; then
  LAN_IP="192.168.0.176"
fi

# Exportar variáveis essenciais
export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:4000/api"

echo "🔍 Verificando se a API está rodando em http://${LAN_IP}:4000..."

# Tentar health-check na API
API_RUNNING=false
if curl -s --max-time 3 "http://${LAN_IP}:4000/api/health" > /dev/null 2>&1; then
  API_RUNNING=true
fi

# Se não respondeu no IP da LAN, tentar localhost
if [ "$API_RUNNING" = "false" ]; then
  if curl -s --max-time 2 "http://localhost:4000/api/health" > /dev/null 2>&1; then
    API_RUNNING=true
  fi
fi

if [ "$API_RUNNING" = "true" ]; then
  echo "✅ API já está rodando!"
else
  echo "🚀 API não está rodando. Iniciando automaticamente..."

  # Verificar se o diretório da API existe
  if [ ! -d "$API_DIR" ]; then
    echo "❌ Diretório da API não encontrado: $API_DIR"
    exit 1
  fi

  # Verificar dependências da API
  if [ ! -d "$API_DIR/node_modules" ]; then
    echo "📦 Instalando dependências da API..."
    cd "$API_DIR" && npm install --omit=dev
  fi

  # Carregar variáveis de ambiente da API
  if [ -f "$API_DIR/.env" ]; then
    set -a
    source "$API_DIR/.env"
    set +a
  fi

  # Garantir porta e host no .env
  if [ -f "$API_DIR/.env" ]; then
    if grep -q "^PORT=" "$API_DIR/.env"; then
      sed -i '' 's/^PORT=.*/PORT=4000/' "$API_DIR/.env"
    else
      echo "PORT=4000" >> "$API_DIR/.env"
    fi
    if ! grep -q "^HOST=" "$API_DIR/.env"; then
      echo "HOST=0.0.0.0" >> "$API_DIR/.env"
    fi
  fi

  # Liberar porta 4000 se ocupada
  PIDS=$(lsof -tiTCP:4000 -sTCP:LISTEN 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "🧹 Encerrando processos na porta 4000: $PIDS"
    kill -9 $PIDS 2>/dev/null
    sleep 1
  fi

  # Iniciar API em nova janela do Terminal (macOS)
  osascript -e "
  tell application \"Terminal\"
      activate
      do script \"cd '$API_DIR' && export HOST=0.0.0.0 && export PORT=4000 && export DB_TARGET=local && echo '🚀 appBarCash API - Porta 4000' && echo '' && node server.js\"
  end tell
  " 2>/dev/null

  if [ $? -ne 0 ]; then
    # Fallback: iniciar em background se osascript falhar
    echo "⚠️  Não foi possível abrir Terminal. Iniciando API em background..."
    cd "$API_DIR" && HOST=0.0.0.0 PORT=4000 DB_TARGET=local node server.js &
  fi

  # Aguardar a API ficar pronta (máximo 15 segundos)
  echo "⏳ Aguardando API ficar pronta..."
  for i in $(seq 1 15); do
    if curl -s --max-time 2 "http://${LAN_IP}:4000/api/health" > /dev/null 2>&1; then
      echo "✅ API iniciada com sucesso!"
      break
    fi
    if curl -s --max-time 2 "http://localhost:4000/api/health" > /dev/null 2>&1; then
      echo "✅ API iniciada com sucesso!"
      break
    fi
    if [ "$i" -eq 15 ]; then
      echo "⚠️  API pode ainda estar iniciando. Continuando mesmo assim..."
    fi
    sleep 1
  done
fi

echo "🔗 REACT_NATIVE_PACKAGER_HOSTNAME=${LAN_IP}"
echo "🔗 EXPO_PUBLIC_API_URL=http://${LAN_IP}:4000/api"
