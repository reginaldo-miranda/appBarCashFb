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
import { typeService } from '../../src/services/api';

interface Type {
  id: number;
  nome: string;
  descricao?: string;
  ativo: boolean;
  categoria: string;
}

export default function ListagemTiposScreen() {
  const { hasPermission } = useAuth() as any;
  const [types, setTypes] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredTypes, setFilteredTypes] = useState<Type[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const loadTypes = async () => {
    try {
      setLoading(true);
      const response = await typeService.getAll();
      
      // A API retorna os dados diretamente como array
      if (Array.isArray(response)) {
        setTypes(response);
      } else if (response.data && Array.isArray(response.data)) {
        setTypes(response.data);
      } else {
        console.log('Resposta da API:', response);
        setTypes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar tipos:', error);
      Alert.alert('Erro', 'Erro ao carregar tipos. Verifique sua conexão e tente novamente.');
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTypes();
    setRefreshing(false);
  };

  const filterTypes = () => {
    if (!searchText.trim()) {
      setFilteredTypes(types);
      return;
    }

    const filtered = types.filter(type =>
      type.nome.toLowerCase().includes(searchText.toLowerCase()) ||
      (type.descricao && type.descricao.toLowerCase().includes(searchText.toLowerCase()))
    );
    setFilteredTypes(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      if (hasPermission('produtos')) {
        loadTypes();
      }
    }, [hasPermission])
  );

  useEffect(() => {
    filterTypes();
  }, [searchText, types]);

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

  const handleEdit = (type: Type) => {
    router.push(`/tipos/cadastro?id=${type.id}` as any);
  };

  const handleDelete = (type: Type) => {
    const performDelete = async () => {
        try {
            await typeService.delete(type.id);
            setTypes(prev => prev.filter(t => t.id !== type.id));
            showMessage('success', 'Tipo excluído com sucesso.');
          } catch (error: any) {
            console.error('Erro ao excluir tipo:', error);
            const errorMsg = error.response?.data?.error || 'Erro ao excluir tipo.';
            showMessage('error', errorMsg);
          }
    };

    if (Platform.OS === 'web') {
        if (confirm(`Tem certeza que deseja excluir o tipo "${type.nome}"?`)) {
            performDelete();
        }
        return;
    }
    
    Alert.alert(
      'Excluir Tipo',
      `Tem certeza que deseja excluir o tipo "${type.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: performDelete },
      ]
    );
  };

  const toggleStatus = (type: Type) => {
    const newStatus = !type.ativo;
    const action = newStatus ? 'ativar' : 'desativar';

    const performToggle = async () => {
         try {
            await typeService.update(type.id, { ativo: newStatus });
            setTypes(prev => prev.map(t => 
              t.id === type.id ? { ...t, ativo: newStatus } : t
            ));
            showMessage('success', `Tipo ${newStatus ? 'ativado' : 'desativado'} com sucesso!`);
          } catch (error) {
            console.error('Erro ao alterar status:', error);
            showMessage('error', 'Erro ao alterar status do tipo.');
          }
    };

    if (Platform.OS === 'web') {
        if (confirm(`Deseja ${action} o tipo "${type.nome}"?`)) {
            performToggle();
        }
        return;
    }
    
    Alert.alert(
      'Alterar Status',
      `Deseja ${action} o tipo "${type.nome}"?`,
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

  const renderTypeItem = ({ item }: { item: Type }) => (
    <View style={styles.typeItem}>
      <View style={styles.typeHeader}>
        <View style={styles.typeInfo}>
          <Text style={styles.typeName}>{item.nome}</Text>
          {item.descricao && <Text style={styles.typeDescription}>{item.descricao}</Text>}
        </View>
        <View style={[styles.statusBadge, item.ativo ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, item.ativo ? styles.activeText : styles.inactiveText]}>
            {item.ativo ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>
      
      <View style={styles.typeActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil" size={16} color="#FF9800" />
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
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Carregando tipos...</Text>
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
        <Text style={styles.headerTitle}>Tipos</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/tipos/cadastro' as any)}
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
          placeholder="Buscar tipos..."
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
        data={filteredTypes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderTypeItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchText ? 'Nenhum tipo encontrado' : 'Nenhum tipo cadastrado'}
            </Text>
            {!searchText && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/tipos/cadastro' as any)}
              >
                <Text style={styles.emptyButtonText}>Cadastrar Primeiro Tipo</Text>
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
    backgroundColor: '#FF9800',
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
  typeItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  typeInfo: {
    flex: 1,
    marginRight: 12,
  },
  typeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  typeDescription: {
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
  typeActions: {
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
    backgroundColor: '#FFF3E0',
  },
  editButtonText: {
    color: '#FF9800',
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
    backgroundColor: '#FF9800',
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