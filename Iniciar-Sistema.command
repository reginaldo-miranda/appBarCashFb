#!/bin/bash

# ============================================
#  appBarCash - Iniciando Sistema Completo
#  Script para macOS (duplo clique no Finder)
# ============================================

clear
echo ""
echo " ============================================"
echo "   appBarCash - Iniciando Sistema Completo"
echo " ============================================"
echo ""

# Forcar diretorio do script (funciona com duplo clique no Finder)
cd "$(dirname "$0")" || exit 1
ROOT_DIR="$(pwd)"
echo " Diretorio: $ROOT_DIR"
echo ""

# -----------------------------------------------
# 1. Detectar IP da LAN (macOS)
# -----------------------------------------------
LAN_IP=""
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
fi
if [ -z "$LAN_IP" ]; then
    LAN_IP="localhost"
fi

echo " IP da Rede Local: $LAN_IP"
echo ""

# -----------------------------------------------
# 2. Verificar se Node.js esta instalado
# -----------------------------------------------
echo " [1/5] Verificando Node.js..."

# Garantir que Node esta no PATH (instalacao via nvm, volta, brew, etc.)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" 2>/dev/null
[ -s "$HOME/.volta/bin/volta" ] && export PATH="$HOME/.volta/bin:$PATH"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node &>/dev/null; then
    echo ""
    echo " [ERRO] Node.js nao encontrado!"
    echo " Instale em: https://nodejs.org"
    echo ""
    read -p " Pressione ENTER para sair..."
    exit 1
fi
echo "         Node.js $(node -v) encontrado"
echo ""

# -----------------------------------------------
# 3. Limpar processos antigos nas portas
# -----------------------------------------------
echo " [2/5] Limpando processos antigos..."
kill_port() {
    local PORT=$1
    local PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "         Encerrando processos na porta $PORT (PIDs: $PIDS)"
        kill -9 $PIDS 2>/dev/null
    fi
}
kill_port 4000
kill_port 8082
echo "         OK"
echo ""

# -----------------------------------------------
# 4. Verificar e instalar dependencias da API
# -----------------------------------------------
echo " [3/5] Verificando dependencias da API..."
if [ ! -d "$ROOT_DIR/api/node_modules" ]; then
    echo "         Instalando dependencias da API..."
    cd "$ROOT_DIR/api" || exit 1
    npm install --omit=dev
    cd "$ROOT_DIR"
    echo "         Dependencias da API instaladas!"
else
    echo "         OK - node_modules encontrado"
fi
echo ""

# -----------------------------------------------
# 5. Verificar e instalar dependencias do Mobile
# -----------------------------------------------
echo " [4/5] Verificando dependencias do Mobile..."
if [ ! -d "$ROOT_DIR/mobile/node_modules" ]; then
    echo "         Instalando dependencias do Mobile..."
    cd "$ROOT_DIR/mobile" || exit 1
    npm install
    cd "$ROOT_DIR"
    echo "         Dependencias do Mobile instaladas!"
else
    echo "         OK - node_modules encontrado"
fi
echo ""

# -----------------------------------------------
# 6. Iniciar API em nova aba/janela do Terminal
# -----------------------------------------------
echo " [5/5] Iniciando servicos..."
echo ""
echo "         Iniciando API na porta 4000..."

# Exportar variaveis de ambiente para a API
export HOST=0.0.0.0
export PORT=4000

# Iniciar API em nova janela do Terminal do macOS
osascript -e "
tell application \"Terminal\"
    activate
    do script \"cd '$ROOT_DIR/api' && export HOST=0.0.0.0 && export PORT=4000 && echo '🚀 appBarCash API - Porta 4000' && echo '' && node server.js\"
end tell
" 2>/dev/null

# Aguardar a API iniciar
echo "         Aguardando API conectar ao banco (8 segundos)..."
sleep 8

# -----------------------------------------------
# 7. Iniciar Expo Web em nova aba/janela
# -----------------------------------------------
echo "         Iniciando Expo Web..."

osascript -e "
tell application \"Terminal\"
    activate
    do script \"cd '$ROOT_DIR/mobile' && export REACT_NATIVE_PACKAGER_HOSTNAME='$LAN_IP' && export EXPO_PUBLIC_API_URL='http://$LAN_IP:4000/api' && echo '📱 appBarCash Expo - Porta 8082' && echo '' && npx expo start --host lan --port 8082 -c\"
end tell
" 2>/dev/null

# -----------------------------------------------
# 8. Exibir resumo
# -----------------------------------------------
echo ""
echo " ============================================"
echo "   SISTEMA INICIADO COM SUCESSO!"
echo " ============================================"
echo ""
echo "  API:       http://$LAN_IP:4000/api"
echo "  Expo Web:  http://$LAN_IP:8082"
echo "  Local:     http://localhost:4000/api"
echo ""
echo "  Duas janelas do Terminal foram abertas:"
echo "    - appBarCash API (porta 4000)"
echo "    - appBarCash Expo (porta 8082)"
echo ""
echo "  Para parar: feche as janelas do Terminal"
echo "  ou pressione Ctrl+C em cada uma delas."
echo ""
echo " ============================================"
echo ""
read -p " Pressione ENTER para fechar esta janela..."
