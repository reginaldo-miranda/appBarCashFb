import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';

import { customerService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { SafeIcon } from '../../components/SafeIcon';

interface Customer {
  id: number;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  fone: string;
  cep?: string;
  cpf: string;
  email?: string;
  rg: string;
  dataNascimento: Date;
  ativo: boolean;
  participaFidelidade?: boolean;
  saldoCashback?: number;
  pontos?: number;
  dataInclusao: Date;
}

import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

// ... existing imports ...

export default function AdminClientesScreen() {
  const { hasPermission } = useAuth() as any;
  const params = useLocalSearchParams();
  const { autoOpen, returnTo } = params;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchText, setSearchText] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    endereco: '',
    cidade: '',
    estado: '',
    fone: '',
    cep: '',
    cpf: '',
    email: '',
    rg: '',
    dataNascimento: '',
    ativo: true,
    participaFidelidade: true,
  });

  // Refresh info on focus
  useFocusEffect(
    React.useCallback(() => {
        if (!hasPermission('clientes')) return;
        loadCustomers();
    }, [hasPermission])
  );

  useEffect(() => {
    if (!hasPermission('clientes')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }
    // loadCustomers(); // Handled by useFocusEffect
    
    if (autoOpen === 'true') {
        resetForm();
        setModalVisible(true);
    }
  }, [autoOpen]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerService.getAll();
      setCustomers(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      Alert.alert('Erro', 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Helper para alertas compatíveis com Web
  const safeAlert = (title: string, message: string, buttons?: any[]) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 0) {
        // Simulação simples de confirmation para web
        // Procura botão com style 'destructive' ou text 'Excluir/Sim/Confirmar'
        const confirmBtn = buttons.find((b: any) => b.style === 'destructive' || ['Excluir', 'Sim', 'Confirmar'].includes(b.text));
        if (confirmBtn) {
          if (window.confirm(`${title}\n\n${message}`)) {
            if (confirmBtn.onPress) confirmBtn.onPress();
          } else {
             const cancelBtn = buttons.find((b: any) => b.style === 'cancel');
             if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
          }
        } else {
          // Apenas alerta
          window.alert(`${title}\n\n${message}`);
          // Se tiver botão OK/Default, chama
          const okBtn = buttons.find((b: any) => !b.style || b.style === 'default');
          if (okBtn && okBtn.onPress) okBtn.onPress();
        }
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleSaveCustomer = async () => {
    try {
      if (!formData.nome.trim()) {
        safeAlert('Erro', 'Nome é obrigatório');
        return;
      }

      const customerData = {
        ...formData,
        // Enviar null se string vazia para limpar data, ou undefined se não alterado (mas aqui estamos editando tudo)
        // Prisma geralmente aceita null para limpar.
        dataNascimento: formData.dataNascimento ? new Date(formData.dataNascimento) : null,
      };

      if (editingCustomer) {
        await customerService.update(editingCustomer.id, customerData);
        safeAlert('Sucesso', 'Cliente atualizado com sucesso');
      } else {
        await customerService.create(customerData);
        safeAlert('Sucesso', 'Cliente criado com sucesso');
      }

      setModalVisible(false);
      resetForm();
      const currentSort = customers; // dummy usage if needed, or better:
      loadCustomers().then(() => {
         if (returnTo) {
             router.back();
         }
      });
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao salvar cliente';
      safeAlert('Erro', errorMessage);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      nome: customer.nome,
      endereco: customer.endereco || '',
      cidade: customer.cidade || '',
      estado: customer.estado || '',
      fone: customer.fone || '',
      cep: customer.cep || '',
      cpf: customer.cpf || '',
      email: customer.email || '',
      rg: customer.rg || '',
      dataNascimento: customer.dataNascimento ? 
        new Date(customer.dataNascimento).toISOString().split('T')[0] : '',
      ativo: customer.ativo,
      participaFidelidade: customer.participaFidelidade !== undefined ? customer.participaFidelidade : true,
    });
    setModalVisible(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    safeAlert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o cliente "${customer.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await customerService.delete(customer.id);
              // Pequeno delay para garantir que o alert feche antes de tentar abrir outro (bug comum)
              setTimeout(() => {
                  safeAlert('Sucesso', 'Cliente excluído com sucesso');
                  loadCustomers();
              }, 100);
            } catch (error: any) {
              console.error('Erro ao excluir cliente:', error);
              safeAlert('Erro', 'Erro ao excluir cliente');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      endereco: '',
      cidade: '',
      estado: '',
      fone: '',
      cep: '',
      cpf: '',
      email: '',
      rg: '',
      dataNascimento: '',
      ativo: true,
      participaFidelidade: true,
    });
    setEditingCustomer(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  };

  const fetchAddressByCep = async (cep: string) => {
      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length !== 8) return;
      
      try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await response.json();
          if (!data.erro) {
              setFormData(prev => ({
                  ...prev,
                  endereco: data.logradouro ? `${data.logradouro}, ${data.bairro}` : prev.endereco,
                  cidade: data.localidade || prev.cidade,
                  estado: data.uf || prev.estado
              }));
          } else {
              if (Platform.OS === 'web') window.alert('CEP não encontrado');
              else safeAlert('Erro', 'CEP não encontrado');
          }
      } catch (e) {
          console.error(e);
      }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchText.toLowerCase();
    const cleanSearchNum = searchText.replace(/\D/g, '');
    
    return (
        (customer.nome && customer.nome.toLowerCase().includes(searchLower)) ||
        (cleanSearchNum.length > 0 && customer.cpf && customer.cpf.includes(cleanSearchNum)) ||
        (cleanSearchNum.length > 0 && customer.fone && customer.fone.includes(cleanSearchNum))
    );
  });

  const renderCustomer = ({ item }: { item: Customer }) => (
    <View style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>{item.nome}</Text>
        <View style={styles.customerActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditCustomer(item)}
          >
            <SafeIcon name="pencil" size={20} color="#2196F3" fallbackText="✎" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCustomer(item)}
          >
            <SafeIcon name="trash" size={20} color="#f44336" fallbackText="🗑" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.customerInfo}>
        {item.fone && (
          <View style={styles.infoRow}>
            <SafeIcon name="call" size={16} color="#666" fallbackText="📞" />
            <Text style={styles.infoText}>{formatPhone(item.fone)}</Text>
          </View>
        )}
        
        {item.email && (
          <View style={styles.infoRow}>
            <SafeIcon name="mail" size={16} color="#666" fallbackText="✉️" />
            <Text style={styles.infoText}>{item.email}</Text>
          </View>
        )}
        
        {item.cpf && (
          <View style={styles.infoRow}>
            <SafeIcon name="card" size={16} color="#666" fallbackText="💳" />
            <Text style={styles.infoText}>CPF: {formatCPF(item.cpf)}</Text>
          </View>
        )}
        
        {item.endereco && (
          <View style={styles.infoRow}>
            <SafeIcon name="location" size={16} color="#666" fallbackText="📍" />
            <Text style={styles.infoText}>
              {item.endereco}
              {item.cidade && `, ${item.cidade}`}
              {item.estado && ` - ${item.estado}`}
            </Text>
          </View>
        )}
        
        {item.dataNascimento && (
          <View style={styles.infoRow}>
            <SafeIcon name="calendar" size={16} color="#666" fallbackText="📅" />
            <Text style={styles.infoText}>
              Nascimento: {formatDate(item.dataNascimento)}
            </Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <SafeIcon name="time" size={16} color="#666" fallbackText="⏱" />
          <Text style={styles.infoText}>
            Cliente desde: {formatDate(item.dataInclusao)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <View style={[styles.infoRow, { backgroundColor: '#E8F5E9', padding: 4, borderRadius: 4, flex: 1 }]}>
               <SafeIcon name="gift" size={16} color="#2E7D32" fallbackText="🎁" />
               <Text style={[styles.infoText, { color: '#2E7D32', fontWeight: 'bold' }]}>
                 R$ {item.saldoCashback ? Number(item.saldoCashback).toFixed(2) : '0.00'}
               </Text>
            </View>
            <View style={[styles.infoRow, { backgroundColor: '#FFF3E0', padding: 4, borderRadius: 4, flex: 1 }]}>
               <SafeIcon name="star" size={16} color="#EF6C00" fallbackText="⭐" />
               <Text style={[styles.infoText, { color: '#EF6C00', fontWeight: 'bold' }]}>
                 Pts: {item.pontos || 0}
               </Text>
            </View>
        </View>
      </View>
      
      <View style={styles.customerStatus}>
        <Text style={[styles.statusText, { color: item.ativo ? '#4CAF50' : '#f44336' }]}>
          {item.ativo ? 'Ativo' : 'Inativo'}
        </Text>
      </View>
    </View>
  );

  if (!hasPermission('clientes')) {
    return (
      <View style={styles.accessDenied}>
        <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Você não tem permissão para gerenciar clientes
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Clientes" />
      {/* Header com busca e botão adicionar */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <SafeIcon name="search" size={20} color="#666" fallbackText="🔍" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar clientes..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <SafeIcon name="add" size={24} color="#fff" fallbackText="+" />
        </TouchableOpacity>
      </View>

      {/* Lista de clientes */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando clientes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de criação/edição */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
            </Text>
            <TouchableOpacity onPress={handleSaveCustomer}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.nome}
                onChangeText={(text) => setFormData({ ...formData, nome: text })}
                placeholder="Nome completo"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>CPF</Text>
                <TextInput
                  style={styles.input}
                  value={formData.cpf}
                  onChangeText={(text) => setFormData({ ...formData, cpf: text.replace(/\D/g, '') })}
                  placeholder="000.000.000-00"
                  keyboardType="numeric"
                  maxLength={11}
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>RG</Text>
                <TextInput
                  style={styles.input}
                  value={formData.rg}
                  onChangeText={(text) => setFormData({ ...formData, rg: text })}
                  placeholder="00.000.000-0"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={formData.fone}
                  onChangeText={(text) => setFormData({ ...formData, fone: text.replace(/\D/g, '') })}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  maxLength={11}
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="email@exemplo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Data de Nascimento</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dataNascimento}
                  onChangeText={(text) => setFormData({ ...formData, dataNascimento: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>CEP</Text>
              <TextInput
                style={styles.input}
                value={formData.cep}
                onChangeText={(text) => {
                    const newCep = text.replace(/\D/g, '').slice(0, 8);
                    setFormData({ ...formData, cep: newCep });
                    if (newCep.length === 8) fetchAddressByCep(newCep);
                }}
                placeholder="00000-000"
                keyboardType="numeric"
                maxLength={9}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Endereço</Text>
              <TextInput
                style={styles.input}
                value={formData.endereco}
                onChangeText={(text) => setFormData({ ...formData, endereco: text })}
                placeholder="Rua, número, complemento"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Cidade</Text>
                <TextInput
                  style={styles.input}
                  value={formData.cidade}
                  onChangeText={(text) => setFormData({ ...formData, cidade: text })}
                  placeholder="Cidade"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Estado</Text>
                <TextInput
                  style={styles.input}
                  value={formData.estado}
                  onChangeText={(text) => setFormData({ ...formData, estado: text.toUpperCase() })}
                  placeholder="UF"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.switchContainer}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Cliente Ativo</Text>
                <Switch
                  value={formData.ativo}
                  onValueChange={(value) => setFormData({ ...formData, ativo: value })}
                  trackColor={{ false: '#ccc', true: '#2196F3' }}
                />
              </View>


              <View style={styles.switchRow}>
                <Text style={styles.label}>Participa Fidelidade</Text>
                <Switch
                  value={formData.participaFidelidade}
                  onValueChange={(value) => setFormData({ ...formData, participaFidelidade: value })}
                  trackColor={{ false: '#ccc', true: '#FF9800' }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#2196F3',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  customerActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  customerInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  customerStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  switchContainer: {
    marginTop: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
});