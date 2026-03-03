import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { customerService } from '../services/api';

interface CpfModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (data: { cpf: string; nome: string; endereco: string; id?: number }) => void;
  initialData?: { cpf?: string; nome?: string; endereco?: string; id?: number };
}

export default function CpfModal({ visible, onClose, onConfirm, initialData }: CpfModalProps) {
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<number | undefined>(undefined);

  const cpfInputRef = useRef<TextInput>(null);
  const nomeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      if (initialData) {
          setCpf(initialData.cpf || '');
          setNome(initialData.nome || '');
          setEndereco(initialData.endereco || '');
          setExistingId(initialData.id);
          // Foca no nome se já tiver CPF, se não no CPF.
          setTimeout(() => {
              if (initialData.cpf) nomeInputRef.current?.focus();
              else cpfInputRef.current?.focus();
          }, 100);
      } else {
          setCpf('');
          setNome('');
          setEndereco('');
          setExistingId(undefined);
          setTimeout(() => cpfInputRef.current?.focus(), 100);
      }
    }
  }, [visible, initialData]);

  // Função para buscar cliente ao digitar CPF (pode ser no onBlur ou após X dígitos)
  const handleCpfChange = async (text: string) => {
    // Remove caracteres não numéricos
    const rawIds = text.replace(/\D/g, '');
    setCpf(rawIds);

    // Se tiver 11 dígitos (CPF) ou 14 (CNPJ), tenta buscar
    if (rawIds.length === 11 || rawIds.length === 14) {
        if (loading) return;
        setLoading(true);
        try {
            // Tenta buscar por CPF exato
            // A API precisa suportar esse método. Vamos garantir que exista.
            const response = await customerService.getByCpf(rawIds);
            const customer = response.data;
            
            if (customer) {
                setNome(customer.nome || '');
                setEndereco(customer.endereco || '');
                setExistingId(customer.id);
            }
        } catch (error) {
            // Se não achar (404), limpa campos para cadastro novo
            // Não é erro crítico, apenas não cadastrado
            setExistingId(undefined);
            // Mantém nome/endereço vazio ou limpa? Melhor limpar para evitar confusão
            // Mas se o usuário já digitou nome antes de terminar CPF, não limpar.
            // Assumindo fluxo sequencial: CPF -> Nome
        } finally {
            setLoading(false);
        }
    }
  };

  const handleConfirm = () => {
    if (!cpf || cpf.length < 11) {
        if (Platform.OS === 'web') {
            window.alert('Atenção: Informe um CPF/CNPJ válido.');
        } else {
            Alert.alert('Atenção', 'Informe um CPF/CNPJ válido.');
        }
        return;
    }
    
    // Retorna os dados para o pai processar (criar ou usar existente)
    onConfirm({
        cpf,
        nome,
        endereco,
        id: existingId
    });
  };

  // Handler para teclas de atalho (Web)
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
        const handleKeyDown = (e: any) => {
             if (e.key === 'F10') {
                 e.preventDefault();
                 handleConfirm();
             }
             if (e.key === 'Escape') {
                 e.preventDefault();
                 onClose();
             }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, cpf, nome, endereco, existingId]); // Depedencies needed for closure variables in handleConfirm

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
            {/* Header / Title Bar style similar to image */}
            <View style={styles.header}>
                <Text style={styles.title}>Identificação do cliente para o cupom fiscal</Text>
                <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.inputRow}>
                    <Text style={styles.label}>CPF/CNPJ</Text>
                    <View style={{ flex: 1, maxWidth: 200, flexDirection: 'row', alignItems: 'center' }}>
                         <TextInput
                            ref={cpfInputRef}
                            style={styles.input}
                            value={cpf}
                            onChangeText={handleCpfChange}
                            keyboardType="numeric"
                            maxLength={14}
                            onSubmitEditing={() => nomeInputRef.current?.focus()}
                         />
                         {loading && <ActivityIndicator size="small" color="#2196F3" style={{ marginLeft: 8 }} />}
                    </View>
                </View>

                <View style={styles.inputRow}>
                    <Text style={styles.label}>Nome</Text>
                    <TextInput
                        ref={nomeInputRef}
                        style={[styles.input, { flex: 1 }]}
                        value={nome}
                        onChangeText={setNome}
                        placeholder="Nome do Cliente"
                    />
                </View>

                <View style={styles.inputRow}>
                    <Text style={styles.label}>Endereço</Text>
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={endereco}
                        onChangeText={setEndereco}
                        placeholder="Endereço (opcional)"
                    />
                </View>

                <View style={styles.footerButtons}>
                    <TouchableOpacity style={styles.btnConfirmar} onPress={handleConfirm}>
                        <Text style={styles.btnText}>F10 Confirmar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.btnCancelar} onPress={onClose}>
                        <Text style={styles.btnText}>{'<Esc>'} Não usar</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 600,
    maxWidth: '95%',
    backgroundColor: '#dcdcdc', // Fundo cinza como na imagem
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#aaa',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    // Altura ajustavel
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    // Sem cor de fundo ou borda explicita na imagem, parece ser tudo cinza
  },
  title: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'normal',
  },
  content: {
    padding: 20,
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    width: 80,
    textAlign: 'right',
    marginRight: 10,
    fontSize: 14,
    color: '#000',
    fontWeight: 'bold', // Labels parecem negrito na imagem
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#999',
    height: 30, // Inputs mais finos estilo desktop
    paddingHorizontal: 5,
    fontSize: 14,
    borderRadius: 2,
    color: '#000',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 15,
  },
  btnConfirmar: {
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#999',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 120,
    alignItems: 'center',
    // Sombra leve para parecer botão desktop
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  btnCancelar: {
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#999',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 120,
    alignItems: 'center',
     shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  btnText: {
    fontSize: 13,
    color: '#000',
    fontWeight: 'bold',
  }
});
