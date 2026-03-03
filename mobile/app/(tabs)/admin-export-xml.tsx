import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Assumindo react-native-picker/picker que é padrão do Expo, senão usamos UI custom
import { configService } from '../../src/services/api/configService';
import { SafeIcon } from '../../components/SafeIcon';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';

export default function AdminExportXmlScreen() {
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const res = await configService.listXmlFolders();
      if (res.data?.ok) {
        setFolders(res.data.folders || []);
        if (res.data.folders?.length > 0) {
           setSelectedFolder(res.data.folders[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as pastas de XML.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedFolder) {
      const msg = 'É necessário selecionar uma pasta para exportação.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Atenção', msg);
      return;
    }

    if (sendEmail && !emailTo) {
      const msg = 'Por favor, informe o e-mail de destino.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Atenção', msg);
      return;
    }

    try {
      setProcessing(true);
      const payload = { folder: selectedFolder, sendEmail, emailTo };
      const res = await configService.exportXmls(payload);
      
      const msg = res.data?.message || 'Processo concluído com sucesso!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Sucesso', msg);

    } catch (error: any) {
      console.error('Erro na exportação:', error);
      const msg = error.response?.data?.message || 'Falha ao processar exportação.';
      if (Platform.OS === 'web') window.alert('Erro: ' + msg);
      else Alert.alert('Erro', msg);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando pastas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Exportar XMLs" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <SafeIcon name="archive" size={40} color="#9C27B0" fallbackText="📦" />
          <Text style={styles.title}>Exportar Notas Fiscais</Text>
          <Text style={styles.subtitle}>
            Selecione a pasta de XMLs (por mês) e exporte para arquivo compactado ou envie direto pro e-mail do contador.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Pasta de Origem (Mês)</Text>
          {folders.length === 0 ? (
             <Text style={styles.emptyText}>Nenhuma pasta de XML encontrada no servidor.</Text>
          ) : (
            <View style={styles.pickerContainer}>
               <Picker
                  selectedValue={selectedFolder}
                  onValueChange={(itemValue: any) => setSelectedFolder(itemValue)}
                  style={{ height: 50, width: '100%' }}
               >
                 {folders.map(f => (
                    <Picker.Item key={f} label={f} value={f} />
                 ))}
               </Picker>
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.labelSwitch}>Enviar arquivo (.zip) por E-mail?</Text>
            <Switch
              value={sendEmail}
              onValueChange={setSendEmail}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
            />
          </View>

          {sendEmail && (
            <>
              <Text style={styles.label}>E-mail de Destino</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: contador@minhaempresa.com"
                value={emailTo}
                onChangeText={setEmailTo}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.helperText}>
                Obs: O e-mail será enviado usando o servidor SMTP cadastrado nas Configurações Gerais.
              </Text>
            </>
          )}

          <View style={styles.actionsBox}>
            <TouchableOpacity 
              style={[styles.btnAction, styles.btnSave, (processing || folders.length === 0) && { opacity: 0.7 }]} 
              onPress={handleExport}
              disabled={processing || folders.length === 0}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <SafeIcon name={sendEmail ? "paper-plane" : "cube"} size={20} color="#FFF" fallbackText="💾" />
                  <Text style={styles.btnSaveText}>{sendEmail ? 'Compactar e Enviar' : 'Apenas Compactar (Local)'}</Text>
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
  emptyText: { color: '#f44336', marginBottom: 15, fontStyle: 'italic' },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 5, paddingHorizontal: 20 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
  labelSwitch: { fontSize: 16, color: '#333', flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', borderTopWidth: 1, borderTopColor: '#eee' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 5 },
  helperText: { fontSize: 12, color: '#999', marginBottom: 15 },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9' },
  actionsBox: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8 },
  btnSave: { backgroundColor: '#9C27B0' }, // Roxo
  btnSaveText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 }
});
