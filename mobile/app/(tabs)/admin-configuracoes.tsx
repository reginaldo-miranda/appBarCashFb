import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';


import { SafeIcon } from '../../components/SafeIcon';
import { employeeService, userService, companyService, idleTimeConfigService, roleService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';

interface Employee {
  _id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

interface UserPermissions {
  _id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'funcionario';
  roleId?: number;
  role?: { nome: string };
  funcionario?: Employee;
  permissoes: {
    produtos: boolean;
    funcionarios: boolean;
    clientes: boolean;
    vendas: boolean;
    relatorios: boolean;
    configuracoes: boolean;
  };
  ativo: boolean;
}

export default function AdminConfiguracoesScreen() {
  const { isAdmin, user } = useAuth() as any;
  const [users, setUsers] = useState<UserPermissions[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
  
  // States para Cadastro de Empresa
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [companyData, setCompanyData] = useState<any>({});
  const [loadingCompany, setLoadingCompany] = useState(false);
  
  // Roles
  // Roles & Employees
  const [rolesList, setRolesList] = useState<any[]>([]); 
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  
  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // States para Controle de Cores (Tempo sem consumo)
  const [idleTimeModalVisible, setIdleTimeModalVisible] = useState(false);
  const [idleConfig, setIdleConfig] = useState<any>({
    ativo: false,
    usarHoraInclusao: true,
    estagios: [
      { tempo: "00:15:00", cor: "#FFFF00" },
      { tempo: "00:30:00", cor: "#FFA500" },
      { tempo: "00:45:00", cor: "#FF4500" },
      { tempo: "01:00:00", cor: "#FF0000" },
    ]
  });
  const [loadingIdleConfig, setLoadingIdleConfig] = useState(false);

  const navigation = useNavigation();

  useEffect(() => {
    if (!isAdmin()) {
      Alert.alert('Acesso Negado', 'Apenas administradores podem acessar as configurações');
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAll();
      setUsers(Array.isArray(response) ? response : (response?.data ?? []));
      
      // Load Roles
      loadRoles();
      
      // Load Employees
      const emps = await employeeService.getAll();
      setEmployeesList(emps.data || []);
      
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      Alert.alert('Erro', 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
      try {
          const res = await roleService.getAll();
          setRolesList(res);
      } catch (e) {
          console.error('Erro roles', e);
      }
  };

  const loadCompany = async () => {
    try {
      setLoadingCompany(true);
      const response = await companyService.get();
      setCompanyData(response.data || {});
      setCompanyModalVisible(true);
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados da empresa');
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleSaveCompany = async () => {
    try {
      setLoadingCompany(true);
      await companyService.save(companyData);
      
      const msg = 'Dados da empresa salvos com sucesso!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Sucesso', msg);

      setCompanyModalVisible(false);
    } catch (error: any) {
      console.error('Erro ao salvar empresa:', error);
      // Extrair mensagem real do erro
      const errorMsg = error.response?.data?.error || error.message || 'Erro desconhecido';
      const msg = `Não foi possível salvar: ${errorMsg}`;
      
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Erro', msg);
    } finally {

      setLoadingCompany(false);
    }
  };

  const loadIdleConfig = async () => {
    try {
      setLoadingIdleConfig(true);
      const response = await idleTimeConfigService.get();
      // Garante que estagios seja array se vier string
      let d = response.data;
      if (d && typeof d.estagios === 'string') {
        try { d.estagios = JSON.parse(d.estagios); } catch {}
      }
      setIdleConfig(d || {
        ativo: false,
        usarHoraInclusao: true,
        estagios: [
          { tempo: "00:15:00", cor: "#FFFF00" },
          { tempo: "00:30:00", cor: "#FFA500" },
          { tempo: "00:45:00", cor: "#FF4500" },
          { tempo: "01:00:00", cor: "#FF0000" },
        ]
      });
      setIdleTimeModalVisible(true);
    } catch (error) {
      console.error('Erro ao carregar config de tempo:', error);
      const msg = 'Não foi possível carregar as configurações de tempo.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Erro', msg);
    } finally {
      setLoadingIdleConfig(false);
    }
  };

  const handleSaveIdleConfig = async () => {
    try {
       setLoadingIdleConfig(true);
       await idleTimeConfigService.save(idleConfig);
       Alert.alert('Sucesso', 'Configuração de tempo salva com sucesso!');
       setIdleTimeModalVisible(false);
    } catch (error) {
       console.error('Erro ao salvar config de tempo:', error);
       Alert.alert('Erro', 'Não foi possível salvar a configuração.');
    } finally {
       setLoadingIdleConfig(false);
    }
  };


  const fetchAddressByCep = async (cep: string) => {
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
        Alert.alert('CEP Inválido', 'O CEP deve conter 8 dígitos.');
        return;
    }

    try {
        setLoadingCompany(true);
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        const data = await response.json();

        if (response.ok) {
            setCompanyData((prev: any) => ({
                ...prev,
                logradouro: data.street || prev.logradouro,
                bairro: data.neighborhood || prev.bairro,
                cidade: data.city || prev.cidade,
                uf: data.state || prev.uf,
                //ibge: data.ibge || prev.ibge, // BrasilAPI nem sempre retorna ibge na v2, mas se retornar ok
            }));
            Alert.alert('Sucesso', 'Endereço encontrado!');
        } else {
            Alert.alert('Erro', 'CEP não encontrado.');
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        Alert.alert('Erro', 'Falha ao buscar CEP. Verifique sua conexão.');
    } finally {
        setLoadingCompany(false);
    }
  };

  const handleBuscaCnpj = async () => {
    // Feedback imediato e robusto para Web
    if (Platform.OS === 'web') {
        window.alert("Consultando CNPJ... Aguarde.");
    } else {
        Alert.alert("Aguarde", "Consultando CNPJ...");
    }

    const cnpj = companyData.cnpj?.replace(/\D/g, '');

    if (!cnpj || cnpj.length !== 14) {
      if (Platform.OS === 'web') window.alert('CNPJ Inválido. Digite 14 números.');
      else Alert.alert('CNPJ Inválido', 'Digite um CNPJ válido com 14 números.');
      return;
    }

    try {
      setLoadingCompany(true);
      // Chama o backend que vai atuar como proxy para a BrasilAPI
      const response = await companyService.consultarCnpj(cnpj);
      const data = response.data;

      if (data) {
        setCompanyData((prev: any) => ({
          ...prev,
          razaoSocial: data.razaoSocial || prev.razaoSocial,
          nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
          logradouro: data.logradouro || prev.logradouro,
          numero: data.numero || prev.numero,
          complemento: data.complemento || prev.complemento,
          bairro: data.bairro || prev.bairro,
          cidade: data.cidade || prev.cidade,
          uf: data.uf || prev.uf,
          cep: data.cep || prev.cep,
          ibge: data.ibge || prev.ibge, 
          telefone: data.telefone || prev.telefone,
          cnae: data.cnae || prev.cnae,
        }));
        
        const msg = "Dados encontrados e preenchidos!";
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert("Sucesso", msg);

      } else {
        const msg = "Nenhum dado retornado.";
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert("Atenção", msg);
      }
    } catch (error: any) {
      console.error("Erro ao buscar CNPJ:", error);
      const msg = error.response?.data?.error || "Erro ao consultar CNPJ.";
      if (Platform.OS === 'web') window.alert("Erro: " + msg);
      else Alert.alert("Erro", msg);
    } finally {
      setLoadingCompany(false);
    }
  };


  const handleEditPermissions = (userToEdit: UserPermissions) => {
    setIsCreating(false);
    setSelectedUser({ ...userToEdit });
    setSelectedRoleId(userToEdit.roleId || null);
    // Verificar se existe vínculo com funcionário (vem do include: { employee: true })
    const empLink = (userToEdit as any).employee; 
    setSelectedEmployeeId(empLink ? empLink.id : null);

    if (rolesList.length === 0) loadRoles(); 
    if (employeesList.length === 0) {
        // Load employees just in case they weren't loaded
        employeeService.getAll().then(res => setEmployeesList(res.data || [])).catch(console.error);
    }
    setModalVisible(true);
  };

  const handleAddUser = () => {
      setIsCreating(true);
      setSelectedUser({
          _id: '',
          nome: '',
          email: '',
          tipo: 'funcionario',
          ativa: true,
          permissoes: { produtos: false, funcionarios: false, clientes: false, vendas: true, relatorios: false, configuracoes: false },
          ativo: true
      } as any);
      setFormName('');
      setFormEmail('');
      setNewPassword('');
      setSelectedRoleId(null);
      setSelectedEmployeeId(null);
      setModalVisible(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      const payload: any = { 
          permissoes: selectedUser.permissoes, 
          roleId: selectedRoleId,
          funcionario: selectedEmployeeId
      };
      
      if (isCreating) {
          if (!formName || !formEmail || !newPassword) {
              Alert.alert('Erro', 'Preencha nome, email e senha.');
              return;
          }
          // Create
          await userService.create({
              nome: formName,
              email: formEmail,
              senha: newPassword,
              tipo: selectedUser.tipo, // Default funcionario
              ...payload
          });
          Alert.alert('Sucesso', 'Usuário criado com sucesso');
      } else {
        // Update
        await userService.update(selectedUser._id, payload);
        Alert.alert('Sucesso', 'Usuário atualizado com sucesso');
      }
      
      // Atualizar lista local
      loadUsers(); 
      
      setModalVisible(false);
      setSelectedUser(null);
      setSelectedEmployeeId(null);
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      Alert.alert('Erro', 'Erro ao salvar permissões');
    }
  };


  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await userService.updateStatus(userId, !currentStatus);
      
      setUsers(users.map(u => 
        u._id === userId ? { ...u, ativo: !currentStatus } : u
      ));
      
      Alert.alert('Sucesso', `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error: any) {
      console.error('Erro ao alterar status do usuário:', error);
      Alert.alert('Erro', 'Erro ao alterar status do usuário');
    }
  };

  const updatePermission = (permission: keyof UserPermissions['permissoes'], value: boolean) => {
    if (!selectedUser) return;
    
    setSelectedUser({
      ...selectedUser,
      permissoes: {
        ...selectedUser.permissoes,
        [permission]: value,
      },
    });
  };

  const renderUserCard = (userItem: UserPermissions) => (
    <View key={userItem._id} style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userItem.nome}</Text>
          <Text style={styles.userEmail}>{userItem.email}</Text>
          <Text style={styles.userType}>
            {userItem.tipo === 'admin' ? 'Administrador' : 'Funcionário'}
          </Text>
        </View>
        
        <View style={styles.userActions}>
          <Switch
            value={userItem.ativo}
            onValueChange={(value) => toggleUserStatus(userItem._id, userItem.ativo)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
          
          {userItem.tipo === 'funcionario' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPermissions(userItem)}
            >
              <SafeIcon name="settings" size={24} color="#2196F3" fallbackText="⚙️" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {userItem.tipo === 'funcionario' && (
        <View style={styles.permissionsPreview}>
          <Text style={styles.permissionsTitle}>Permissões:</Text>
          <View style={styles.permissionsList}>
            {Object.entries(userItem.permissoes).map(([key, value]) => (
              <View key={key} style={styles.permissionItem}>
                <SafeIcon 
                  name={value ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={value ? "#4CAF50" : "#f44336"} 
                  fallbackText={value ? "✓" : "×"}
                />
                <Text style={[styles.permissionText, { color: value ? "#4CAF50" : "#f44336" }]}>
                  {getPermissionLabel(key)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const getPermissionLabel = (permission: string) => {
    const labels: { [key: string]: string } = {
      produtos: 'Produtos',
      funcionarios: 'Funcionários',
      clientes: 'Clientes',
      vendas: 'Vendas',
      relatorios: 'Relatórios',
      configuracoes: 'Configurações',
    };
    return labels[permission] || permission;
  };

  const getPermissionIcon = (permission: string) => {
    const icons: { [key: string]: string } = {
      produtos: 'cube',
      funcionarios: 'people',
      clientes: 'person',
      vendas: 'card',
      relatorios: 'bar-chart',
      configuracoes: 'settings',
    };
    return icons[permission] || 'help';
  };

  if (!isAdmin()) {
    return (
      <View style={styles.accessDenied}>
        <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Apenas administradores podem acessar as configurações
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Configurações" />
      <ScrollView style={styles.content}>
        {/* Seção de Informações do Sistema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações do Sistema</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <SafeIcon name="person-circle" size={24} color="#2196F3" fallbackText="👤" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Usuário Logado</Text>
                <Text style={styles.infoValue}>{user?.nome || user?.email}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <SafeIcon name="shield-checkmark" size={24} color="#4CAF50" fallbackText="✓" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nível de Acesso</Text>
                <Text style={styles.infoValue}>Administrador</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <SafeIcon name="time" size={24} color="#FF9800" fallbackText="⏱" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Último Login</Text>
                <Text style={styles.infoValue}>
                  {user?.ultimoLogin ? new Date(user.ultimoLogin).toLocaleString('pt-BR') : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Seção de Gerenciamento de Usuários */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16, marginBottom: 16 }}>
            <Text style={{ ...styles.sectionTitle, marginBottom: 0 }}>Gerenciamento de Usuários</Text>
            <TouchableOpacity 
              onPress={() => handleAddUser()}
              style={{ backgroundColor: '#2196F3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Novo Usuário</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Carregando usuários...</Text>
            </View>
          ) : (
            users.map(renderUserCard)
          )}
        </View>

        {/* Seção de Configurações Gerais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações Gerais</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={loadCompany}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="business" size={24} color="#2196F3" fallbackText="🏢" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Dados da Empresa</Text>
                  <Text style={styles.settingDescription}>
                    CNPJ, Endereço, Faturamento e NFC-e
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="notifications" size={24} color="#2196F3" fallbackText="🔔" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notificações</Text>
                  <Text style={styles.settingDescription}>
                    Configurar notificações do sistema
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="cloud-upload" size={24} color="#4CAF50" fallbackText="⤴︎" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Backup</Text>
                  <Text style={styles.settingDescription}>
                    Configurar backup automático
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="shield" size={24} color="#FF9800" fallbackText="🛡" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Segurança</Text>
                  <Text style={styles.settingDescription}>
                    Configurações de segurança
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingItem, { borderLeftWidth: 4, borderLeftColor: '#9C27B0' }]}
              onPress={() => navigation.navigate('admin-perfis' as never)}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="shield-checkmark" size={24} color="#9C27B0" fallbackText="🛡" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Perfis de Acesso (Cargos)</Text>
                  <Text style={styles.settingDescription}>
                    Criar cargos e definir permissões
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            


            <TouchableOpacity 
              style={[styles.settingItem, loadingIdleConfig && { opacity: 0.5 }]}
              onPress={loadIdleConfig}
              disabled={loadingIdleConfig}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="timer" size={24} color="#F44336" fallbackText="⏱" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>
                    Tempo sem Consumo {loadingIdleConfig ? '(Carregando...)' : ''}
                  </Text>
                  <Text style={styles.settingDescription}>
                    Configurar cores por tempo de inatividade
                  </Text>
                </View>
              </View>
              {loadingIdleConfig ? <ActivityIndicator size="small" color="#F44336" /> : <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate('admin-smtp-config' as never)}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="mail" size={24} color="#FF9800" fallbackText="📧" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Configuração de E-mail (SMTP)</Text>
                  <Text style={styles.settingDescription}>
                    Configurações para o sistema enviar e-mails
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate('admin-export-xml' as never)}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="archive" size={24} color="#9C27B0" fallbackText="📦" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Exportar XMLs (NFC-e)</Text>
                  <Text style={styles.settingDescription}>
                    Compactar XMLs fiscais e enviar por e-mail
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate('TestScreen' as never)}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="flask" size={24} color="#9C27B0" fallbackText="🧪" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Testes e Diagnóstico</Text>
                  <Text style={styles.settingDescription}>
                    Executar testes e verificar logs do sistema
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push('/configuracoes')}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="settings-sharp" size={24} color="#607D8B" fallbackText="⚙" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Configurações do App</Text>
                  <Text style={styles.settingDescription}>
                    Impressoras, WiFi, API e NFC-e
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
          </View>
        </View>


      </ScrollView>

      {/* Modal de Edição de Permissões */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar Permissões</Text>
            <TouchableOpacity onPress={handleSavePermissions}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.userInfoModal}>
                {isCreating ? (
                    <View style={{ width: '100%', marginBottom: 10 }}>
                       <Text style={styles.label}>Nome</Text>
                       <TextInput style={styles.inputField} value={formName} onChangeText={setFormName} placeholder="Nome do Usuário" />
                       
                       <Text style={[styles.label, {marginTop: 10}]}>Email (Login)</Text>
                       <TextInput style={styles.inputField} value={formEmail} onChangeText={setFormEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email@exemplo.com" />
                       
                       <Text style={[styles.label, {marginTop: 10}]}>Senha</Text>
                       <TextInput style={styles.inputField} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="******" />
                       
                       <Text style={[styles.label, {marginTop: 10}]}>Tipo de Conta</Text>
                        <View style={{flexDirection: 'row', gap: 20, marginTop: 5}}>
                           <TouchableOpacity onPress={() => setSelectedUser({...selectedUser, tipo: 'funcionario'})} style={{ flexDirection: 'row', alignItems: 'center' }}>
                               <SafeIcon name={selectedUser.tipo === 'funcionario' ? 'radio-button-on' : 'radio-button-off'} size={20} color="#2196F3" fallbackText="O" />
                               <Text style={{marginLeft: 5, color: '#333'}}>Funcionário</Text>
                           </TouchableOpacity>
                           {isAdmin() && (
                            <TouchableOpacity onPress={() => setSelectedUser({...selectedUser, tipo: 'admin'})} style={{ flexDirection: 'row', alignItems: 'center' }}>
                               <SafeIcon name={selectedUser.tipo === 'admin' ? 'radio-button-on' : 'radio-button-off'} size={20} color="#2196F3" fallbackText="O" />
                               <Text style={{marginLeft: 5, color: '#333'}}>Administrador</Text>
                            </TouchableOpacity>
                           )}
                        </View>
                    </View>
                ) : (
                    <>
                        <Text style={styles.modalUserName}>{selectedUser.nome}</Text>
                        <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                    </>
                )}
              </View>

              {/* Seletor de Funcionário Vinculado */}
              {selectedUser.tipo === 'funcionario' && (
              <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Vincular a Funcionário</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    Vincule este login a um cadastro de funcionário para herdar cargo e dados.
                  </Text>
                  
                  <View style={{ maxHeight: 200, borderWidth: 1, borderColor: '#eee', borderRadius: 8 }}>
                      <ScrollView nestedScrollEnabled={true}>
                        <TouchableOpacity 
                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                            onPress={() => setSelectedEmployeeId(null)}
                        >
                            <Text style={{ color: '#666' }}>-- Sem Vínculo --</Text>
                        </TouchableOpacity>
                        {employeesList.map(emp => (
                            <TouchableOpacity 
                                key={emp._id || (emp as any).id} 
                                style={{ 
                                    padding: 12, 
                                    borderBottomWidth: 1, 
                                    borderBottomColor: '#eee', 
                                    backgroundColor: String(selectedEmployeeId) === String(emp._id || (emp as any).id) ? '#E3F2FD' : '#fff' 
                                }}
                                onPress={() => setSelectedEmployeeId((emp as any).id || emp._id)}
                            >
                                <Text style={{ color: '#333', fontWeight: String(selectedEmployeeId) === String(emp._id || (emp as any).id) ? 'bold' : 'normal' }}>
                                    {emp.nome}
                                </Text>
                            </TouchableOpacity>
                        ))}
                      </ScrollView>
                  </View>
              </View>
              )}

              {/* Seletor de Perfil */}
              <View style={{ marginBottom: 20 }}>
                  <Text style={styles.label}>Perfil (Cargo)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity 
                         onPress={() => setSelectedRoleId(null)}
                         style={{ 
                             padding: 8, 
                             borderRadius: 8, 
                             borderWidth: 1, 
                             borderColor: selectedRoleId === null ? '#2196F3' : '#ddd',
                             backgroundColor: selectedRoleId === null ? '#E3F2FD' : '#fff'
                         }}
                      >
                          <Text style={{ color: selectedRoleId === null ? '#2196F3' : '#666' }}>Personalizado</Text>
                      </TouchableOpacity>
                      
                      {rolesList.map(r => (
                          <TouchableOpacity 
                             key={r.id}
                             onPress={() => {
                                 setSelectedRoleId(r.id);
                                 // Opcional: Copiar permissoes do role para o usuario visualmente?
                                 // Sim, ajuda a visualizar.
                                 if (r.permissoes) {
                                     setSelectedUser(prev => prev ? ({ ...prev, permissoes: { ...(prev.permissoes), ...r.permissoes } }) : null);
                                 }
                             }}
                             style={{ 
                                 padding: 8, 
                                 borderRadius: 8, 
                                 borderWidth: 1, 
                                 borderColor: selectedRoleId === r.id ? '#2196F3' : '#ddd',
                                 backgroundColor: selectedRoleId === r.id ? '#E3F2FD' : '#fff'
                             }}
                          >
                              <Text style={{ color: selectedRoleId === r.id ? '#2196F3' : '#666' }}>{r.nome}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                     {selectedRoleId 
                        ? 'Permissões vinculadas ao perfil selecionado.' 
                        : 'Permissões definidas manualmente abaixo.'}
                  </Text>
              </View>

              <Text style={styles.permissionsHeader}>Permissões de Acesso</Text>
              
              {Object.entries(selectedUser.permissoes).map(([key, value]) => (
                <View key={key} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <SafeIcon 
                      name={getPermissionIcon(key) as any} 
                      size={24} 
                      color="#2196F3" 
                      fallbackText="✓" 
                    />
                    <View style={styles.permissionDetails}>
                      <Text style={styles.permissionLabel}>
                        {getPermissionLabel(key)}
                      </Text>
                      <Text style={styles.permissionDescription}>
                        {getPermissionDescription(key)}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => updatePermission(key as keyof UserPermissions['permissoes'], newValue)}
                    trackColor={{ false: '#ccc', true: '#2196F3' }}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal de Cadastro de Empresa */}
      <Modal
        visible={companyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCompanyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
           <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCompanyModalVisible(false)}>
              <Text style={styles.cancelButton}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Dados da Empresa</Text>
            <TouchableOpacity onPress={handleSaveCompany}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionHeader}>1. Identificação</Text>
            <SimpleInput label="Razão Social *" value={companyData.razaoSocial} onChangeText={(t: string) => setCompanyData({...companyData, razaoSocial: t})} />
            <SimpleInput label="Nome Fantasia *" value={companyData.nomeFantasia} onChangeText={(t: string) => setCompanyData({...companyData, nomeFantasia: t})} />
            <View style={{ marginBottom: 16 }}>
                <Text style={styles.inputLabel}>CNPJ *</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput 
                            style={styles.inputField}
                            value={companyData.cnpj} 
                            onChangeText={(t) => setCompanyData({...companyData, cnpj: t})} 
                            keyboardType="numeric"
                            placeholder="00.000.000/0000-00"
                            maxLength={18}
                        />
                    </View>
                    {Platform.OS === 'web' ? (
                        // Solução Web: Botão HTML Nativo para garantir clique no Modal
                        // @ts-ignore
                        <button 
                            onClick={(e) => { e.preventDefault(); handleBuscaCnpj(); }}
                            style={{ 
                                marginLeft: 4, 
                                width: 50, 
                                height: 50, 
                                backgroundColor: '#4CAF50', 
                                border: 'none', 
                                borderRadius: 8, 
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 99999
                            }}
                        >
                            <div style={{ pointerEvents: 'none', display: 'flex' }}>
                                <SafeIcon name="search" size={20} color="#fff" fallbackText="🔍" />
                            </div>
                        </button>

                    ) : (
                        // Solução Native: TouchableOpacity padrão
                        <TouchableOpacity 
                            style={{ 
                                backgroundColor: '#4CAF50', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                borderRadius: 8,
                                width: 50,
                                height: 50,
                                marginLeft: 4
                            }}
                            onPress={handleBuscaCnpj}
                        >
                            <SafeIcon name="search" size={20} color="#fff" fallbackText="🔍" />
                        </TouchableOpacity>
                    )}




                </View>
            </View>

            <SimpleInput label="Inscrição Estadual" value={companyData.inscricaoEstadual} onChangeText={(t: string) => setCompanyData({...companyData, inscricaoEstadual: t})} placeholder="Isento se vazio" />
            <SimpleInput label="Inscrição Municipal" value={companyData.inscricaoMunicipal} onChangeText={(t: string) => setCompanyData({...companyData, inscricaoMunicipal: t})} />

            <Text style={styles.sectionHeader}>2. Endereço Fiscal</Text>
            <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>CEP *</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput 
 
                            style={styles.inputField}
                            value={companyData.cep} 
                            onChangeText={(t) => setCompanyData({...companyData, cep: t})} 
                            keyboardType="numeric"
                            placeholder="00000-000"
                            maxLength={9}
                        />
                    </View>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 8 }}
                        onPress={() => fetchAddressByCep(companyData.cep || '')}
                    >
                         <SafeIcon name="search" size={20} color="#fff" fallbackText="🔍" />
                    </TouchableOpacity>
                </View>
            </View>
            <SimpleInput label="Logradouro *" value={companyData.logradouro} onChangeText={(t: string) => setCompanyData({...companyData, logradouro: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Número *" value={companyData.numero} onChangeText={(t: string) => setCompanyData({...companyData, numero: t})} /></View>
                <View style={{flex: 2}}><SimpleInput label="Bairro *" value={companyData.bairro} onChangeText={(t: string) => setCompanyData({...companyData, bairro: t})} /></View>
            </View>
            <SimpleInput label="Complemento" value={companyData.complemento} onChangeText={(t: string) => setCompanyData({...companyData, complemento: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 2}}><SimpleInput label="Cidade *" value={companyData.cidade} onChangeText={(t: string) => setCompanyData({...companyData, cidade: t})} /></View>
                <View style={{flex: 1}}><SimpleInput label="UF *" value={companyData.uf} onChangeText={(t: string) => setCompanyData({...companyData, uf: t})} maxLength={2} /></View>
            </View>
            <SimpleInput label="Cód. Município IBGE *" value={companyData.ibge} onChangeText={(t: string) => setCompanyData({...companyData, ibge: t})} keyboardType="numeric" />


            <Text style={styles.sectionHeader}>3. Contato</Text>
            <SimpleInput label="Telefone Principal" value={companyData.telefone} onChangeText={(t: string) => setCompanyData({...companyData, telefone: t})} keyboardType="phone-pad" />
            <SimpleInput label="Email Principal" value={companyData.email} onChangeText={(t: string) => setCompanyData({...companyData, email: t})} keyboardType="email-address" />
            <SimpleInput label="WhatsApp (Opcional)" value={companyData.whatsapp} onChangeText={(t: string) => setCompanyData({...companyData, whatsapp: t})} keyboardType="phone-pad" />

            <Text style={styles.sectionHeader}>4. Dados Fiscais (NFC-e)</Text>
            <Text style={styles.inputLabel}>Regime Tributário</Text>
             <View style={styles.radioGroup}>
                {['simples_nacional', 'lucro_presumido', 'lucro_real'].map(opt => (
                    <TouchableOpacity key={opt} style={[styles.radioBtn, companyData.regimeTributario === opt && styles.radioBtnSelected]} onPress={() => setCompanyData({...companyData, regimeTributario: opt})}>
                        <Text style={[styles.radioText, companyData.regimeTributario === opt && styles.radioTextSelected]}>{opt.replace('_', ' ').toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <SimpleInput label="CNAE Principal" value={companyData.cnae} onChangeText={(t: string) => setCompanyData({...companyData, cnae: t})} />
            <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Contribuinte ICMS?</Text>
                <Switch value={companyData.contribuinteIcms !== false} onValueChange={(v) => setCompanyData({...companyData, contribuinteIcms: v})} />
            </View>
            <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Ambiente de Produção? (NFC-e)</Text>
                <Switch trackColor={{false: '#FF9800', true: '#4CAF50'}} value={companyData.ambienteFiscal === 'producao'} onValueChange={(v) => setCompanyData({...companyData, ambienteFiscal: v ? 'producao' : 'homologacao'})} />
            </View>
            <Text style={{fontSize: 12, color: '#666', marginBottom: 10, textAlign: 'right'}}>{companyData.ambienteFiscal === 'producao' ? 'PRODUÇÃO (Válido)' : 'HOMOLOGAÇÃO (Teste)'}</Text>


            <Text style={styles.sectionHeader}>5. Emissão e Impressão</Text>
            <SimpleInput label="Nome Fantasia na Impressão" value={companyData.nomeImpressao} onChangeText={(t: string) => setCompanyData({...companyData, nomeImpressao: t})} />
            <SimpleInput label="Mensagem Rodapé NFC-e" value={companyData.mensagemRodape} onChangeText={(t: string) => setCompanyData({...companyData, mensagemRodape: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Série NFC-e" value={String(companyData.serieNfce || '1')} onChangeText={(t: string) => setCompanyData({...companyData, serieNfce: t})} keyboardType="numeric" /></View>
                <View style={{flex: 1}}><SimpleInput label="Nº Inicial" value={String(companyData.numeroInicialNfce || '1')} onChangeText={(t: string) => setCompanyData({...companyData, numeroInicialNfce: t})} keyboardType="numeric" /></View>
                <View style={{flex: 1}}><SimpleInput label="Nº Inicial" value={String(companyData.numeroInicialNfce || '1')} onChangeText={(t: string) => setCompanyData({...companyData, numeroInicialNfce: t})} keyboardType="numeric" /></View>
            </View>

            <Text style={styles.sectionHeader}>6. Configuração Fidelidade</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Cashback (%)" value={String(companyData.cashbackPercent || '5.00')} onChangeText={(t: string) => setCompanyData({...companyData, cashbackPercent: t})} keyboardType="numeric" placeholder="5.00" /></View>
                <View style={{flex: 1}}><SimpleInput label="Pontos por R$" value={String(companyData.pointsPerCurrency || '1.00')} onChangeText={(t: string) => setCompanyData({...companyData, pointsPerCurrency: t})} keyboardType="numeric" placeholder="1.00" /></View>
            </View>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Pontos Para Resgate" value={String(companyData.pontosParaResgate || '0')} onChangeText={(t: string) => setCompanyData({...companyData, pontosParaResgate: t})} keyboardType="numeric" placeholder="100" /></View>
                <View style={{flex: 1}}><SimpleInput label="Valor Resgate (R$)" value={String(companyData.valorResgate || '0.00')} onChangeText={(t: string) => setCompanyData({...companyData, valorResgate: t})} keyboardType="numeric" placeholder="5.00" /></View>
            </View>

            <Text style={styles.sectionHeader}>7. Responsável Legal</Text>
            <SimpleInput label="Nome Completo" value={companyData.respNome} onChangeText={(t: string) => setCompanyData({...companyData, respNome: t})} />
            <SimpleInput label="CPF" value={companyData.respCpf} onChangeText={(t: string) => setCompanyData({...companyData, respCpf: t})} />
            <SimpleInput label="Cargo" value={companyData.respCargo} onChangeText={(t: string) => setCompanyData({...companyData, respCargo: t})} />
            <SimpleInput label="Email Pessoal" value={companyData.respEmail} onChangeText={(t: string) => setCompanyData({...companyData, respEmail: t})} />

            <Text style={styles.sectionHeader}>8. Cobrança e Manutenção</Text>
            <SimpleInput label="Plano Contratado" value={companyData.plano} onChangeText={(t: string) => setCompanyData({...companyData, plano: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Valor Mensal" value={String(companyData.valorMensalidade || '')} onChangeText={(t: string) => setCompanyData({...companyData, valorMensalidade: t})} keyboardType="numeric" /></View>
                <View style={{flex: 1}}><SimpleInput label="Dia Vencimento" value={String(companyData.diaVencimento || '')} onChangeText={(t: string) => setCompanyData({...companyData, diaVencimento: t})} keyboardType="numeric" /></View>
            </View>
            <SimpleInput label="Data Início Cobrança" value={companyData.dataInicioCobranca ? new Date(companyData.dataInicioCobranca).toLocaleDateString('pt-BR') : ''} onChangeText={() => {}} placeholder="DD/MM/AAAA" editable={false} />
            <Text style={styles.inputLabel}>Forma de Pagamento</Text>
             <View style={styles.radioGroup}>
                {['pix', 'boleto', 'cartao'].map(opt => (
                    <TouchableOpacity key={opt} style={[styles.radioBtn, companyData.formaCobranca === opt && styles.radioBtnSelected]} onPress={() => setCompanyData({...companyData, formaCobranca: opt})}>
                        <Text style={[styles.radioText, companyData.formaCobranca === opt && styles.radioTextSelected]}>{opt.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <SimpleInput label="Email para Cobrança" value={companyData.emailCobranca} onChangeText={(t: string) => setCompanyData({...companyData, emailCobranca: t})} keyboardType="email-address" />

            <Text style={styles.sectionHeader}>9. Dados Bancários</Text>
            <SimpleInput label="Banco" value={companyData.banco} onChangeText={(t: string) => setCompanyData({...companyData, banco: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Agência" value={companyData.agencia} onChangeText={(t: string) => setCompanyData({...companyData, agencia: t})} /></View>
                <View style={{flex: 1}}><SimpleInput label="Conta" value={companyData.conta} onChangeText={(t: string) => setCompanyData({...companyData, conta: t})} /></View>
            </View>
            <SimpleInput label="Chave PIX" value={companyData.chavePix} onChangeText={(t: string) => setCompanyData({...companyData, chavePix: t})} />

            <Text style={styles.sectionHeader}>9. Controle (Interno)</Text>
             <View style={styles.infoRow}>
               <SafeIcon name="calendar" size={20} color="#666" fallbackText="📅" />
               <Text style={{marginLeft: 10}}>Cadastro: {companyData.dataCadastro ? new Date(companyData.dataCadastro).toLocaleDateString('pt-BR') : 'Hoje'}</Text>
             </View>
             <SimpleInput label="Observações Internas" value={companyData.observacoes} onChangeText={(t: string) => setCompanyData({...companyData, observacoes: t})} multiline numberOfLines={3} style={[styles.inputField, {height: 80}]} />

             <View style={{height: 100}} /> 
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de Configuração de Tempo Sem Consumo */}
      <Modal
        visible={idleTimeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIdleTimeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIdleTimeModalVisible(false)}>
              <Text style={styles.cancelButton}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Tempo sem Consumo</Text>
            <TouchableOpacity onPress={handleSaveIdleConfig}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Utilizar tempo sem consumo</Text>
                <Switch value={idleConfig.ativo} onValueChange={(v) => setIdleConfig({...idleConfig, ativo: v})} />
            </View>

             <View style={[styles.switchRow, { opacity: idleConfig.ativo ? 1 : 0.5 }]}>
                <Text style={styles.inputLabel}>Utilizar hora de inclusão</Text>
                <Switch 
                  value={idleConfig.usarHoraInclusao} 
                  onValueChange={(v) => setIdleConfig({...idleConfig, usarHoraInclusao: v})} 
                  disabled={!idleConfig.ativo}
                  trackColor={{false: '#ccc', true: '#2196F3'}}
                />
            </View>
             <Text style={styles.helperText}>
               Se marcado, usa a hora de abertura quando não houver pedidos. Caso contrário, só conta após o primeiro pedido.
             </Text>

            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Estágios de Tempo e Cores</Text>
            {idleConfig.estagios && idleConfig.estagios.map((estagio: any, index: number) => (
               <View key={index} style={[styles.estagioRow, { opacity: idleConfig.ativo ? 1 : 0.5 }]}>
                  <Text style={styles.estagioLabel}>Estágio {index + 1}:</Text>
                  
                  <View style={styles.timeInputContainer}>
                     <TextInput
                       style={styles.timeInput}
                       value={estagio.tempo}
                       onChangeText={(text) => {
                         const newEstagios = [...idleConfig.estagios];
                         newEstagios[index].tempo = text;
                         setIdleConfig({...idleConfig, estagios: newEstagios});
                       }}
                       placeholder="HH:MM:SS"
                       maxLength={8}
                       editable={idleConfig.ativo}
                     />
                  </View>

                  <Text style={{marginHorizontal: 8}}>Cor</Text>
                  <View style={styles.colorPickerContainer}>
                      <TextInput
                          style={[styles.colorInput, { backgroundColor: estagio.cor }]}
                           value={estagio.cor}
                           onChangeText={(text) => {
                             const newEstagios = [...idleConfig.estagios];
                             newEstagios[index].cor = text;
                             setIdleConfig({...idleConfig, estagios: newEstagios});
                           }}
                           editable={idleConfig.ativo}
                      />
                       {/* Predefined Colors Dropdown could go here, for now simple hex input or preset list */}
                      <View style={styles.colorPresets}>
                          {['#FFFF00', '#FFA500', '#FF4500', '#FF0000', '#4CAF50', '#2196F3'].map(c => (
                              <TouchableOpacity 
                                  key={c}
                                  style={[styles.colorPreset, { backgroundColor: c }]}
                                  onPress={() => {
                                      if(!idleConfig.ativo) return;
                                      const newEstagios = [...idleConfig.estagios];
                                      newEstagios[index].cor = c;
                                      setIdleConfig({...idleConfig, estagios: newEstagios});
                                  }}
                              />
                          ))}
                      </View>
                  </View>
               </View>
            ))}

            <View style={{height: 50}} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const getPermissionDescription = (permission: string) => {
  const descriptions: { [key: string]: string } = {
    produtos: 'Gerenciar produtos, categorias e estoque',
    funcionarios: 'Gerenciar funcionários e suas informações',
    clientes: 'Gerenciar clientes e seus dados',
    vendas: 'Realizar vendas e gerenciar pedidos',
    relatorios: 'Visualizar relatórios e estatísticas',
    configuracoes: 'Acessar configurações do sistema',
  };
  return descriptions[permission] || '';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 16,
    marginBottom: 10,
    marginTop: -8,
  },
  estagioRow: {
    flexDirection: 'column',
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  estagioLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 14, 
    color: '#333'
  },
  timeInputContainer: {
      marginBottom: 8
  },
  timeInput: {
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 4,
      padding: 8,
      fontSize: 16,
      width: 120,
      textAlign: 'center'
  },
  colorPickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8
  },
  colorInput: {
       borderWidth: 1,
       borderColor: '#ccc',
       borderRadius: 4,
       padding: 8,
       width: 100,
       textAlign: 'center',
       color: '#fff',
       textShadowColor: 'rgba(0,0,0,0.5)',
       textShadowOffset: { width: 1, height: 1 },
       textShadowRadius: 1,
       fontWeight: 'bold'
  },
  colorPresets: {
      flexDirection: 'row',
      gap: 5
  },
  colorPreset: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#ddd'
  },

  userCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userType: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginLeft: 12,
    padding: 8,
  },
  permissionsPreview: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  userInfoModal: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 16,
    color: '#666',
  },
  permissionsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
  },
  // Novos estilos para formulário
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  pickerButton: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333'
  },
  pickerDropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 12,
    maxHeight: 200
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9'
  },
  pickerItemText: {
    fontSize: 16,
    color: '#666'
  },
  inputField: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  radioBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  radioBtnSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  radioText: {
    color: '#666',
    fontSize: 12,
  },
  radioTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

// Componente auxiliar simples para Input
const SimpleInput = ({ label, value, onChangeText, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput 
      style={styles.inputField}
      value={value || ''}
      onChangeText={onChangeText}
      placeholderTextColor="#999"
      {...props}
    />
  </View>
);
// Precisamos garantir que TextInput venha do escopo certo, mas como não posso mexer nos imports do topo facilmente agora, 
// vou usar o TextInput global do React Native que já deve estar importado ou será necessário adicionar.
// Vou assumir que TextInput está importado ou vou adicionar ele no topo.
// ESPERE: `TextInput` NÃO está importado no topo do arquivo original pelo que vejo nas linhas 1-12.
// Preciso adicionar TextInput nos imports.