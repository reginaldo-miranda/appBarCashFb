import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Dimensions,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { customerService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { SafeIcon } from '../../components/SafeIcon';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

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

export default function AdminClientesScreen() {
  const { hasPermission } = useAuth() as any;
  const params = useLocalSearchParams();
  const { autoOpen, returnTo } = params;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchText, setSearchText] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

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
    useCallback(() => {
      if (!hasPermission('clientes')) return;
      loadCustomers();
    }, [hasPermission])
  );

  useEffect(() => {
    if (!hasPermission('clientes')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }

    if (autoOpen === 'true') {
      resetForm();
      setModalVisible(true);
    }
  }, [autoOpen]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerService.getAll();
      setCustomers(Array.isArray(response?.data) ? response.data : []);
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
        const confirmBtn = buttons.find(
          (b: any) => b.style === 'destructive' || ['Excluir', 'Sim', 'Confirmar'].includes(b.text)
        );
        if (confirmBtn) {
          if (window.confirm(`${title}\n\n${message}`)) {
            if (confirmBtn.onPress) confirmBtn.onPress();
          } else {
            const cancelBtn = buttons.find((b: any) => b.style === 'cancel');
            if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
          }
        } else {
          window.alert(`${title}\n\n${message}`);
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
        safeAlert('Erro', 'Nome do cliente é obrigatório.');
        return;
      }

      const customerData: any = {
        ...formData,
        nome: formData.nome.trim(),
        fone: formData.fone.replace(/\D/g, ''),
        cpf: formData.cpf.replace(/\D/g, ''),
        cep: formData.cep.replace(/\D/g, ''),
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
      nome: customer.nome || '',
      endereco: customer.endereco || '',
      cidade: customer.cidade || '',
      estado: customer.estado || '',
      fone: customer.fone || '',
      cep: customer.cep || '',
      cpf: customer.cpf || '',
      email: customer.email || '',
      rg: customer.rg || '',
      dataNascimento: customer.dataNascimento
        ? new Date(customer.dataNascimento).toISOString().split('T')[0]
        : '',
      ativo: customer.ativo !== undefined ? customer.ativo : true,
      participaFidelidade:
        customer.participaFidelidade !== undefined ? customer.participaFidelidade : true,
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
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return clean;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (clean.length === 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return clean;
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro ? `${data.logradouro}, ${data.bairro || ''}` : prev.endereco,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      } else {
        safeAlert('Erro', 'CEP não encontrado no ViaCEP.');
      }
    } catch (e) {
      console.error('Erro na consulta do CEP:', e);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleOpenWhatsApp = (fone: string) => {
    const clean = fone.replace(/\D/g, '');
    if (!clean) return;
    const num = clean.startsWith('55') ? clean : `55${clean}`;
    Linking.openURL(`https://wa.me/${num}`).catch(() => {
      safeAlert('Aviso', 'Não foi possível abrir o WhatsApp');
    });
  };

  const filteredCustomers = useMemo(() => {
    const searchLower = searchText.toLowerCase().trim();
    const cleanSearchNum = searchText.replace(/\D/g, '');

    if (!searchLower && !cleanSearchNum) return customers;

    return customers.filter(customer => {
      const nomeMatch = customer.nome && customer.nome.toLowerCase().includes(searchLower);
      const emailMatch = customer.email && customer.email.toLowerCase().includes(searchLower);
      const cpfMatch = cleanSearchNum.length > 0 && customer.cpf && customer.cpf.includes(cleanSearchNum);
      const foneMatch = cleanSearchNum.length > 0 && customer.fone && customer.fone.includes(cleanSearchNum);

      return nomeMatch || emailMatch || cpfMatch || foneMatch;
    });
  }, [customers, searchText]);

  const renderCustomer = ({ item }: { item: Customer }) => (
    <View style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <View style={styles.customerAvatarBox}>
          <Text style={styles.customerAvatarText}>
            {(item.nome || 'C').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.customerHeaderInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.nome}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[styles.statusDot, { backgroundColor: item.ativo ? '#22C55E' : '#EF4444' }]} />
            <Text style={[styles.statusText, { color: item.ativo ? '#15803D' : '#B91C1C' }]}>
              {item.ativo ? 'Ativo' : 'Inativo'}
            </Text>
            {item.participaFidelidade && (
              <View style={styles.fidelidadeBadge}>
                <Ionicons name="sparkles" size={10} color="#D97706" />
                <Text style={styles.fidelidadeBadgeText}>Fidelidade</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.customerActions}>
          {item.fone ? (
            <TouchableOpacity
              style={styles.whatsAppButton}
              onPress={() => handleOpenWhatsApp(item.fone)}
              title="Abrir WhatsApp"
            >
              <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditCustomer(item)}
            title="Editar Cliente"
          >
            <SafeIcon name="pencil" size={17} color="#2563EB" fallbackText="✎" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCustomer(item)}
            title="Excluir Cliente"
          >
            <SafeIcon name="trash" size={17} color="#EF4444" fallbackText="🗑" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.customerDetailsList}>
        {item.fone ? (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={13} color="#64748B" />
            <Text style={styles.detailText}>{formatPhone(item.fone)}</Text>
          </View>
        ) : null}

        {item.email ? (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={13} color="#64748B" />
            <Text style={styles.detailText} numberOfLines={1}>{item.email}</Text>
          </View>
        ) : null}

        {item.cpf ? (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={13} color="#64748B" />
            <Text style={styles.detailText}>CPF: {formatCPF(item.cpf)}</Text>
          </View>
        ) : null}

        {item.endereco ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.endereco}
              {item.cidade ? `, ${item.cidade}` : ''}
              {item.estado ? ` - ${item.estado}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Badges de Saldo Cashback e Pontos */}
      <View style={styles.cashbackContainer}>
        <View style={styles.cashbackBadge}>
          <Ionicons name="gift-outline" size={13} color="#15803D" />
          <Text style={styles.cashbackText}>
            Cashback: <Text style={{ fontWeight: 'bold' }}>R$ {item.saldoCashback ? Number(item.saldoCashback).toFixed(2) : '0.00'}</Text>
          </Text>
        </View>

        <View style={styles.pontosBadge}>
          <Ionicons name="star-outline" size={13} color="#B45309" />
          <Text style={styles.pontosText}>
            Pontos: <Text style={{ fontWeight: 'bold' }}>{item.pontos || 0}</Text>
          </Text>
        </View>
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

  const isNomeMissing = !formData.nome.trim();

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Clientes" />

      {/* Header com busca, contagem e botão Novo Cliente */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerMainTitle}>Gerenciar Clientes</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, CPF ou telefone..."
              placeholderTextColor="#94A3B8"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} style={{ padding: 2 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>
              {isLargeScreen ? 'Novo Cliente' : 'Novo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de clientes */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando clientes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id.toString()}
          numColumns={isLargeScreen ? 2 : 1}
          key={isLargeScreen ? 'cols_2' : 'cols_1'}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>Nenhum cliente encontrado</Text>
            </View>
          }
        />
      )}

      {/* Modal Otimizado de Criação / Edição */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Topo do Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalHeaderIconBox}>
                  <Ionicons name="person" size={17} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                  </Text>
                  <Text style={styles.modalSubTitle}>
                    Preencha os dados de contato e fidelidade
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Conteúdo em 2 Colunas no Desktop/Tablet */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.formGrid, isLargeScreen && { flexDirection: 'row' }]}>
                {/* ── COLUNA ESQUERDA: Identificação & Fidelidade ── */}
                <View style={[styles.columnBox, isLargeScreen && { flex: 1 }]}>
                  {/* Card Identificação */}
                  <View style={styles.subCard}>
                    <Text style={styles.subCardTitle}>Identificação Pessoal</Text>

                    {/* Nome Completo */}
                    <View style={styles.inputGroup}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.labelCompact, isNomeMissing && styles.labelRequired]}>
                          Nome Completo *
                        </Text>
                        {isNomeMissing && <Text style={styles.requiredTag}>Obrigatório</Text>}
                      </View>
                      <TextInput
                        style={[styles.inputCompact, isNomeMissing && styles.inputRequired]}
                        value={formData.nome}
                        onChangeText={(text) => setFormData({ ...formData, nome: text })}
                        placeholder="Ex: João da Silva"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    {/* CPF e RG lado a lado */}
                    <View style={styles.row}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                        <Text style={styles.labelCompact}>CPF</Text>
                        <TextInput
                          style={styles.inputCompact}
                          value={formData.cpf}
                          onChangeText={(text) => setFormData({ ...formData, cpf: text.replace(/\D/g, '') })}
                          placeholder="000.000.000-00"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={14}
                        />
                      </View>

                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                        <Text style={styles.labelCompact}>RG</Text>
                        <TextInput
                          style={styles.inputCompact}
                          value={formData.rg}
                          onChangeText={(text) => setFormData({ ...formData, rg: text })}
                          placeholder="00.000.000-0"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    {/* Data de Nascimento */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.labelCompact}>Data de Nascimento</Text>
                      <TextInput
                        style={styles.inputCompact}
                        value={formData.dataNascimento}
                        onChangeText={(text) => setFormData({ ...formData, dataNascimento: text })}
                        placeholder="AAAA-MM-DD"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* Card Switches de Fidelidade & Status */}
                  <View style={styles.subCard}>
                    <Text style={styles.subCardTitle}>Status & Programa de Fidelidade</Text>

                    <View style={styles.switchBox}>
                      <View style={styles.switchOption}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.switchOptionTitle}>Cliente Ativo</Text>
                          <Text style={styles.switchOptionSub}>Permite realizar pedidos e comandas</Text>
                        </View>
                        <Switch
                          value={formData.ativo}
                          onValueChange={(val) => setFormData({ ...formData, ativo: val })}
                          trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                          thumbColor="#fff"
                        />
                      </View>

                      <View style={[styles.switchOption, { borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 8, marginTop: 8 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.switchOptionTitle}>Participa do Cashback</Text>
                          <Text style={styles.switchOptionSub}>Acumula bônus em cada compra</Text>
                        </View>
                        <Switch
                          value={formData.participaFidelidade}
                          onValueChange={(val) => setFormData({ ...formData, participaFidelidade: val })}
                          trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>

                    {editingCustomer && (
                      <View style={styles.summaryStatsRow}>
                        <View style={[styles.statPill, { backgroundColor: '#DCFCE7' }]}>
                          <Ionicons name="gift" size={13} color="#15803D" />
                          <Text style={[styles.statPillText, { color: '#15803D' }]}>
                            Cashback: R$ {editingCustomer.saldoCashback ? Number(editingCustomer.saldoCashback).toFixed(2) : '0.00'}
                          </Text>
                        </View>
                        <View style={[styles.statPill, { backgroundColor: '#FEF3C7' }]}>
                          <Ionicons name="star" size={13} color="#B45309" />
                          <Text style={[styles.statPillText, { color: '#B45309' }]}>
                            Pontos: {editingCustomer.pontos || 0}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* ── COLUNA DIREITA: Contato & Endereço ── */}
                <View style={[styles.columnBox, isLargeScreen && { flex: 1 }]}>
                  {/* Card Contato */}
                  <View style={styles.subCard}>
                    <Text style={styles.subCardTitle}>Contato</Text>

                    <View style={styles.row}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                        <Text style={styles.labelCompact}>Telefone / WhatsApp</Text>
                        <TextInput
                          style={styles.inputCompact}
                          value={formData.fone}
                          onChangeText={(text) => setFormData({ ...formData, fone: text.replace(/\D/g, '') })}
                          placeholder="(00) 00000-0000"
                          placeholderTextColor="#94A3B8"
                          keyboardType="phone-pad"
                          maxLength={15}
                        />
                      </View>

                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                        <Text style={styles.labelCompact}>E-mail</Text>
                        <TextInput
                          style={styles.inputCompact}
                          value={formData.email}
                          onChangeText={(text) => setFormData({ ...formData, email: text })}
                          placeholder="email@exemplo.com"
                          placeholderTextColor="#94A3B8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Card Endereço com Busca de CEP */}
                  <View style={styles.subCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.subCardTitle}>Endereço & Localização</Text>
                      {loadingCep && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ActivityIndicator size="small" color="#0284C7" />
                          <Text style={{ fontSize: 11, color: '#0284C7' }}>Buscando CEP...</Text>
                        </View>
                      )}
                    </View>

                    {/* CEP com Busca Automática */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.labelCompact}>CEP (digite para autocompletar)</Text>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <TextInput
                          style={[styles.inputCompact, { flex: 1 }]}
                          value={formData.cep}
                          onChangeText={(text) => {
                            const newCep = text.replace(/\D/g, '').slice(0, 8);
                            setFormData({ ...formData, cep: newCep });
                            if (newCep.length === 8) fetchAddressByCep(newCep);
                          }}
                          placeholder="00000-000"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={9}
                        />
                        <TouchableOpacity
                          style={styles.cepSearchBtn}
                          onPress={() => fetchAddressByCep(formData.cep)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="search" size={13} color="#0284C7" />
                          <Text style={styles.cepSearchBtnText}>ViaCEP</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Endereço */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.labelCompact}>Endereço (Rua, Número, Bairro)</Text>
                      <TextInput
                        style={styles.inputCompact}
                        value={formData.endereco}
                        onChangeText={(text) => setFormData({ ...formData, endereco: text })}
                        placeholder="Ex: Av. Brasil, 123 - Apto 4"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    {/* Cidade e Estado lado a lado */}
                    <View style={styles.row}>
                      <View style={[styles.inputGroup, { flex: 2, marginRight: 6 }]}>
                        <Text style={styles.labelCompact}>Cidade</Text>
                        <TextInput
                          style={styles.inputCompact}
                          value={formData.cidade}
                          onChangeText={(text) => setFormData({ ...formData, cidade: text })}
                          placeholder="Cidade"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                        <Text style={styles.labelCompact}>Estado (UF)</Text>
                        <TextInput
                          style={styles.inputCompact}
                          value={formData.estado}
                          onChangeText={(text) => setFormData({ ...formData, estado: text.toUpperCase() })}
                          placeholder="UF"
                          placeholderTextColor="#94A3B8"
                          maxLength={2}
                          autoCapitalize="characters"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Rodapé de Ações */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, isNomeMissing && { opacity: 0.6 }]}
                onPress={handleSaveCustomer}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {editingCustomer ? 'Atualizar Cliente' : 'Salvar Cliente'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    flexDirection: isLargeScreen ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: isLargeScreen ? 'center' : 'stretch',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerMainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: isLargeScreen ? undefined : 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    height: 38,
    width: isLargeScreen ? 280 : undefined,
    flex: isLargeScreen ? undefined : 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listContainer: {
    padding: 12,
    gap: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  customerCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: isLargeScreen ? 5 : 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  customerAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1D4ED8',
  },
  customerHeaderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fidelidadeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  fidelidadeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B45309',
  },
  customerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  whatsAppButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
  },
  editButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  customerDetailsList: {
    gap: 4,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  cashbackContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  cashbackBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cashbackText: {
    fontSize: 11.5,
    color: '#15803D',
  },
  pontosBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pontosText: {
    fontSize: 11.5,
    color: '#B45309',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 12,
  },
  accessDeniedSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },

  // Estilos do Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    width: '100%',
    maxWidth: 780,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubTitle: {
    fontSize: 11,
    color: '#64748B',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalContent: {
    padding: 14,
  },
  formGrid: {
    gap: 12,
  },
  columnBox: {
    gap: 12,
  },
  subCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  subCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputGroup: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 3,
  },
  labelRequired: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  requiredTag: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inputCompact: {
    height: 34,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  inputRequired: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  cepSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 6,
  },
  cepSearchBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  switchBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  switchOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchOptionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  switchOptionSub: {
    fontSize: 10,
    color: '#64748B',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statPillText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
