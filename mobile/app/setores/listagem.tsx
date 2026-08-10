import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { setorImpressaoService } from '../../src/services/api';

interface Setor {
  id: number;
  nome: string;
  descricao?: string;
  modoEnvio: 'impressora' | 'whatsapp';
  whatsappDestino?: string;
  ativo: boolean;
}

export default function ListagemSetoresScreen() {
  const { hasPermission } = useAuth() as any;
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filtered, setFiltered] = useState<Setor[]>([]);

  useEffect(() => {
    if (!hasPermission('produtos')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta funcionalidade.');
      router.back();
    }
  }, [hasPermission]);

  useFocusEffect(
    useCallback(() => {
      if (hasPermission('produtos')) {
        loadSetores();
      }
    }, [hasPermission])
  );

  useEffect(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) { setFiltered(setores); return; }
    setFiltered(setores.filter(s => s.nome.toLowerCase().includes(q) || (s.descricao || '').toLowerCase().includes(q)));
  }, [searchText, setores]);

  const loadSetores = async () => {
    try {
      setLoading(true);
      const resp = await setorImpressaoService.list();
      const body = resp?.data;
      const items = Array.isArray(body)
        ? body
        : (Array.isArray(body?.data) ? body.data : []);
      setSetores(items);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar setores. Verifique sua conexão e tente novamente.');
      setSetores([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSetores();
    setRefreshing(false);
  };

  const handleEdit = (setor: Setor) => {
    router.push(`/setores/cadastro?id=${setor.id}` as any);
  };

  const handleDelete = (setor: Setor) => {
    Alert.alert(
      'Excluir Setor',
      `Tem certeza que deseja excluir o setor "${setor.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await setorImpressaoService.delete(setor.id);
            setSetores(prev => prev.filter(s => s.id !== setor.id));
            Alert.alert('Sucesso', 'Setor excluído com sucesso!');
          } catch (error) {
            Alert.alert('Erro', 'Erro ao excluir setor. Tente novamente.');
          }
        }},
      ]
    );
  };

  const toggleStatus = async (setor: Setor) => {
    const next = !setor.ativo;
    Alert.alert(
      'Alterar Status',
      `Deseja ${next ? 'ativar' : 'desativar'} o setor "${setor.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: async () => {
          try {
            await setorImpressaoService.update(setor.id, { ativo: next });
            setSetores(prev => prev.map(s => s.id === setor.id ? { ...s, ativo: next } : s));
            Alert.alert('Sucesso', `Setor ${next ? 'ativado' : 'desativado'} com sucesso!`);
          } catch {
            Alert.alert('Erro', 'Erro ao alterar status do setor.');
          }
        }}
      ]
    );
  };

  const renderItem = ({ item }: { item: Setor }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.nome}</Text>
          {!!item.descricao && <Text style={styles.desc}>{item.descricao}</Text>}
          <Text style={styles.meta}>{item.modoEnvio === 'whatsapp' ? 'WhatsApp' : 'Impressora'}{item.whatsappDestino ? ` • ${item.whatsappDestino}` : ''}</Text>
        </View>
        <View style={[styles.badge, item.ativo ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={styles.badgeText}>{item.ativo ? 'Ativo' : 'Inativo'}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => handleEdit(item)}>
          <Ionicons name="pencil" size={16} color="#2196F3" />
          <Text style={[styles.actionText, { color: '#2196F3' }]}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.toggleBtn]} onPress={() => toggleStatus(item)}>
          <Ionicons name={item.ativo ? 'pause' : 'play'} size={16} color={item.ativo ? '#FF9800' : '#4CAF50'} />
          <Text style={[styles.actionText, { color: item.ativo ? '#FF9800' : '#4CAF50' }]}>{item.ativo ? 'Desativar' : 'Ativar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
          <Ionicons name="trash" size={16} color="#F44336" />
          <Text style={[styles.actionText, { color: '#F44336' }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando setores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setores de Impressão</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/setores/cadastro' as any)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Buscar setores..." placeholderTextColor="#999" value={searchText} onChangeText={setSearchText} />
        {searchText.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <Ionicons name="print-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{searchText ? 'Nenhum setor encontrado' : 'Nenhum setor cadastrado'}</Text>
            {!searchText && (
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/setores/cadastro' as any)}>
                <Text style={styles.emptyButtonText}>Cadastrar Primeiro Setor</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#2196F3', flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  addButton: { padding: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  clearButton: { marginLeft: 8 },
  listContainer: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  name: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 4 },
  desc: { fontSize: 14, color: '#666' },
  meta: { fontSize: 12, color: '#666', marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeActive: { backgroundColor: '#E8F5E8' },
  badgeInactive: { backgroundColor: '#FFF3E0' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#333' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, flex: 1, marginHorizontal: 2, justifyContent: 'center' },
  editBtn: { backgroundColor: '#E3F2FD' },
  toggleBtn: { backgroundColor: '#F3E5F5' },
  deleteBtn: { backgroundColor: '#FFEBEE' },
  actionText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 16, marginBottom: 24 },
  emptyButton: { backgroundColor: '#2196F3', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  emptyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});