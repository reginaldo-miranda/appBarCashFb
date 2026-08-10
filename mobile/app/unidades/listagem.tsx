import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { unidadeMedidaService } from '../../src/services/api';

interface Unit {
  id: number;
  nome: string;
  sigla: string;
  descricao?: string;
  ativo: boolean;
  dataInclusao: string;
}

export default function ListagemUnidadesScreen() {
  const { hasPermission } = useAuth() as any;
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (hasPermission('produtos')) {
        loadUnits();
      }
    }, [hasPermission])
  );

  useEffect(() => {
    filterUnits();
  }, [searchText, units]);

  // Verificar permissões
  if (!hasPermission('produtos')) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color="#666" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Você não tem permissão para acessar esta tela
        </Text>
      </View>
    );
  }

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await unidadeMedidaService.getAll();
      
      // Verificar se a resposta é um array ou se está em response.data
      if (Array.isArray(response)) {
        setUnits(response);
      } else if (Array.isArray(response.data)) {
        setUnits(response.data);
      } else {
        console.log('Resposta da API de unidades:', response);
        setUnits([]);
      }
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
      Alert.alert('Erro', 'Erro ao carregar unidades de medida');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUnits();
    setRefreshing(false);
  };

  const filterUnits = () => {
    if (!searchText.trim()) {
      setFilteredUnits(units);
      return;
    }

    const filtered = units.filter(unit =>
      unit.nome.toLowerCase().includes(searchText.toLowerCase()) ||
      unit.sigla.toLowerCase().includes(searchText.toLowerCase()) ||
      (unit.descricao && unit.descricao.toLowerCase().includes(searchText.toLowerCase()))
    );
    setFilteredUnits(filtered);
  };

  const handleEdit = (unit: Unit) => {
    router.push(`/unidades/cadastro?id=${unit.id}` as any);
  };

  const handleDelete = async (unit: Unit) => {
    const performDelete = async () => {
        try {
            await unidadeMedidaService.delete(unit.id);
            setUnits(prev => prev.filter(u => u.id !== unit.id));
            setFilteredUnits(prev => prev.filter(u => u.id !== unit.id));
            showMessage('success', 'Unidade excluída com sucesso!');
          } catch (error) {
            console.error('Erro ao excluir unidade:', error);
            showMessage('error', 'Não foi possível excluir a unidade.');
          }
    };

    if (Platform.OS === 'web') {
        if (confirm(`Tem certeza que deseja excluir a unidade "${unit.nome}"?`)) {
            performDelete();
        }
        return;
    }

    Alert.alert(
      'Excluir Unidade',
      `Tem certeza que deseja excluir a unidade "${unit.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: performDelete },
      ]
    );
  };

  const toggleStatus = async (unit: Unit) => {
    const newStatus = !unit.ativo;
    const action = newStatus ? 'ativar' : 'desativar';
    
    const performToggle = async () => {
         try {
            await unidadeMedidaService.update(unit.id, { ativo: newStatus });
            setUnits(prev => prev.map(u => (u.id === unit.id ? { ...u, ativo: newStatus } : u)));
            setFilteredUnits(prev => prev.map(u => (u.id === unit.id ? { ...u, ativo: newStatus } : u)));
            showMessage('success', `Unidade ${newStatus ? 'ativada' : 'desativada'} com sucesso!`);
          } catch (error) {
            console.error('Erro ao alterar status da unidade:', error);
            showMessage('error', `Não foi possível ${action} a unidade.`);
          }
    };

    if (Platform.OS === 'web') {
        if (confirm(`Deseja ${action} a unidade "${unit.nome}"?`)) {
            performToggle();
        }
        return;
    }
    
    Alert.alert(
      'Alterar Status',
      `Deseja ${action} a unidade "${unit.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: performToggle },
      ]
    );
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const renderUnitItem = ({ item }: { item: Unit }) => (
    <View style={styles.unitItem}>
      <View style={styles.unitHeader}>
        <View style={styles.unitInfo}>
          <View style={styles.unitNameRow}>
            <Text style={styles.unitName}>{item.nome}</Text>
            <View style={styles.siglaBadge}>
              <Text style={styles.siglaText}>{item.sigla}</Text>
            </View>
          </View>
          {item.descricao && <Text style={styles.unitDescription}>{item.descricao}</Text>}
        </View>
        <View style={[styles.statusBadge, item.ativo ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, item.ativo ? styles.activeText : styles.inactiveText]}>
            {item.ativo ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>
      
      <View style={styles.unitActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil" size={16} color="#9C27B0" />
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => toggleStatus(item)}
        >
          <Ionicons 
            name={item.ativo ? "pause" : "play"} 
            size={16} 
            color={item.ativo ? "#FF9800" : "#4CAF50"} 
          />
          <Text style={[styles.toggleButtonText, { color: item.ativo ? "#FF9800" : "#4CAF50" }]}>
            {item.ativo ? 'Desativar' : 'Ativar'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={16} color="#F44336" />
          <Text style={styles.deleteButtonText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C27B0" />
        <Text style={styles.loadingText}>Carregando unidades...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unidades de Medida</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/unidades/cadastro' as any)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      {message && (
        <View style={[styles.messageBanner, message.type === 'error' ? styles.errorBanner : styles.successBanner]}>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar unidades..."
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={filteredUnits}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderUnitItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchText ? 'Nenhuma unidade encontrada' : 'Nenhuma unidade cadastrada'}
            </Text>
            {!searchText && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/unidades/cadastro' as any)}
              >
                <Text style={styles.emptyButtonText}>Cadastrar Primeira Unidade</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#9C27B0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  unitItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  unitInfo: {
    flex: 1,
    marginRight: 12,
  },
  unitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  unitName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  siglaBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  siglaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  unitDescription: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#E8F5E8',
  },
  inactiveBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#4CAF50',
  },
  inactiveText: {
    color: '#FF9800',
  },
  unitActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#F3E5F5',
  },
  editButtonText: {
    color: '#9C27B0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  toggleButton: {
    backgroundColor: '#F3E5F5',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  messageBanner: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  successBanner: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  messageText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});