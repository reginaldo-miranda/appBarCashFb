import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Switch,
    ScrollView,
    Platform,
    Alert,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { Marker, Polyline } from './NativeMap';
import Constants from 'expo-constants';
import { router } from 'expo-router';

interface DeliveryDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    // Data
    isDelivery: boolean;
    setIsDelivery: (v: boolean) => void;
    deliveryAddress: string;
    setDeliveryAddress: (v: string) => void;
    deliveryDistance: number;
    setDeliveryDistance: (v: number) => void;
    deliveryFee: number;
    setDeliveryFee: (v: number) => void;
    deliveryCoords: { lat: number, lng: number } | null;
    setDeliveryCoords: (v: { lat: number, lng: number } | null) => void;
    companyConfig: any;
    
    // Selection Handlers
    selectedCliente: any;
    onSelectClient: () => void;
    selectedEntregador: any;
    onSelectEntregador: () => void;
    user: any; // attendant

    // Actions
    onConfirm: () => void;
    loading: boolean;
    
    // Config
    GOOGLE_API_KEY: string;
}

const DeliveryDetailsModal: React.FC<DeliveryDetailsModalProps> = ({
    visible,
    onClose,
    isDelivery,
    setIsDelivery,
    deliveryAddress,
    setDeliveryAddress,
    deliveryDistance,
    setDeliveryDistance,
    deliveryFee,
    setDeliveryFee,
    deliveryCoords,
    setDeliveryCoords,
    companyConfig,
    selectedCliente,
    onSelectClient,
    selectedEntregador,
    onSelectEntregador,
    user,
    onConfirm,
    loading,
    GOOGLE_API_KEY
}) => {
    const [cep, setCep] = useState('');
    const [addressListModalVisible, setAddressListModalVisible] = useState(false);
    const [addressList, setAddressList] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    

    
    
    // Auto-search when client is selected (if address is present)


    // Refactored Search Logic to be reusable



    
    // ... existing handleCepSearch ...
    
    // Auto-search when client is selected (if address is present)
    useEffect(() => {
        if (selectedCliente && selectedCliente.endereco && isDelivery) {
            if (deliveryAddress && deliveryAddress.length > 5) {
                triggerSearch();
            }
        }
    }, [selectedCliente]); 

    const triggerSearch = async (addressOverride?: string) => {
        const addressToUse = addressOverride || deliveryAddress;

        if (!addressToUse) {
            Platform.OS === 'web' ? window.alert('Digite um endereço.') : Alert.alert('Atenção', 'Digite um endereço.');
            return;
        }

        if (!companyConfig?.latitude || !companyConfig?.longitude) {
            Platform.OS === 'web' ? window.alert('Endereço da loja não configurado.') : Alert.alert('Configuração Pendente', 'Endereço da loja não configurado.');
            return;
        }

        const doGoogleGeocode = async (addr: string) => {
            console.log('[DEBUG] doGoogleGeocode init. Address:', addr, 'API Key:', GOOGLE_API_KEY ? 'PRESENT' : 'MISSING');
            if (!GOOGLE_API_KEY) return null;
            try {
                const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_API_KEY}`;
                const res = await fetch(url);
                const json = await res.json();
                console.log('[DEBUG] Google Geocode response JSON:', JSON.stringify(json));
                
                if (json.status === 'OK' && json.results.length > 0) {
                    return json.results[0];
                } else {
                    console.warn('[DEBUG] Google Geocode failed. Status:', json.status, 'Msg:', json.error_message);
                    if (json.status === 'REQUEST_DENIED' || json.status === 'OVER_QUERY_LIMIT') {
                        Platform.OS === 'web' 
                            ? window.alert(`Google Maps recusou: ${json.error_message || json.status}. Habilite a "Geocoding API" no seu painel Google Cloud.`)
                            : Alert.alert('Google Maps Recusou', `Erro: ${json.error_message || json.status}.\n\nPor favor, acesse o painel Google Cloud Console e certifique-se de que a "Geocoding API" está ativada.`);
                    }
                }
            } catch (e) {
                console.error('Google Geocode Error:', e);
            }
            return null;
        };

        // Tentar Google Geocoding Primeiro
        if (GOOGLE_API_KEY) {
            const googleResult = await doGoogleGeocode(addressToUse);
            if (googleResult) {
                const { lat, lng } = googleResult.geometry.location;
                const formattedAddress = googleResult.formatted_address;
                
                setDeliveryAddress(formattedAddress);
                setDeliveryCoords({ lat, lng });
                
                const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng);
                const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
                setDeliveryDistance(estRoadDist);

                // SILENT SUCCESS (User Request: "creio que nao precsia mais das tela de aviso")
                // Only log or show small toast if possible. For now, silent.
                console.log(`[Google] Found: ${formattedAddress} (${estRoadDist}km)`);

                // Rota Real
                fetchDrivingDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng).then(realDist => {
                    if (realDist !== null) {
                        setDeliveryDistance(realDist);
                    }
                });
                return; // Sai se achou pelo Google
            }
        }

        const doSearch = async (addr: string) => {
            const query = encodeURIComponent(addr);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`;
            const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
            return await res.json();
        };

        const doStructuredSearch = async (street: string, city: string, state: string) => {
            const params = new URLSearchParams();
            params.append('street', street);
            if (city) params.append('city', city);
            if (state) params.append('state', state);
            params.append('countrycodes', 'br');
            params.append('format', 'json');
            params.append('limit', '1');
            
            const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
            return await res.json();
        };

        const normalizeAddress = (addr: string) => {
            return addr
                .replace(/\bCap\b\.?/gi, 'Capitão') 
                .replace(/\bCapitao\b/gi, 'Capitão')
                .replace(/\bDr\b\.?/gi, 'Doutor')
                .replace(/\bProf\b\.?/gi, 'Professor')
                .replace(/\bAv\b\.?/gi, 'Avenida')
                .replace(/\bPç\b\.?/gi, 'Praça')
                .replace(/\bAl\b\.?/gi, 'Alameda');
        };

        const stripPrefix = (addr: string) => {
            return addr.replace(/^(Rua|Avenida|Travessa|Alameda|Praça|Rodovia)\s+/i, '');
        };

        try {
            // 1. Tentar endereço exato
            let json = await doSearch(addressToUse);
            let isApprox = false;

            // 1.5 Tentar endereço normalizado
            let normAddr = normalizeAddress(addressToUse);
            if (!Array.isArray(json) || json.length === 0) {
                if (normAddr !== addressToUse) {
                    json = await doSearch(normAddr);
                    if (Array.isArray(json) && json.length > 0) {
                        setDeliveryAddress(normAddr); 
                    }
                }
            }

            // 2. Tentar remover o prefixo
            if (!Array.isArray(json) || json.length === 0) {
                const noPrefixAddr = stripPrefix(normAddr);
                if (noPrefixAddr !== normAddr) {
                    json = await doSearch(noPrefixAddr);
                }
            }

            // 3. Busca estruturada logic... (Keeping existing logic for Fallback)
            if (!Array.isArray(json) || json.length === 0) {
                const parts = normAddr.split(/[,–-]/).map(p => p.trim()).filter(p => p.length > 0);
                
                if (parts.length >= 2) {
                    const street = parts[0];
                    let city = '';
                    let state = '';
                    
                    let lastPart = parts[parts.length - 1];
                    let cityIndex = parts.length - 1;
                    
                    if (lastPart.length === 2 && isNaN(Number(lastPart))) {
                        state = lastPart;
                        cityIndex--;
                    }
                    
                    if (cityIndex > 0) {
                        let potentialCity = parts[cityIndex];
                        if (isNaN(Number(potentialCity))) {
                            city = potentialCity;
                        }
                    }

                    const removeAccents = (str: string) => {
                        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    };

                    const stripTitles = (str: string) => {
                        return str.replace(/\b(Capitão|Capitao|Cap|Doutor|Dr|Professor|Prof|General|Gen|Coronel|Cel|Major|Maj|Vereador|Ver|Deputado|Dep|Presidente|Pres)\b\.?/gi, '').trim();
                    };

                    if (street && (city || state)) {
                        let structRes = await doStructuredSearch(street, city, state);
                        
                        if (!Array.isArray(structRes) || structRes.length === 0) {
                            const streetClean = removeAccents(stripPrefix(street));
                            if (streetClean !== street) {
                                structRes = await doStructuredSearch(streetClean, city, state);
                            }
                        }

                        if (!Array.isArray(structRes) || structRes.length === 0) {
                            const streetNoTitles = stripTitles(stripPrefix(street));
                            if (streetNoTitles.length > 3 && streetNoTitles !== street) {
                                structRes = await doStructuredSearch(streetNoTitles, city, state);
                            }
                        }

                        if (!Array.isArray(structRes) || structRes.length === 0) {
                            const streetCore = removeAccents(stripTitles(stripPrefix(street)));
                            if (streetCore.length > 3 && streetCore !== street) {
                                structRes = await doStructuredSearch(streetCore, city, state);
                            }
                        }

                        if (Array.isArray(structRes) && structRes.length > 0) {
                            json = structRes;
                            isApprox = true;
                        }
                    }
                }
            }

            // 5. Fallback Finalissimo: CEP
            if ((!Array.isArray(json) || json.length === 0) && cep && cep.length === 8) {
                    const cleanCep = cep.replace(/\D/g, '');
                    const cepUrl = `https://nominatim.openstreetmap.org/search?postalcode=${cleanCep}&countrycodes=br&format=json&limit=1`;
                    const resCep = await fetch(cepUrl, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                    const jsonCep = await resCep.json();
                    
                    if (Array.isArray(jsonCep) && jsonCep.length > 0) {
                        json = jsonCep;
                        isApprox = true;
                        // Avoid Alerts for auto-calc unless critical
                    }
            }

            // 4. Fallback final: Remover numero
            if (!Array.isArray(json) || json.length === 0) {
                const cleanAddr = normAddr.replace(/[,–-]?\s*\d+\s*[,–-]?/, ','); 
                if (cleanAddr !== normAddr) {
                    const cleanAddrFinal = cleanAddr.replace(/^,|,$/g, '').trim();
                    json = await doSearch(cleanAddrFinal);
                    isApprox = true;
                }
            }

            if (Array.isArray(json) && json.length > 0) {
                const result = json[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                
                if (isApprox) {
                     // Keep using toast/log for approx
                     console.log('Endereço Aproximado (OSRM)');
                } else {
                     // Sanitize display_name for Nominatim to look like Google
                     // Remove: Região X, Brasil, Código Postal
                     const raw = result.display_name || '';
                     const parts = raw.split(',').map((p: string) => p.trim());
                     const filtered = parts.filter((p: string) => {
                         const ignore = [
                             'Região', 'Brasil', 'South Region', 'Sudeste', 
                             'Imediata', 'Geográfica', 'Metropolitana'
                         ];
                         // Filter out zip codes if they are at the end (we have a separate field or just keep it?)
                         // User wants: Rua, Bairro, Cidade, Estado.
                         // Usually Nominatim gives: Street, Hood, City, State, Region, Country
                         return !ignore.some(i => p.includes(i));
                     });
                     
                     // Reconstruct clean address
                     let clean = filtered.join(', ');
                     // Remove duplicate commas or weird endings
                     clean = clean.replace(/, \d{5}-\d{3}/, ''); // Remove CEP from string if desired
                     
                     setDeliveryAddress(clean);
                }

                setDeliveryCoords({ lat, lng: lon });
                
                const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon);
                const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
                setDeliveryDistance(estRoadDist);
                
                // Silent success for OSRM too if possible, or minimal
                // if (!isApprox) { ... success ... }

                fetchDrivingDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon).then(realDist => {
                    if (realDist !== null) {
                        setDeliveryDistance(realDist);
                    }
                });
            } else {
                // If silent fail is bad, show alert only on error
                Platform.OS === 'web' ? window.alert('Endereço não encontrado.') : Alert.alert('Erro', 'Endereço não encontrado.');
            }
        } catch (e: any) {
            console.error(e);
            Platform.OS === 'web' ? window.alert('Erro ao buscar endereço.') : Alert.alert('Erro', 'Erro ao buscar endereço.');
        }
    };

    const handleCepSearch = async () => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            Alert.alert('Erro', 'CEP inválido. Digite 8 números.');
            return;
        }
        
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await res.json();
            
            if (data.erro) {
                Alert.alert('Erro', 'CEP não encontrado.');
                return;
            }
            
            // Formata: Rua, Bairro, Cidade - UF
            const formatted = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            setDeliveryAddress(formatted);
            // Opcional: focar no campo de endereço ou já disparar busca (melhor deixar usuário por número)
            
            // Trigger calculation immediately after CEP found?
            // CEP usually gives a good address to search coordinates.
            // Trigger calculation immediately after CEP found.
            // Using explicit address to avoid async state issues.
            triggerSearch(formatted);
            
            // Removing alert as user requested less noise
            // if (Platform.OS === 'web') { ... } 
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Falha ao buscar CEP.');
        }
    };

    const fetchDrivingDistance = async (lat1: number, lon1: number, lat2: number, lon2: number) => {
        // 1. Try Google Maps API if Key is available
        if (GOOGLE_API_KEY) {
            try {
                const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat1},${lon1}&destination=${lat2},${lon2}&key=${GOOGLE_API_KEY}`;
                const res = await fetch(url);
                const json = await res.json();
                
                if (json.status === 'OK' && json.routes && json.routes.length > 0) {
                     const legs = json.routes[0].legs;
                     if (legs && legs.length > 0) {
                         const meters = legs[0].distance.value;
                         const km = parseFloat((meters / 1000).toFixed(2));
                         console.log(`[Distance] Google Maps: ${km} km`);
                         return km;
                     }
                } else {
                    console.warn('[Distance] Google Maps Error/NoRoute:', json.status);
                }
            } catch (gErr) {
                console.error('[Distance] Google Maps Request Error:', gErr);
            }
        }

        // 2. Fallback to OSRM
        try {
            console.log('[Distance] Fallback to OSRM...');
            const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
                const meters = json.routes[0].distance;
                const km = parseFloat((meters / 1000).toFixed(2));
                 console.log(`[Distance] OSRM: ${km} km`);
                return km;
            }
        } catch (error) {
            console.error('Erro OSRM:', error);
        }
        return null;
    };
    
    const handleListSearch = async () => {
        if (!deliveryAddress) {
             Platform.OS === 'web' ? window.alert('Digite parte do endereço') : Alert.alert('Erro', 'Digite parte do endereço');
             return;
        }
        
        setLoadingList(true);
        try {
            const query = encodeURIComponent(deliveryAddress);
            const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=15&countrycodes=br`;
            const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
            const data = await res.json();
            
            if (Array.isArray(data)) {
                setAddressList(data);
                setAddressListModalVisible(true);
            } else {
                 Platform.OS === 'web' ? window.alert('Nenhum endereço encontrado') : Alert.alert('Erro', 'Nenhum endereço encontrado');
            }
        } catch (error) {
            console.error(error);
             Platform.OS === 'web' ? window.alert('Erro ao buscar lista') : Alert.alert('Erro', 'Erro ao buscar lista');
        } finally {
            setLoadingList(false);
        }
    };
    
    const handleSelectAddressFromList = (item: any) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        
        setDeliveryAddress(item.display_name);
        setDeliveryCoords({ lat, lng: lon });
        
         if (companyConfig?.latitude && companyConfig?.longitude) {
            const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon);
            const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
            setDeliveryDistance(estRoadDist);
            
            if (Platform.OS === 'web') {
                 // Pequeno delay para alert não bloquear render
                 setTimeout(() => window.alert(`Endereço selecionado!\nDistância Estimada: ${estRoadDist} km\nCalculando rota real...`), 100);
            } else {
                 Alert.alert('Sucesso', `Endereço selecionado!\nDistância Estimada: ${estRoadDist} km\nCalculando rota real...`);
            }

            // Busca Rota Real em Background
            fetchDrivingDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon).then(realDist => {
                if (realDist !== null) {
                    setDeliveryDistance(realDist);
                    if (Platform.OS === 'web') {
                        setTimeout(() => window.alert(`Rota Atualizada!\nDistância Real: ${realDist} km`), 500);
                    }
                }
            });
        }
        
        setAddressListModalVisible(false);
    };
    
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; 
        const dLat = deg2rad(lat2 - lat1); 
        const dLon = deg2rad(lon2 - lon1); 
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; 
        return d;
    };
  
    const deg2rad = (deg: number) => {
      return deg * (Math.PI/180);
    };

    const handlePlaceSelect = (data: any, details: any = null) => {
        if (details && companyConfig?.latitude && companyConfig?.longitude) {
            const { lat, lng } = details.geometry.location;
            setDeliveryCoords({ lat, lng });
            setDeliveryAddress(data.description || details.formatted_address);

            // Calcular distância
            const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng);
            const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
            setDeliveryDistance(estRoadDist);

            // Busca Rota Real
            fetchDrivingDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng).then(realDist => {
                if (realDist !== null) {
                    setDeliveryDistance(realDist);
                }
            });
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Detalhes da Entrega</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                        
                        {/* Toggle Mode */}
                        <View style={styles.toggleRow}>
                            <Text style={styles.label}>Modo Delivery</Text>
                            <Switch 
                                value={isDelivery} 
                                onValueChange={(v) => {
                                    setIsDelivery(v);
                                    if (!v) {
                                        setDeliveryFee(0);
                                        setDeliveryDistance(0);
                                    }
                                }} 
                            />
                        </View>

                        {isDelivery && (
                            <>
                                {/* Client & Employee Selectors */}
                                <View style={styles.section}>
                                    <View style={[styles.selectorItem, { paddingRight: 8 }]}>
                                        <Ionicons name="person" size={20} color="#666" style={{ width: 30 }} />
                                        <TouchableOpacity onPress={onSelectClient} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View>
                                                <Text style={styles.selectorLabel}>Cliente</Text>
                                                <Text style={styles.selectorValue}>
                                                    {selectedCliente ? selectedCliente.nome : 'Selecionar Cliente'}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                            style={{ 
                                                marginLeft: 10, 
                                                backgroundColor: '#E3F2FD', 
                                                padding: 8, 
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: '#2196F3'
                                            }}
                                            onPress={() => {
                                                onClose(); // Fecha o modal atual
                                                router.push({
                                                    pathname: '/(tabs)/admin-clientes',
                                                    params: { autoOpen: 'true', returnTo: 'delivery' }
                                                });
                                            }}
                                        >
                                            <Ionicons name="add" size={22} color="#2196F3" />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity onPress={onSelectEntregador} style={styles.selectorItem}>
                                        <Ionicons name="bicycle" size={20} color="#666" style={{ width: 30 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.selectorLabel}>Entregador</Text>
                                            <Text style={styles.selectorValue}>
                                                {selectedEntregador ? selectedEntregador.nome : 'Selecionar Entregador'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                                    </TouchableOpacity>
                                    
                                    <View style={styles.selectorItemNoBorder}>
                                        <Ionicons name="id-card" size={20} color="#666" style={{ width: 30 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.selectorLabel}>Atendente</Text>
                                            <Text style={[styles.selectorValue, { color: '#000' }]}>
                                                {user?.nome || 'Desconhecido'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Address Section */}
                                <Text style={styles.sectionTitle}>Endereço de Entrega</Text>
                                
                                {/* CEP Input */}
                                <View style={styles.webAddressContainer}>
                                    <TextInput 
                                        style={styles.webInput} 
                                        placeholder="CEP (apenas números)" 
                                        value={cep}
                                        onChangeText={(t) => setCep(t.replace(/\D/g, ''))}
                                        keyboardType="numeric"
                                        maxLength={8}
                                    />
                                    <TouchableOpacity 
                                        style={[styles.webSearchButton, { backgroundColor: '#607D8B' }]}
                                        onPress={handleCepSearch}
                                    >
                                        <Ionicons name="search" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                
                                {Platform.OS !== 'web' ? (
                                    <View style={{ height: 44, marginBottom: 10, zIndex: 9999 }}>
                                        <GooglePlacesAutocomplete
                                            placeholder='Buscar endereço...'
                                            onPress={handlePlaceSelect}
                                            query={{
                                                key: GOOGLE_API_KEY,
                                                language: 'pt-BR',
                                            }}
                                            fetchDetails={true}
                                            styles={{
                                                textInput: styles.placesInput,
                                                listView: { zIndex: 10000, position: 'absolute', top: 40, width: '100%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' }
                                            }}
                                            enablePoweredByContainer={false}
                                            textInputProps={{
                                                value: deliveryAddress,
                                                onChangeText: setDeliveryAddress
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.webAddressContainer}>
                                        <TextInput 
                                            style={styles.webInput} 
                                            placeholder="Ex: Av Paulista, 1000, São Paulo" 
                                            value={deliveryAddress}
                                            onChangeText={setDeliveryAddress}
                                        />
                                        <TouchableOpacity 
                                            style={styles.webSearchButton}
                                            onPress={async () => {
                                                const safeAlert = (title: string, msg: string) => {
                                                    setTimeout(() => window.alert(`${title}\n${msg}`), 50);
                                                };

                                                if (!deliveryAddress) {
                                                    safeAlert('Atenção', 'Digite um endereço.');
                                                    return;
                                                }

                                                if (!companyConfig?.latitude || !companyConfig?.longitude) {
                                                    safeAlert('Configuração Pendente', 'Endereço da loja não configurado.');
                                                    return;
                                                }

                                                const doGoogleGeocode = async (addr: string) => {
                                                    console.log('[DEBUG-2] doGoogleGeocode init. Address:', addr, 'API Key:', GOOGLE_API_KEY ? 'PRESENT' : 'MISSING');
                                                    if (!GOOGLE_API_KEY) return null;
                                                    try {
                                                        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_API_KEY}`;
                                                        const res = await fetch(url);
                                                        const json = await res.json();
                                                        console.log('[DEBUG-2] Google Geocode response JSON:', JSON.stringify(json));
                                                        
                                                        if (json.status === 'OK' && json.results.length > 0) {
                                                            return json.results[0];
                                                        } else {
                                                            console.warn('[DEBUG-2] Google Geocode failed. Status:', json.status, 'Msg:', json.error_message);
                                                            if (json.status === 'REQUEST_DENIED' || json.status === 'OVER_QUERY_LIMIT') {
                                                                Platform.OS === 'web' 
                                                                    ? window.alert(`Google Maps recusou: ${json.error_message || json.status}. Habilite a "Geocoding API" no seu painel Google Cloud.`)
                                                                    : Alert.alert('Google Maps Recusou', `Erro: ${json.error_message || json.status}.\n\nPor favor, acesse o painel Google Cloud Console e certifique-se de que a "Geocoding API" está ativada.`);
                                                            }
                                                        }
                                                    } catch (e) {
                                                        console.error('Google Geocode Error:', e);
                                                    }
                                                    return null;
                                                };

                                                // Tentar Google Geocoding Primeiro
                                                if (GOOGLE_API_KEY) {
                                                    const googleResult = await doGoogleGeocode(deliveryAddress);
                                                    if (googleResult) {
                                                        const { lat, lng } = googleResult.geometry.location;
                                                        const formattedAddress = googleResult.formatted_address;
                                                        
                                                        setDeliveryAddress(formattedAddress);
                                                        setDeliveryCoords({ lat, lng });
                                                        
                                                        const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng);
                                                        const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
                                                        setDeliveryDistance(estRoadDist);

                                                        if (Platform.OS === 'web') {
                                                            setTimeout(() => window.alert(`Endereço Encontrado (Google)!\n${formattedAddress}\n\nDistância Estimada: ${estRoadDist} km`), 100);
                                                        } else {
                                                            Alert.alert('Sucesso', `Endereço Encontrado (Google)!\n${formattedAddress}\n\nDistância Estimada: ${estRoadDist} km`);
                                                        }

                                                        // Rota Real
                                                        fetchDrivingDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng).then(realDist => {
                                                            if (realDist !== null) {
                                                                setDeliveryDistance(realDist);
                                                            }
                                                        });
                                                        return; // Sai se achou pelo Google
                                                    }
                                                }

                                                const doSearch = async (addr: string) => {
                                                    const query = encodeURIComponent(addr);
                                                    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`;
                                                    // Usar um UA mais descritivo para evitar bloqueios, idealmente com contato
                                                    const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                                                    return await res.json();
                                                };

                                                const doStructuredSearch = async (street: string, city: string, state: string) => {
                                                    const params = new URLSearchParams();
                                                    params.append('street', street);
                                                    if (city) params.append('city', city);
                                                    if (state) params.append('state', state);
                                                    params.append('countrycodes', 'br');
                                                    params.append('format', 'json');
                                                    params.append('limit', '1');
                                                    
                                                    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
                                                    const res = await fetch(url, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                                                    return await res.json();
                                                };

                                                const normalizeAddress = (addr: string) => {
                                                    return addr
                                                        .replace(/\bCap\b\.?/gi, 'Capitão') // Ajuste no regex para pegar Cap ou Cap.
                                                        .replace(/\bCapitao\b/gi, 'Capitão')
                                                        .replace(/\bDr\b\.?/gi, 'Doutor')
                                                        .replace(/\bProf\b\.?/gi, 'Professor')
                                                        .replace(/\bAv\b\.?/gi, 'Avenida')
                                                        .replace(/\bPç\b\.?/gi, 'Praça')
                                                        .replace(/\bAl\b\.?/gi, 'Alameda');
                                                };

                                                const stripPrefix = (addr: string) => {
                                                    return addr.replace(/^(Rua|Avenida|Travessa|Alameda|Praça|Rodovia)\s+/i, '');
                                                };

                                                try {
                                                    // 1. Tentar endereço exato (Query completa)
                                                    let json = await doSearch(deliveryAddress);
                                                    let isApprox = false;

                                                    // 1.5 Tentar endereço normalizado
                                                    let normAddr = normalizeAddress(deliveryAddress);
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        if (normAddr !== deliveryAddress) {
                                                            json = await doSearch(normAddr);
                                                            if (Array.isArray(json) && json.length > 0) {
                                                                setDeliveryAddress(normAddr); 
                                                            }
                                                        }
                                                    }

                                                    // 2. Tentar remover o prefixo (Ex: "Capitão..." em vez de "Rua Capitão...")
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        const noPrefixAddr = stripPrefix(normAddr);
                                                        if (noPrefixAddr !== normAddr) {
                                                            json = await doSearch(noPrefixAddr);
                                                            // Se achar sem prefixo, é válido
                                                        }
                                                    }

                                                    // 3. Se falhar, tentar busca estruturada (Separando por vírgula ou hífen)
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        const parts = normAddr.split(/[,–-]/).map(p => p.trim()).filter(p => p.length > 0);
                                                        
                                                        if (parts.length >= 2) {
                                                            const street = parts[0];
                                                            let city = '';
                                                            let state = '';
                                                            
                                                            let lastPart = parts[parts.length - 1];
                                                            let cityIndex = parts.length - 1;
                                                            
                                                            if (lastPart.length === 2 && isNaN(Number(lastPart))) {
                                                                state = lastPart;
                                                                cityIndex--;
                                                            }
                                                            
                                                            if (cityIndex > 0) {
                                                                let potentialCity = parts[cityIndex];
                                                                if (isNaN(Number(potentialCity))) {
                                                                    city = potentialCity;
                                                                }
                                                            }

                                                            const removeAccents = (str: string) => {
                                                                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                            };

                                                            const stripTitles = (str: string) => {
                                                                return str.replace(/\b(Capitão|Capitao|Cap|Doutor|Dr|Professor|Prof|General|Gen|Coronel|Cel|Major|Maj|Vereador|Ver|Deputado|Dep|Presidente|Pres)\b\.?/gi, '').trim();
                                                            };

                                                            if (street && (city || state)) {
                                                                // 1. Estruturada Normal
                                                                let structRes = await doStructuredSearch(street, city, state);
                                                                
                                                                // 2. Estruturada Sem Acentos e Sem 'Rua'
                                                                if (!Array.isArray(structRes) || structRes.length === 0) {
                                                                    const streetClean = removeAccents(stripPrefix(street));
                                                                    if (streetClean !== street) {
                                                                        structRes = await doStructuredSearch(streetClean, city, state);
                                                                    }
                                                                }

                                                                // 3. Estruturada Sem Títulos (Ex: "Capitão Angelo" -> "Angelo")
                                                                // Isso ajuda muito quando o usuário erra o título ou abreviação
                                                                if (!Array.isArray(structRes) || structRes.length === 0) {
                                                                    const streetNoTitles = stripTitles(stripPrefix(street));
                                                                    if (streetNoTitles.length > 3 && streetNoTitles !== street) { // Só busca se sobrou algo relevante
                                                                        structRes = await doStructuredSearch(streetNoTitles, city, state);
                                                                    }
                                                                }

                                                                // 4. Última tentativa: Sem títulos e sem acentos (Core Name puríssimo)
                                                                if (!Array.isArray(structRes) || structRes.length === 0) {
                                                                    const streetCore = removeAccents(stripTitles(stripPrefix(street)));
                                                                    if (streetCore.length > 3 && streetCore !== street) {
                                                                        structRes = await doStructuredSearch(streetCore, city, state);
                                                                    }
                                                                }
                                                                

                                                                
                                                                if (Array.isArray(structRes) && structRes.length > 0) {
                                                                    json = structRes;
                                                                    isApprox = true;
                                                                }
                                                            }
                                                        }
                                                    }

                                                    // 5. Fallback Finalissimo: Tentar busca pelo CEP (que temos no estado)
                                                    // Se tudo falhou, mas temos um CEP válido, pegamos a coordenada do CEP.
                                                    // Isso garante que o cálculo de entrega funcione.
                                                    if ((!Array.isArray(json) || json.length === 0) && cep && cep.length === 8) {
                                                         const cleanCep = cep.replace(/\D/g, '');
                                                         // Formato aceito pelo nominatim: q=CEP ou postalcode=CEP
                                                         // Vamos usar estruturado
                                                         const cepUrl = `https://nominatim.openstreetmap.org/search?postalcode=${cleanCep}&countrycodes=br&format=json&limit=1`;
                                                         const resCep = await fetch(cepUrl, { headers: { 'User-Agent': 'BarApp/1.0 (admin@barapp.com)' }});
                                                         const jsonCep = await resCep.json();
                                                         
                                                         if (Array.isArray(jsonCep) && jsonCep.length > 0) {
                                                             json = jsonCep;
                                                             isApprox = true;
                                                             // Aviso que foi pelo CEP
                                                             safeAlert('Aviso', 'Endereço exato não localizado. Usando localização do CEP para cálculo.');
                                                         }
                                                    }

                                                    // 4. Fallback final: Remover número da string NORMALIZADA
                                                    if (!Array.isArray(json) || json.length === 0) {
                                                        // Remover número isolado por vírgulas ou hifens
                                                        const cleanAddr = normAddr.replace(/[,–-]?\s*\d+\s*[,–-]?/, ','); 
                                                        if (cleanAddr !== normAddr) {
                                                            const cleanAddrFinal = cleanAddr.replace(/^,|,$/g, '').trim(); // Limpa vírgulas soltas
                                                            json = await doSearch(cleanAddrFinal);
                                                            isApprox = true;
                                                        }
                                                    }

                                                    if (Array.isArray(json) && json.length > 0) {
                                                        const result = json[0];
                                                        const lat = parseFloat(result.lat);
                                                        const lon = parseFloat(result.lon);
                                                        
                                                        // Se foi aproximado, manter o texto original digitado, mas usar coord da rua
                                                         if (isApprox) {
                                                             safeAlert('Endereço Aproximado', 'Número não encontrado exato. Usando centro da rua/bairro para cálculo.');
                                                         } else {
                                                             setDeliveryAddress(result.display_name); // Atualiza com o formatado bonitinho se for exato
                                                         }

                                                        setDeliveryCoords({ lat, lng: lon });
                                                        
                                                        const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon);
                                                        const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2));
                                                        setDeliveryDistance(estRoadDist);
                                                        
                                                        if (!isApprox) {
                                                           if (Platform.OS === 'web') {
                                                               setTimeout(() => window.alert(`Endereço Encontrado!\nDistância Estimada: ${estRoadDist} km\nCalculando rota real...`), 100);
                                                           } else {
                                                               Alert.alert('Sucesso', `Endereço Encontrado!\nDistância Estimada: ${estRoadDist} km\nCalculando rota real...`);
                                                           }
                                                        }

                                                        // Busca Rota Real
                                                        fetchDrivingDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lon).then(realDist => {
                                                            if (realDist !== null) {
                                                                setDeliveryDistance(realDist);
                                                                if (!isApprox && Platform.OS === 'web') {
                                                                    setTimeout(() => window.alert(`Rota Atualizada!\nDistância Real: ${realDist} km`), 500);
                                                                }
                                                            }
                                                        });
                                                    } else {
                                                        safeAlert('Não encontrado', 'Tente verificar a formatação (Rua, Número, Cidade - UF).');
                                                    }
                                                } catch (e: any) {
                                                    console.error(e);
                                                    safeAlert('Erro', 'Falha ao buscar endereço.');
                                                }
                                            }}
                                        >
                                            <Text style={styles.webSearchButtonText}>Buscar</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                            style={[styles.webSearchButton, { backgroundColor: '#673AB7', marginLeft: 10 }]}
                                            onPress={handleListSearch}
                                        >
                                            <Text style={styles.webSearchButtonText}>Listagem</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            style={[styles.webSearchButton, { backgroundColor: '#4CAF50', marginLeft: 10 }]}
                                            onPress={() => {
                                                const query = deliveryCoords 
                                                    ? `${deliveryCoords.lat},${deliveryCoords.lng}` 
                                                    : encodeURIComponent(deliveryAddress || '');
                                                if (query) {
                                                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
                                                } else {
                                                    Platform.OS === 'web' ? window.alert('Digite um endereço para abrir no Maps') : Alert.alert('Erro', 'Digite um endereço');
                                                }
                                            }}
                                        >
                                            <Ionicons name="map" size={20} color="#fff" />
                                        </TouchableOpacity>
                                        

                                    </View>
                                )}

                                {/* Map */}
                                {Platform.OS !== 'web' && companyConfig?.latitude && companyConfig?.longitude && deliveryCoords && (
                                    <View style={styles.mapContainer}>
                                        <MapView
                                            style={{ flex: 1 }}
                                            initialRegion={{
                                                latitude: Number(companyConfig.latitude),
                                                longitude: Number(companyConfig.longitude),
                                                latitudeDelta: 0.05,
                                                longitudeDelta: 0.05,
                                            }}
                                        >
                                            <Marker coordinate={{ latitude: Number(companyConfig.latitude), longitude: Number(companyConfig.longitude) }} title="Loja" pinColor="blue" />
                                            <Marker coordinate={{ latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }} title="Cliente" />
                                            <Polyline 
                                                coordinates={[
                                                    { latitude: Number(companyConfig.latitude), longitude: Number(companyConfig.longitude) },
                                                    { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }
                                                ]}
                                                strokeColor="#2196F3"
                                                strokeWidth={3}
                                            />
                                        </MapView>
                                    </View>
                                )}

                                {/* Info Row */}
                                <View style={styles.infoRow}>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoLabel}>Distância</Text>
                                        <Text style={styles.infoValue}>{deliveryDistance.toFixed(2)} km</Text>
                                    </View>
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoLabel}>Taxa</Text>
                                        <Text style={styles.infoValue}>R$ {deliveryFee.toFixed(2)}</Text>
                                    </View>
                                </View>
                            </>
                        )}




                    {/* Footer Actions (Moved inside ScrollView) */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Voltar</Text>
                        </TouchableOpacity>
                        
                        {isDelivery && (
                            <TouchableOpacity 
                                style={[styles.confirmButton, loading && { opacity: 0.7 }]} 
                                onPress={() => onConfirm()}
                                disabled={loading}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {loading ? 'Processando...' : 'Lançar Entrega & Imprimir'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    </ScrollView>

                </View>
            </View>
            
             {/* Modal de Listagem de Endereços */}
            <Modal
                visible={addressListModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAddressListModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                         <View style={styles.header}>
                            <Text style={styles.title}>Selecione o Endereço</Text>
                            <TouchableOpacity onPress={() => setAddressListModalVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        
                        {loadingList ? (
                             <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                 <Text>Carregando...</Text>
                             </View>
                        ) : (
                            <ScrollView contentContainerStyle={{ padding: 16 }}>
                                {addressList.map((item, index) => (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                                        onPress={() => handleSelectAddressFromList(item)}
                                    >
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                                            {item.display_name.split(',')[0]}
                                        </Text>
                                        <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                                            {item.display_name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {addressList.length === 0 && (
                                     <Text style={{ textAlign: 'center', marginTop: 20, color: '#888' }}>
                                         Nenhum resultado encontrado.
                                     </Text>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        maxHeight: '90%',
        minHeight: 400,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8, // Compact
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333'
    },
    closeButton: {
        padding: 4
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
        backgroundColor: '#f8f9fa',
        padding: 8,
        borderRadius: 8
    },
    label: {
        fontSize: 14,
        fontWeight: '500', 
        color: '#333'
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 8
    },
    selectorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    selectorItemNoBorder: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8
    },
    selectorLabel: {
        fontSize: 11,
        color: '#888'
    },
    selectorValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333'
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 4, 
        marginTop: 6
    },
    placesInput: {
        height: 36,
        color: '#333',
        fontSize: 14,
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        borderRadius: 6
    },
    webAddressContainer: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 6,
        alignItems: 'center'
    },
    webInput: {
        flex: 1,
        height: 36,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
        fontSize: 13
    },
    webSearchButton: {
        backgroundColor: '#2196F3',
        justifyContent: 'center',
         height: 36,
        paddingHorizontal: 10,
        borderRadius: 6
    },
    webSearchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12
    },
    mapContainer: {
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 4,
        marginBottom: 6
    },
    infoRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8
    },
    infoBox: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 6,
        borderRadius: 8,
        alignItems: 'center'
    },
    infoLabel: {
        fontSize: 11,
        color: '#666',
        marginBottom: 0
    },
    infoValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2196F3'
    },
    footer: {
        flexDirection: 'row',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        gap: 8
    },
    cancelButton: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: 'bold'
    },
    confirmButton: {
        flex: 2,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF9800',
        borderRadius: 8
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});

export default DeliveryDetailsModal;
