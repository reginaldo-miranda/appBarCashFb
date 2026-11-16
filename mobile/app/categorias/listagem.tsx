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
  Modal,
} from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { categoryService } from '../../src/services/api';

interface Category {
  id: number;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

export default function ListagemCategoriasScreen() {
  const { hasPermission } = useAuth() as any;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado para Modal de Inclusão / Edição rápida
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nomeForm, setNomeForm] = useState('');
  const [descricaoForm, setDescricaoForm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Verificar permissões
  useEffect(() => {
    if (!hasPermission('produtos')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta funcionalidade.');
      router.back();
    }
  }, [hasPermission]);

  useFocusEffect(
    useCallback(() => {
      if (hasPermission('produtos')) {
        loadCategories();
      }
    }, [hasPermission])
  );

  useEffect(() => {
    filterCategories();
  }, [searchText, categories]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryService.getAll();
      if (Array.isArray(response)) {
        setCategories(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      Alert.alert('Erro', 'Erro ao carregar categorias. Verifique sua conexão e tente novamente.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const filterCategories = () => {
    if (!searchText.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const q = searchText.toLowerCase();
    const filtered = categories.filter(category =>
      (category.nome && category.nome.toLowerCase().includes(q)) ||
      (category.descricao && category.descricao.toLowerCase().includes(q))
    );
    setFilteredCategories(filtered);
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setNomeForm('');
    setDescricaoForm('');
    setModalVisible(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setNomeForm(category.nome || '');
    setDescricaoForm(category.descricao || '');
    setModalVisible(true);
  };

  const handleSaveModal = async () => {
    const nomeLimpo = nomeForm.trim();
    if (!nomeLimpo) {
      if (Platform.OS === 'web') {
        window.alert('Informe o nome da categoria.');
      } else {
        Alert.alert('Atenção', 'Informe o nome da categoria.');
      }
      return;
    }

    try {
      setSubmitting(true);
      if (editingCategory) {
        await categoryService.update(editingCategory.id, {
          nome: nomeLimpo,
          descricao: descricaoForm.trim(),
        });
        showMessage('success', `Categoria "${nomeLimpo}" atualizada com sucesso!`);
      } else {
        await categoryService.create({
          nome: nomeLimpo,
          descricao: descricaoForm.trim(),
        });
        showMessage('success', `Categoria "${nomeLimpo}" cadastrada com sucesso!`);
      }
      await loadCategories();
      setModalVisible(false);
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      const msg = err?.response?.data?.error || 'Erro ao salvar categoria.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Erro', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (category: Category) => {
    const performDelete = async () => {
      try {
        await categoryService.delete(category.id);
        setCategories(prev => prev.filter(c => c.id !== category.id));
        showMessage('success', 'Categoria excluída com sucesso.');
      } catch (error: any) {
        console.error('Erro ao excluir categoria:', error);
        const errorMsg = error.response?.data?.error || 'Erro ao excluir categoria.';
        showMessage('error', errorMsg);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(`Tem certeza que deseja excluir a categoria "${category.nome}"?`)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      'Excluir Categoria',
      `Tem certeza que deseja excluir a categoria "${category.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: performDelete },
      ]
    );
  };

  const toggleStatus = (category: Category) => {
    const newStatus = !category.ativo;
    const action = newStatus ? 'ativar' : 'desativar';

    const performToggle = async () => {
      try {
        await categoryService.update(category.id, { ativo: newStatus });
        setCategories(prev => prev.map(c => 
          c.id === category.id ? { ...c, ativo: newStatus } : c
        ));
        showMessage('success', `Categoria ${newStatus ? 'ativada' : 'desativada'} com sucesso!`);
      } catch (error) {
        console.error('Erro ao alterar status da categoria:', error);
        showMessage('error', 'Erro ao alterar status da categoria.');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(`Deseja ${action} a categoria "${category.nome}"?`)) {
        performToggle();
      }
      return;
    }

    Alert.alert(
      'Alterar Status',
      `Deseja ${action} a categoria "${category.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: performToggle },
      ]
    );
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <View style={styles.categoryRow}>
      {/* Coluna da Esquerda: Nome e Descrição */}
      <View style={styles.categoryInfoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.categoryName} numberOfLines={1}>{item.nome}</Text>
          <View style={[styles.statusBadge, item.ativo ? styles.activeBadge : styles.inactiveBadge]}>
            <View style={[styles.statusDot, { backgroundColor: item.ativo ? '#16A34A' : '#D97706' }]} />
            <Text style={[styles.statusText, item.ativo ? styles.activeText : styles.inactiveText]}>
              {item.ativo ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
        </View>
        {!!item.descricao && (
          <Text style={styles.categoryDescription} numberOfLines={1}>
            {item.descricao}
          </Text>
        )}
      </View>

      {/* Coluna da Direita: Ações Compactas */}
      <View style={styles.categoryActionsCol}>
        <TouchableOpacity
          style={styles.actionBtnEdit}
          onPress={() => handleOpenEdit(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil" size={13} color="#2563EB" />
          <Text style={styles.actionBtnEditText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtnToggle, item.ativo ? styles.actionBtnTogglePause : styles.actionBtnTogglePlay]}
          onPress={() => toggleStatus(item)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={item.ativo ? "pause" : "play"} 
            size={12} 
            color={item.ativo ? "#B45309" : "#047857"} 
          />
          <Text style={[styles.actionBtnToggleText, { color: item.ativo ? "#B45309" : "#047857" }]}>
            {item.ativo ? 'Desativar' : 'Ativar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnDelete}
          onPress={() => handleDelete(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={13} color="#DC2626" />
          <Text style={styles.actionBtnDeleteText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!hasPermission('produtos')) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando categorias...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Oculta o cabeçalho padrão do Expo Router para eliminar o topo duplicado */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabeçalho Único e Moderno */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Categorias</Text>
              <Text style={styles.headerSubtitle}>
                {categories.length} categoria{categories.length === 1 ? '' : 's'} cadastrada{categories.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleOpenCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>+ Nova Categoria</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo Centralizado Responsivo */}
      <View style={styles.contentWrapper}>
        {message && (
          <View style={[styles.messageBanner, message.type === 'error' ? styles.errorBanner : styles.successBanner]}>
            <Ionicons 
              name={message.type === 'error' ? 'alert-circle' : 'checkmark-circle'} 
              size={18} 
              color={message.type === 'error' ? '#DC2626' : '#16A34A'} 
            />
            <Text style={[styles.messageText, { color: message.type === 'error' ? '#991B1B' : '#166534' }]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* Barra de Busca com Filtro */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou descrição..."
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchText('')}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Listagem de Categorias */}
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategoryItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {searchText ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchText ? 'Tente buscar com outro termo' : 'Cadastre sua primeira categoria para organizar os produtos.'}
              </Text>
              {!searchText && (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleOpenCreate}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Cadastrar Categoria</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>

      {/* Modal Rápido de Criação / Edição de Categoria */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          if (!submitting) setModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="pricetag" size={20} color="#2563EB" />
                <Text style={styles.modalTitle}>
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {editingCategory
                ? 'Atualize o nome e a descrição da categoria selecionada.'
                : 'Cadastre uma nova categoria para classificar seus produtos.'}
            </Text>

            <Text style={styles.fieldLabel}>Nome da Categoria *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Cervejas, Doses, Lanches, Pizzas..."
              value={nomeForm}
              onChangeText={setNomeForm}
              autoFocus={true}
              onSubmitEditing={handleSaveModal}
              returnKeyType="done"
              editable={!submitting}
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Descrição (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputDesc]}
              placeholder="Ex: Bebidas alcoólicas fermentadas em lata e garrafa..."
              value={descricaoForm}
              onChangeText={setDescricaoForm}
              multiline
              numberOfLines={2}
              editable={!submitting}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={submitting}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveModal}
                disabled={submitting}
                style={[styles.saveBtn, submitting && { backgroundColor: '#93C5FD' }]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Salvar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#1E293B',
    paddingTop: Platform.OS === 'web' ? 14 : 46,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentWrapper: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  clearButton: {
    padding: 2,
  },
  listContainer: {
    paddingBottom: 24,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryInfoCol: {
    flex: 1,
    minWidth: 180,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  inactiveBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeText: {
    color: '#16A34A',
  },
  inactiveText: {
    color: '#D97706',
  },
  categoryActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  actionBtnToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnTogglePause: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  actionBtnTogglePlay: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  actionBtnToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnDeleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  inputDesc: {
    height: 60,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
