import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { configService } from '../../src/services/api/configService';
import { SafeIcon } from '../../components/SafeIcon';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';

export default function AdminSmtpConfigScreen() {
  const [config, setConfig] = useState({
    host: '',
    port: '',
    user: '',
    password: '',
    sender: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await configService.getSmtpConfig();
      if (res.data?.data) {
        setConfig((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações SMTP:', error);
      Alert.alert('Erro', 'Não foi possível carregar as configurações de e-mail.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await configService.saveSmtpConfig(config);
      
      const msg = 'Configurações JWT/SMTP salvas com sucesso!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Sucesso', msg);

    } catch (error: any) {
      console.error('Erro ao salvar SMTP:', error);
      const msg = error.response?.data?.message || 'Falha ao salvar.';
      if (Platform.OS === 'web') window.alert('Erro: ' + msg);
      else Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.host || !config.port || !config.user || !config.sender) {
      const msg = 'Preencha todos os campos antes de testar a conexão.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Atenção', msg);
      return;
    }

    try {
      setTesting(true);
      const res = await configService.testSmtpConnection(config);
      
      const msg = res.data?.message || 'E-mail de teste enviado com sucesso!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Sucesso', msg);

    } catch (error: any) {
      console.error('Erro no teste SMTP:', error);
      const msg = error.response?.data?.message || 'Falha ao enviar e-mail de teste. Verifique suas credenciais.';
      if (Platform.OS === 'web') window.alert('Erro: ' + msg);
      else Alert.alert('Erro', msg);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Configuração de E-mail" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <SafeIcon name="mail" size={40} color="#2196F3" fallbackText="📧" />
          <Text style={styles.title}>Configurações de E-mail (SMTP)</Text>
          <Text style={styles.subtitle}>
            Configure o servidor de saída para o sistema enviar e-mails (como de notas ou recuperações).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Servidor SMTP (Host)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: smtp.gmail.com"
            value={config.host}
            onChangeText={(text) => setConfig({ ...config, host: text })}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Porta SMTP</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 465 ou 587"
            value={config.port}
            onChangeText={(text) => setConfig({ ...config, port: text })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>E-mail do Remetente (De)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Não Responda <nao-responda@minhaempresa.com>"
            value={config.sender}
            onChangeText={(text) => setConfig({ ...config, sender: text })}
          />

          <Text style={styles.label}>Usuário de Autenticação</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: admin@minhaempresa.com"
            value={config.user}
            onChangeText={(text) => setConfig({ ...config, user: text })}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Senha de Autenticação</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua senha ou App Password"
            value={config.password}
            onChangeText={(text) => setConfig({ ...config, password: text })}
            secureTextEntry={true}
          />

          <View style={styles.actionsBox}>
            <TouchableOpacity 
              style={[styles.btnAction, styles.btnTest, testing && { opacity: 0.7 }]} 
              onPress={handleTest}
              disabled={testing || saving}
            >
              {testing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <SafeIcon name="paper-plane" size={20} color="#333" fallbackText="🚀" />
                  <Text style={styles.btnTestText}>Testar Conexão</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btnAction, styles.btnSave, saving && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={testing || saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <SafeIcon name="save" size={20} color="#FFF" fallbackText="💾" />
                  <Text style={styles.btnSaveText}>Salvar Configuração</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 5, paddingHorizontal: 20 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 15 },
  actionsBox: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  btnAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8, marginHorizontal: 5 },
  btnTest: { backgroundColor: '#FFC107' }, // Yellow button
  btnTestText: { color: '#333', fontWeight: 'bold', marginLeft: 8 },
  btnSave: { backgroundColor: '#4CAF50' }, // Green button
  btnSaveText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 }
});
