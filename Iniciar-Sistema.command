#!/bin/bash

# Iniciar o appBarCash de forma automática por duplo clique
echo "🍻 appBarCash - Iniciando o sistema local..."
echo "=================================================="

# Obter o diretório onde o script está rodando
ROOT_DIR="/Users/reginaldomiranda/Documents/appBarCashFb"

# 1. Limpar processos antigos que possam estar presos nas portas
echo "🧹 Limpando conexões antigas..."
pkill -f "node server.js" 2>/dev/null
pkill -f "expo start" 2>/dev/null
lsof -ti :4000 | xargs kill -9 2>/dev/null
lsof -ti :8081 | xargs kill -9 2>/dev/null
lsof -ti :8082 | xargs kill -9 2>/dev/null

# 2. Iniciar a API (Backend) em segundo plano
echo "🚀 1/2 Iniciando Servidor da API (Porta 4000)..."
cd "$ROOT_DIR/api" || exit 1
npm start > /dev/null 2>&1 &
API_PID=$!

# Aguardar 5 segundos para a API conectar ao MySQL
echo "⏳ Conectando ao Banco de Dados local..."
sleep 5

# 3. Iniciar o Expo (Aplicativo) no mesmo terminal de forma visível
echo "📱 2/2 Iniciando o Aplicativo (Expo Web)..."
echo "--------------------------------------------------"
cd "$ROOT_DIR/mobile" || exit 1
npx expo start --host lan -c

# Ao encerrar o Expo (Ctrl+C), desliga a API em background automaticamente
echo "🛑 Encerrando servidores..."
kill $API_PID 2>/dev/null
exit 0
