import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import { getCurrentBaseUrl } from "../../src/services/api";
import { SafeIcon } from "../../components/SafeIcon";

interface MesaPublica {
  id: number;
  numero: number;
  nome: string;
  status: string;
}

export default function CardapioIndex() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mesas, setMesas] = useState<MesaPublica[]>([]);
  const [comandaInput, setComandaInput] = useState("");

  useEffect(() => {
    const carregarMesas = async () => {
      setLoading(true);
      try {
        const baseUrl = getCurrentBaseUrl().replace(/\/$/, "");
        const res = await axios.get(`${baseUrl}/public/mesas`);
        if (res.data?.success && Array.isArray(res.data.mesas)) {
          setMesas(res.data.mesas);
        }
      } catch (e) {
        console.warn("Erro ao carregar mesas no cardápio:", e);
      } finally {
        setLoading(false);
      }
    };
    carregarMesas();
  }, []);

  const handleAbrirMesa = (mesaId: number) => {
    router.replace(`/cardapio/${mesaId}` as any);
  };

  const handleAbrirComanda = () => {
    const clean = comandaInput.trim();
    if (!clean) return;
    router.replace(`/cardapio/comanda/${encodeURIComponent(clean)}` as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBox}>
          <Text style={styles.emoji}>🍻</Text>
          <Text style={styles.title}>Cardápio Digital</Text>
          <Text style={styles.subtitle}>
            Selecione sua Mesa abaixo ou informe o nome/número da sua Comanda para fazer seus pedidos.
          </Text>
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>🍽️ Escolha sua Mesa</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#FF8C00" style={{ marginVertical: 20 }} />
          ) : mesas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma mesa ativa encontrada.</Text>
          ) : (
            <View style={styles.mesasGrid}>
              {mesas.map((m) => {
                const numStr = String(m.numero).padStart(2, "0");
                const isOcupada = m.status === "ocupada";
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.mesaCard, isOcupada && styles.mesaCardOcupada]}
                    onPress={() => handleAbrirMesa(m.id)}
                    activeOpacity={0.8}
                  >
                    <SafeIcon name="restaurant" size={20} color="#FF8C00" fallbackText="🍽️" />
                    <Text style={styles.mesaNumero}>Mesa {numStr}</Text>
                    <Text style={[styles.mesaStatus, { color: isOcupada ? "#4CAF50" : "#AAA" }]}>
                      {isOcupada ? "Em atendimento" : "Livre"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>🧾 Ou acesse por Comanda</Text>
          <View style={styles.comandaRow}>
            <TextInput
              style={styles.input}
              placeholder="Nome ou número da Comanda..."
              placeholderTextColor="#777"
              value={comandaInput}
              onChangeText={setComandaInput}
              onSubmitEditing={handleAbrirComanda}
            />
            <TouchableOpacity
              style={[styles.btnComanda, !comandaInput.trim() && { opacity: 0.5 }]}
              onPress={handleAbrirComanda}
              disabled={!comandaInput.trim()}
            >
              <Text style={styles.btnComandaText}>Abrir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  content: {
    padding: 20,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  headerBox: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 12,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF8C00",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#AAA",
    textAlign: "center",
    lineHeight: 19,
  },
  sectionBox: {
    backgroundColor: "#1E1E1E",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#2C2C2C",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 14,
  },
  emptyText: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 12,
  },
  mesasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mesaCard: {
    backgroundColor: "#262626",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    width: "48%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#383838",
  },
  mesaCardOcupada: {
    borderColor: "#FF8C00",
  },
  mesaNumero: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 6,
  },
  mesaStatus: {
    fontSize: 11,
    marginTop: 2,
  },
  comandaRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#383838",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFF",
    fontSize: 14,
  },
  btnComanda: {
    backgroundColor: "#FF8C00",
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  btnComandaText: {
    color: "#121212",
    fontWeight: "bold",
    fontSize: 14,
  },
});
