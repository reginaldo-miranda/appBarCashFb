import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import api from '../services/api';
import { playOrderAlertSound, stopOrderAlertSound } from '../utils/orderAlertSound';
import { events } from '../utils/eventBus';
import { SafeIcon } from '../../components/SafeIcon';

interface AlertaConta {
  saleId: number;
  tipoVenda: string;
  identificacao: string;
  mesaId: number | null;
  mesaNumero: number | null;
  comandaNome: string | null;
  total: number;
  detalhes: string;
  updatedAt: string;
}

export default function BillRequestAlertBanner() {
  const [alertas, setAlertas] = useState<AlertaConta[]>([]);
  const knownKeysRef = useRef<Set<string>>(new Set());

  const fetchAlertas = async () => {
    try {
      const res = await api.get('/public/conta-alertas');
      if (res.data && Array.isArray(res.data.alertas)) {
        const lista: AlertaConta[] = res.data.alertas;
        setAlertas(lista);

        let temNovo = false;
        const nextSet = new Set<string>();
        for (const item of lista) {
          const key = `${item.saleId}:${item.detalhes}`;
          nextSet.add(key);
          if (!knownKeysRef.current.has(key)) {
            temNovo = true;
          }
        }
        knownKeysRef.current = nextSet;

        if (temNovo) {
          playOrderAlertSound(undefined, undefined, true);
          events.emit('mesas:refresh');
          events.emit('comandas:refresh');
        }
      }
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    fetchAlertas();
    const timer = setInterval(fetchAlertas, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleAck = async (saleId: number) => {
    stopOrderAlertSound();
    setAlertas((prev) => prev.filter((a) => a.saleId !== saleId));
    try {
      await api.post(`/public/conta-alertas/${saleId}/ack`);
      events.emit('mesas:refresh');
      events.emit('comandas:refresh');
    } catch {}
  };

  const handleOpenScreen = async (alerta: AlertaConta) => {
    stopOrderAlertSound();
    // Recolhe o alerta imediatamente e marca como ciente no servidor
    setAlertas((prev) => prev.filter((a) => a.saleId !== alerta.saleId));
    try {
      api.post(`/public/conta-alertas/${alerta.saleId}/ack`).catch(() => {});
    } catch {}

    const detLower = String(alerta.detalhes || '').toLowerCase();
    const method: 'dinheiro' | 'cartao' | 'pix' = detLower.includes('pix')
      ? 'pix'
      : detLower.includes('cart')
      ? 'cartao'
      : 'dinheiro';

    if (alerta.tipoVenda === 'mesa') {
      router.push({
        pathname: '/sale',
        params: {
          mesaId: String(alerta.mesaId || ''),
          numeroMesa: String(alerta.mesaNumero || ''),
          autoFinalize: '1',
          payMethod: method,
        },
      } as any);
    } else {
      router.push({
        pathname: '/sale',
        params: {
          tipo: 'comanda',
          vendaId: String(alerta.saleId),
          autoFinalize: '1',
          payMethod: method,
        },
      } as any);
    }
  };

  if (alertas.length === 0) return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {alertas.map((alerta) => (
        <View key={alerta.saleId} style={styles.banner}>
          <View style={styles.leftCol}>
            <View style={styles.titleRow}>
              <Text style={styles.bellIcon}>🔔</Text>
              <Text style={styles.titleText} numberOfLines={1}>
                {alerta.identificacao} pediu para fechar a conta!
              </Text>
            </View>
            <Text style={styles.subtitleText} numberOfLines={2}>
              💰 Total: <Text style={styles.totalHighlight}>R$ {Number(alerta.total || 0).toFixed(2).replace('.', ',')}</Text>
              {'  •  '}💳 {alerta.detalhes}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => handleOpenScreen(alerta)}
            >
              <SafeIcon name="cash-outline" size={14} color="#FFF" fallbackText="💰" />
              <Text style={styles.btnText}>Fechar {alerta.tipoVenda === 'mesa' ? 'Mesa' : 'Comanda'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ackBtn}
              onPress={() => handleAck(alerta.saleId)}
            >
              <SafeIcon name="checkmark" size={15} color="#FFF" fallbackText="✓" />
              <Text style={styles.btnText}>Ciente</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 52 : 90,
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },
  banner: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#FF8C00',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 10,
  },
  leftCol: {
    flex: 1,
    minWidth: 210,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bellIcon: {
    fontSize: 16,
  },
  titleText: {
    color: '#FFB74D',
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
  },
  subtitleText: {
    color: '#F1F5F9',
    fontSize: 12,
    marginTop: 3,
  },
  totalHighlight: {
    color: '#4ADE80',
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ackBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
