import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from '../src/components/NativeMaps';
import { GooglePlacesAutocomplete } from '../src/components/GooglePlacesAutocompleteWrapper';
import Constants from 'expo-constants';
import { companyService } from '../src/services/api';
import ScreenIdentifier from '../src/components/ScreenIdentifier';
import { useRouter } from 'expo-router';

// Obter API Key do app.json (via Constants)
const GOOGLE_API_KEY =
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  Constants.expoConfig?.ios?.config?.googleMapsApiKey ||
  '';

export default function DeliveryConfigScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const placesRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);

  // Estados do formulário
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadius, setDeliveryRadius] = useState('');
  const [ranges, setRanges] = useState<{ minDist: string; maxDist: string; price: string }[]>([]);
  
  // Feedback Visual (Substituto/Complemento ao Alert)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Carregar dados
  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    setLoading(true);
    try {
      const res = await companyService.get();
      if (res.data) {
        setCompany(res.data);
        if (res.data.latitude) setLatitude(String(res.data.latitude));
        if (res.data.longitude) setLongitude(String(res.data.longitude));
        if (res.data.deliveryRadius) setDeliveryRadius(String(res.data.deliveryRadius));
        if (Array.isArray(res.data.deliveryRanges)) {
          setRanges(res.data.deliveryRanges.map((r: any) => ({
            minDist: String(r.minDist),
            maxDist: String(r.maxDist),
            price: String(r.price)
          })));
        }
        
        // Se já tem local, preencher o input do autocomplete (visual apenas)
        if (res.data.logradouro && placesRef.current) {
            placesRef.current.setAddress(`${res.data.logradouro}, ${res.data.numero || ''} - ${res.data.cidade || ''}`);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar empresa', error);
      Alert.alert('Erro', 'Falha ao carregar dados da empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSelect = (data: any, details: any = null) => {
    if (details) {
      const { geometry, formatted_address } = details;
      const lat = geometry.location.lat;
      const lng = geometry.location.lng;
      setLatitude(String(lat));
      setLongitude(String(lng));

      // Centrar mapa
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
      
      // Atualizar objeto company com endereço (opcional, se quiser salvar endereço textual também)
      // Aqui o foco é a coordenada para delivery
    }
  };

  const addRange = () => {
    setRanges([...ranges, { minDist: '0', maxDist: '0', price: '0' }]);
  };

  const removeRange = (index: number) => {
    const newRanges = [...ranges];
    newRanges.splice(index, 1);
    setRanges(newRanges);
  };

  const updateRange = (index: number, field: 'minDist' | 'maxDist' | 'price', value: string) => {
    const newRanges = [...ranges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    setRanges(newRanges);
  };

  const parseInputNumber = (value: string) => {
    if (!value) return 0;
    
    // 1. Normalizar sinal de menos (Unicode U+2212 para ASCII U+002D)
    let clean = value.replace(/\u2212/g, '-');
    
    // 2. Substituir vírgula por ponto
    clean = clean.replace(/,/g, '.');
    
    // 3. Remover caracteres inválidos (manter apenas números, ponto e menos)
    clean = clean.replace(/[^0-9.-]/g, '');
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const showFeedback = (title: string, msg: string, type: 'success' | 'error' | 'info' = 'info') => {
      setStatusMsg({ type, text: msg });
      
      if (Platform.OS === 'web') {
          setTimeout(() => window.alert(`${title}\n${msg}`), 100);
      } else {
          Alert.alert(title, msg);
      }
  };

  const handleSave = async () => {
    setStatusMsg(null);
    console.log('Iniciando salvamento raw:', { latitude, longitude, deliveryRadius });

    const latNum = parseInputNumber(latitude);
    const lngNum = parseInputNumber(longitude);
    const radiusNum = parseInputNumber(deliveryRadius);
    
    console.log('Valores parseados:', { latNum, lngNum, radiusNum });

    // Validação DETALHADA para informar ao usuário exatamente o que está errado
    if (latNum === 0) {
        const msg = `Latitude inválida ou zerada (Recebido: "${latitude}")`;
        showFeedback('Erro de Validação', msg, 'error');
        return;
    }

    if (lngNum === 0) {
        const msg = `Longitude inválida ou zerada (Recebido: "${longitude}")`;
        showFeedback('Erro de Validação', msg, 'error');
        return;
    }

    if (radiusNum <= 0) {
        showFeedback('Erro de Validação', 'O Raio de Entrega deve ser maior que zero.', 'error');
        return;
    }

    setSaving(true);
    setStatusMsg({ type: 'info', text: 'Salvando alterações...' });
    
    try {
      const deliveryRangesPayload = ranges.map(r => ({
          minDist: parseInputNumber(r.minDist),
          maxDist: parseInputNumber(r.maxDist),
          price: parseInputNumber(r.price)
      }));

      const payload = {
        ...company,
        latitude: latNum,
        longitude: lngNum,
        deliveryRadius: radiusNum,
        deliveryRanges: deliveryRangesPayload
      };

      await companyService.save(payload);
      showFeedback('Sucesso', 'Configurações de delivery salvas!', 'success');
      // router.back(); 
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      const msg = error?.response?.data?.error || error?.message || 'Falha ao salvar. Verifique se o servidor está rodando.';
      showFeedback('Erro', msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Configuração Delivery" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuração de Delivery</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#2196F3" />
              <Text style={styles.sectionTitle}>Localização da Loja</Text>
            </View>
            <Text style={styles.infoText}>
              Defina o ponto central para cálculo de distâncias.
            </Text>

            {Platform.OS !== 'web' ? (
                <View style={styles.autocompleteContainer}>
                    <GooglePlacesAutocomplete
                        ref={placesRef}
                        placeholder="Buscar endereço da loja"
                        onPress={handlePlaceSelect}
                        query={{
                            key: GOOGLE_API_KEY,
                            language: 'pt-BR',
                        }}
                        fetchDetails={true}
                        styles={{
                            textInput: styles.placesInput,
                            listView: { zIndex: 9999 },
                        }}
                        enablePoweredByContainer={false}
                    />
                </View>
            ) : (
                <View style={{ marginBottom: 16, padding: 10, backgroundColor: '#FFF3E0', borderRadius: 8 }}>
                    <Text style={{ color: '#E65100', fontWeight: 'bold' }}>⚠️ Busca automática indisponível na Web</Text>
                    <Text style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                        Para obter as coordenadas:
                    </Text>
                    
                    <TouchableOpacity 
                        onPress={() => Linking.openURL('https://www.google.com.br/maps')}
                        style={{ backgroundColor: '#fff', padding: 8, borderRadius: 4, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#ccc' }}
                    >
                        <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>Abrir Google Maps 🗺️</Text>
                    </TouchableOpacity>

                    <Text style={{ fontSize: 12, color: '#555' }}>
                        1. Encontre sua loja no mapa.{'\n'}
                        2. Clique com o <Text style={{fontWeight:'bold'}}>botão direito</Text> no local exato.{'\n'}
                        3. Clique nos números (ex: -23.55...) para copiar.{'\n'}
                        4. Cole nos campos abaixo.
                    </Text>
                </View>
            )}

            <View style={styles.mapContainer}>
                {latitude && longitude && !isNaN(parseInputNumber(latitude)) && !isNaN(parseInputNumber(longitude)) ? (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={{
                            latitude: parseInputNumber(latitude),
                            longitude: parseInputNumber(longitude),
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                    >
                        <Marker coordinate={{ latitude: parseInputNumber(latitude), longitude: parseInputNumber(longitude) }} title="Loja" />
                        {deliveryRadius && !isNaN(parseInputNumber(deliveryRadius)) && (
                            <Circle 
                                center={{ latitude: parseInputNumber(latitude), longitude: parseInputNumber(longitude) }}
                                radius={parseInputNumber(deliveryRadius) * 1000} // km para metros
                                fillColor="rgba(33, 150, 243, 0.2)"
                                strokeColor="rgba(33, 150, 243, 0.5)"
                            />
                        )}
                    </MapView>
                ) : (
                    <View style={styles.emptyMap}>
                        <Text style={{ color: '#888' }}>Selecione um endereço para ver o mapa</Text>
                    </View>
                )}
            </View>

            {/* Manual Coordinates for Web/Fallback */}
            <View style={styles.formGroup}>
                <Text style={styles.label}>📍 Coordenadas Manuais (Obrigatório na Web)</Text>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>Latitude</Text>
                        <TextInput
                            style={styles.input}
                            value={latitude}
                            onChangeText={(t) => {
                                console.log('Lat changed:', t);
                                setLatitude(t);
                            }}
                            keyboardType="numeric"
                            placeholder="Ex: -23.5505"
                            placeholderTextColor="#999"
                        />
                    </View>
                    <View style={{ width: 10 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>Longitude</Text>
                        <TextInput
                            style={styles.input}
                            value={longitude}
                            onChangeText={(t) => {
                                console.log('Lng changed:', t);
                                setLongitude(t);
                            }}
                            keyboardType="numeric" 
                            placeholder="Ex: -46.6333"
                            placeholderTextColor="#999"
                        />
                    </View>
                </View>
                <Text style={styles.hint}>
                   Se o mapa não funcionar (Web), insira as coordenadas do Google Maps aqui.
                </Text>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Raio Máximo de Entrega (km)</Text>
                <TextInput
                    style={styles.input}
                    value={deliveryRadius}
                    onChangeText={setDeliveryRadius}
                    keyboardType="numeric"
                    placeholder="Ex: 10"
                />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag" size={20} color="#2196F3" />
              <Text style={styles.sectionTitle}>Taxas de Entrega por Distância</Text>
            </View>
            <Text style={styles.infoText}>
              Configure faixas de preço baseadas na distância (em km).
            </Text>

            {ranges.map((range, index) => (
                <View key={index} style={styles.rangeItem}>
                    <View style={styles.rangeRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rangeLabel}>De (km)</Text>
                            <TextInput
                                style={styles.rangeInput}
                                value={range.minDist}
                                onChangeText={(t) => updateRange(index, 'minDist', t)}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rangeLabel}>Até (km)</Text>
                            <TextInput
                                style={styles.rangeInput}
                                value={range.maxDist}
                                onChangeText={(t) => updateRange(index, 'maxDist', t)}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rangeLabel}>Preço (R$)</Text>
                            <TextInput
                                style={styles.rangeInput}
                                value={range.price}
                                onChangeText={(t) => updateRange(index, 'price', t)}
                                keyboardType="numeric"
                            />
                        </View>
                        <TouchableOpacity onPress={() => removeRange(index)} style={styles.removeButton}>
                            <Ionicons name="trash" size={20} color="#d32f2f" />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addRange}>
                <Ionicons name="add-circle" size={20} color="#2196F3" />
                <Text style={styles.addButtonText}>Adicionar Faixa</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {statusMsg && (
            <View style={[styles.statusBox, statusMsg.type === 'error' ? styles.statusError : (statusMsg.type === 'success' ? styles.statusSuccess : styles.statusInfo)]}>
                <Text style={styles.statusText}>{statusMsg.text}</Text>
            </View>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Salvar Configurações</Text>
                </>
            )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
      paddingTop: 50, 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#2196F3', 
      flexDirection: 'row', 
      alignItems: 'center' 
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
  backButton: { padding: 4 },
  
  content: { padding: 16, paddingBottom: 100 },
  
  section: { 
      backgroundColor: '#fff', 
      borderRadius: 12, 
      padding: 16, 
      marginBottom: 16, 
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, color: '#333' },
  infoText: { fontSize: 13, color: '#666', marginBottom: 16 },

  autocompleteContainer: { 
      marginBottom: 16, 
      zIndex: 1000 // Necessário para o autocomplete sobrepor
  },
  placesInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 48,
      backgroundColor: '#fff',
  },
  
  mapContainer: {
      height: 200,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: '#eee',
  },
  map: { flex: 1 },
  emptyMap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      backgroundColor: '#fff',
  },
  
  row: { flexDirection: 'row', gap: 10 },
  subLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  hint: { fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' },

  rangeItem: {
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
  },
  rangeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  rangeLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  rangeInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 6,
      padding: 8,
      fontSize: 14,
      textAlign: 'center',
  },
  removeButton: { padding: 8, paddingBottom: 12 },

  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#2196F3', borderRadius: 8, borderStyle: 'dashed' },
  addButtonText: { color: '#2196F3', fontWeight: 'bold', marginLeft: 8 },

  footer: {
      padding: 16,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#eee',
  },
  saveButton: {
      backgroundColor: '#2e7d32',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  
  statusBox: { marginBottom: 10, padding: 10, borderRadius: 8, alignItems: 'center' },
  statusError: { backgroundColor: '#ffebee' },
  statusSuccess: { backgroundColor: '#e8f5e9' },
  statusInfo: { backgroundColor: '#e3f2fd' },
  statusText: { fontWeight: 'bold', color: '#333' },
});
