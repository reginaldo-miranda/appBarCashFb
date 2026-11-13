import { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';

/**
 * Hook para sincronização em tempo real de pedidos do setor
 * Usa WebSocket para receber atualizações instantâneas, com fallback via /sale/updates
 */
export function useSetorSync(setorId, onUpdate) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const lastSinceRef = useRef(Date.now());

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = () => {
    if (!setorId) return;

    const wsUrl = apiService.getWsUrl();
    if (!wsUrl) {
      setConnected(false);
      return;
    }

    try {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket conectado para setor:', setorId);
        setConnected(true);
        lastSinceRef.current = Date.now();

        try {
          ws.send(JSON.stringify({
            type: 'register_setor',
            setorId: setorId
          }));
        } catch {}
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type === 'sale:update' && payload.payload) {
            lastSinceRef.current = Date.now();
            if (onUpdateRef.current) {
              onUpdateRef.current(payload.payload);
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 4000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      setConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    setConnected(false);
  };

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [setorId]);

  // Fallback rápido via /sale/updates caso o WebSocket esteja desconectado
  useEffect(() => {
    if (!setorId || connected) return;
    const poll = setInterval(async () => {
      try {
        const res = await apiService.request({
          method: 'GET',
          url: `/sale/updates?since=${lastSinceRef.current}`
        });
        const updates = res?.data?.updates;
        if (Array.isArray(updates) && updates.length > 0) {
          lastSinceRef.current = res?.data?.now || Date.now();
          const latest = updates[updates.length - 1];
          if (onUpdateRef.current) {
            onUpdateRef.current(latest);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [setorId, connected]);

  return {
    connected,
    reconnect: connect
  };
}
