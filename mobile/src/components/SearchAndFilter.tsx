import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface FilterOption {
  key: string;
  label: string;
  icon?: string;
  color?: string;
}

interface SearchAndFilterProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  selectedFilter?: string;
  onFilterChange?: (filterKey: string) => void;
  showFilters?: boolean;
  style?: any;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchText,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters = [],
  selectedFilter,
  onFilterChange,
  showFilters = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Barra de Busca */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={onSearchChange}
        />
        {searchText.length > 0 && (
          <TouchableOpacity 
            onPress={() => onSearchChange('')} 
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros por Categoria */}
      {showFilters && filters.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                selectedFilter === filter.key && styles.filterButtonActive,
                filter.color && selectedFilter === filter.key && { backgroundColor: filter.color }
              ]}
              onPress={() => onFilterChange?.(filter.key)}
            >
              {filter.icon && (
                <Ionicons 
                  name={filter.icon as any} 
                  size={16} 
                  color={selectedFilter === filter.key ? '#fff' : '#666'} 
                  style={styles.filterIcon}
                />
              )}
              <Text style={[
                styles.filterButtonText,
                selectedFilter === filter.key && styles.filterButtonTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  clearButton: {
    padding: 2,
  },
  filtersContainer: {
    marginBottom: 2,
  },
  filtersContent: {
    paddingRight: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterIcon: {
    marginRight: 5,
  },
  filterButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SearchAndFilter;