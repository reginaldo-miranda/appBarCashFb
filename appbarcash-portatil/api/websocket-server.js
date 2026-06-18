import { createServer } from 'http';
import { Server } from 'socket.io';
import { getActivePrisma } from './lib/prisma.js';

const prisma = getActivePrisma();

// Criar servidor HTTP
const httpServer = createServer();

// Configurar Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Armazenar conexões por setor
const connectionsBySetor = new Map();

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Registrar conexão em um setor específico
  socket.on('join-setor', (setorId) => {
    console.log(`Cliente ${socket.id} entrou no setor ${setorId}`);
    socket.join(`setor-${setorId}`);
    
    // Armazenar conexão
    if (!connectionsBySetor.has(setorId)) {
      connectionsBySetor.set(setorId, new Set());
    }
    connectionsBySetor.get(setorId).add(socket.id);
  });
  
  // Sair do setor
  socket.on('leave-setor', (setorId) => {
    console.log(`Cliente ${socket.id} saiu do setor ${setorId}`);
    socket.leave(`setor-${setorId}`);
    
    if (connectionsBySetor.has(setorId)) {
      connectionsBySetor.get(setorId).delete(socket.id);
      if (connectionsBySetor.get(setorId).size === 0) {
        connectionsBySetor.delete(setorId);
      }
    }
  });
  
  // Desconexão
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    
    // Remover de todos os setores
    for (const [setorId, connections] of connectionsBySetor.entries()) {
      connections.delete(socket.id);
      if (connections.size === 0) {
        connectionsBySetor.delete(setorId);
      }
    }
  });
});

// Função para emitir atualização para um setor específico
export function emitSetorUpdate(setorId, data) {
  const room = `setor-${setorId}`;
  console.log(`Emitindo atualização para setor ${setorId}:`, data);
  io.to(room).emit('setor-update', data);
}

// Função para emitir atualização global
export function emitGlobalUpdate(data) {
  console.log('Emitindo atualização global:', data);
  io.emit('global-update', data);
}

const PORT = process.env.WS_PORT || 4002;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🔌 WebSocket ativo em ws://0.0.0.0:${PORT}`);
});