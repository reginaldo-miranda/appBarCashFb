import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { events } from '../utils/eventBus';

// Using hover on web often requires 'onMouseEnter' / 'onMouseLeave' which are available on View in React Native Web
// but sometimes require 'cursor: pointer'.

export default function WebDropdownMenu() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menus = [
    {
      label: 'Produtos',
      sub: [
        { label: 'Relatórios', route: '/(tabs)/admin-relatorios' },
        { label: 'Gerenciar Produtos', route: '/(tabs)/admin-produtos' },
        { label: 'Tipos (Sabores)', route: '/tipos/listagem' },
        { label: 'Variações', route: '/variacoes/tipos' },
        { label: 'Categorias', route: '/categorias/listagem' },
        { label: 'Unidades de Medida', route: '/unidades/listagem' },
        { label: 'Setores de Impressão', route: '/setores/listagem' },
      ]
    },
    {
      label: 'Clientes',
      sub: [
        { label: 'Cadastro', route: '/(tabs)/admin-clientes' },
        { label: 'Relatórios', route: '/(tabs)/admin-relatorios' },
      ]
    },
    {
      label: 'Funcionários',
      sub: [
        { label: 'Cadastro', route: '/(tabs)/admin-funcionarios' },
        { label: 'Relatórios', route: '/(tabs)/admin-relatorios' },
      ]
    },
    {
      label: 'Configurações',
      sub: [
        { label: 'Auto Config', route: '/(tabs)/admin-configuracoes' },
        { label: 'Delivery', route: '/delivery-config' },
      ]
    },
    {
      label: 'ADM Relatórios',
      route: '/(tabs)/admin-relatorios'
    },
    {
      label: 'Conectar Celular 📱',
      route: null,
      onPress: () => {
        events.emit('qrcode:open');
      }
    }
  ];

  return (
    <View style={styles.container}>
      {menus.map((menu, idx) => (
        <View 
            key={idx} 
            style={[styles.menuItem, activeMenu === menu.label && styles.menuItemActive]}
            // @ts-ignore - React Native Web specific props
            onMouseEnter={() => setActiveMenu(menu.label)}
            onMouseLeave={() => setActiveMenu(null)}
        >
          <TouchableOpacity 
             onPress={() => {
                 if (menu.route) {
                   router.push(menu.route as any);
                 } else if ((menu as any).onPress) {
                   (menu as any).onPress();
                 }
             }}
             style={menu.label.includes('Celular') ? styles.celularBtn : styles.menuLabelBtn}
          >
            <Text style={menu.label.includes('Celular') ? styles.celularText : [styles.menuText, activeMenu === menu.label && styles.menuTextActive]}>
                {menu.label}
            </Text>
            {menu.sub && (
                <Ionicons name="chevron-down" size={14} color={activeMenu === menu.label ? '#fff' : '#e0e0e0'} style={{ marginLeft: 6}} />
            )}
          </TouchableOpacity>

          {/* Dropdown */}
          {menu.sub && activeMenu === menu.label && (
            <View style={styles.dropdown}>
              {menu.sub.map((sub, sIdx) => (
                <TouchableOpacity 
                    key={sIdx} 
                    style={styles.dropdownItem}
                    onPress={() => {
                        setActiveMenu(null);
                        router.push(sub.route as any);
                    }}
                >
                    <Text style={styles.dropdownText}>{sub.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1976D2', // Darker blue for menu bar
    paddingHorizontal: 20,
    zIndex: 9999, // Ensure it floats above other content
    height: 50,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuItem: {
    marginRight: 20,
    height: '100%',
    justifyContent: 'center',
    position: 'relative', // For absolute dropdown positioning
  },
  menuItemActive: {
      borderBottomWidth: 3,
      borderBottomColor: '#FFC107', // Highlight color
  },
  menuLabelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      height: '100%',
      // @ts-ignore
      cursor: 'pointer'
  },
  menuText: {
    color: '#E3F2FD',
    fontWeight: '600',
    fontSize: 15,
  },
  menuTextActive: {
      color: '#fff',
      fontWeight: 'bold',
  },
  dropdown: {
    position: 'absolute',
    top: 50, // Matches container height
    left: 0,
    backgroundColor: '#fff',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    borderRadius: 6,
    borderTopLeftRadius: 0,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    // @ts-ignore
    cursor: 'pointer'
  },
  dropdownText: {
    color: '#444',
    fontSize: 14,
  },
  celularBtn: {
    backgroundColor: '#FF8C00', // Laranja premium em harmonia com a paleta
    borderRadius: 20,           // Formato pílula elegante
    paddingVertical: 5,         // Ajustado para caber perfeitamente na altura da barra
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginLeft: 15,
    flexDirection: 'row',
    alignItems: 'center',
    // @ts-ignore
    cursor: 'pointer'
  },
  celularText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
