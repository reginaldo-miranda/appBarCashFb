import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItem } from '../types/index';

interface SaleItemsModalProps {
  visible: boolean;
  items: CartItem[];
  total: number;
  onClose: () => void;
  onAddItems: () => void;
  onIncrementItem: (item: CartItem) => void;
  onDecrementItem: (item: CartItem) => void;
  onRemoveItem: (item: CartItem) => void;
  onFinalize?: () => void;
}

const SaleItemsModal: React.FC<SaleItemsModalProps> = ({ visible, items, total, onClose, onAddItems, onIncrementItem, onDecrementItem, onRemoveItem, onFinalize }) => {
  const [confirmDialog, setConfirmDialog] = useState<{
    item: CartItem;
    type: 'decrement' | 'remove';
    message: string;
  } | null>(null);

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemName}>{item.nomeProduto}</Text>
        {item.variacao && item.variacao.regraPreco === 'fixo' && (
          <View style={{ marginTop: 2 }}>
            {(Array.isArray(item.variacao.opcoes) ? item.variacao.opcoes : []).map((o, idx) => (
              <Text key={idx} style={{ fontSize: 11, color: '#666' }}>
                {o.nome}
              </Text>
            ))}
          </View>
        )}
      </View>
      <View style={styles.itemRight}>
        <View style={styles.itemActions}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => {
              const isRemoving = (item?.quantidade ?? 0) <= 1;
              setConfirmDialog({
                item,
                type: 'decrement',
                message: isRemoving 
                  ? `Deseja remover ${item?.nomeProduto || 'este produto'} da venda?`
                  : `Deseja diminuir a quantidade de ${item?.nomeProduto || 'este produto'}?`
              });
            }}
          >
            <Ionicons name="remove" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.itemQuantity}>{item.quantidade}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={() => onIncrementItem(item)}>
            <Ionicons name="add" size={20} color="#333" />
          </TouchableOpacity>
        </View>
        <Text style={styles.itemSubtotal}>R$ {item.subtotal?.toFixed(2)}</Text>
        <TouchableOpacity
           style={styles.trashButton}
           onPress={() => {
             setConfirmDialog({
               item,
               type: 'remove',
               message: `Deseja remover ${item?.nomeProduto || 'este produto'} da venda?`
             });
           }}
         >
           <Ionicons name="trash-outline" size={20} color="#b00020" />
         </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Itens da Venda</Text>
            <Text style={styles.headerCount}>({items.length} itens)</Text>
          </View>
          <Text style={styles.headerTotal}>R$ {total.toFixed(2)}</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum item adicionado</Text>
            <Text style={styles.emptySubtext}>Use o botão abaixo para adicionar itens</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item, index) => (item._id ? String(item._id) : `${item.produto?._id ?? 'sem-id'}-${index}`)}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.footerButton, styles.addButton]} onPress={onAddItems}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.footerButtonText}>Adicionar</Text>
          </TouchableOpacity>

          {onFinalize && items.length > 0 && (
            <TouchableOpacity style={[styles.footerButton, styles.finalizeButton]} onPress={onFinalize}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.footerButtonText}>Continuar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.footerButton, styles.closeButton]} onPress={onClose}>
            <Ionicons name="close" size={18} color="#333" />
            <Text style={styles.footerButtonTextClose}>Fechar</Text>
          </TouchableOpacity>
        </View>

        {/* Modal de Confirmação Visual (100% compatível com Safari iOS e Android) */}
        {confirmDialog && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconWrap}>
                <Ionicons name="alert-circle" size={32} color="#D32F2F" />
              </View>
              <Text style={styles.confirmTitle}>Confirmar</Text>
              <Text style={styles.confirmMessage}>{confirmDialog.message}</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnCancel]}
                  onPress={() => setConfirmDialog(null)}
                >
                  <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnConfirm]}
                  onPress={() => {
                    const action = confirmDialog;
                    setConfirmDialog(null);
                    if (action.type === 'decrement') {
                      onDecrementItem(action.item);
                    } else {
                      onRemoveItem(action.item);
                    }
                  }}
                >
                  <Text style={styles.confirmBtnConfirmText}>Sim, Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  headerTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 250,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemLeft: {
    flex: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  itemPrice: {
    fontSize: 11,
    color: '#666',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  iconButton: {
    padding: 3,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
    color: '#333',
    marginHorizontal: 4,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2196F3',
    minWidth: 60,
    textAlign: 'right',
  },
  trashButton: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButton: {
    backgroundColor: '#2196F3',
    marginRight: 8,
  },
  closeButton: {
    backgroundColor: '#eee',
    marginLeft: 8,
  },
  finalizeButton: {
    backgroundColor: '#FF9800',
    marginHorizontal: 8,
  },
  footerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  footerButtonTextClose: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnCancel: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  confirmBtnCancelText: {
    color: '#616161',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmBtnConfirm: {
    backgroundColor: '#D32F2F',
  },
  confirmBtnConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default SaleItemsModal;