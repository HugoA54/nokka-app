import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Modal } from '@components/ui/Modal';
import { FoodCard } from './FoodCard';
import { Ionicons } from '@expo/vector-icons';
import { useNutritionStore } from '@store/nutritionStore';
import { useAuthStore } from '@store/authStore';
import { openFoodFactsService } from '@services/openFoodFactsService';
import type { Food } from '@types/index';

interface FoodSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (food: Food, quantity: number) => void;
  preSelectedFood?: Food | null;
}

export function FoodSearchModal({ visible, onClose, onSelect, preSelectedFood }: FoodSearchModalProps) {
  const user = useAuthStore((s) => s.user);
  const { searchFoods, isSearchingFoods, foods } = useNutritionStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [hasSearched, setHasSearched] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);

  // Auto-select scanned food (from barcode scanner)
  useEffect(() => {
    if (visible && preSelectedFood) {
      setSelectedFood(preSelectedFood);
      setQuantity(String(preSelectedFood.serving_size ?? 100));
      setShowQuantityModal(true);
    }
  }, [visible, preSelectedFood]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const found = await searchFoods(text, user?.id ?? '');
      setResults(found);
      setHasSearched(true);
    }, 400);
  }, [user?.id, searchFoods]);

  const handleSelectFood = (food: Food) => {
    setSelectedFood(food);
    setQuantity(String(food.serving_size ?? 100));
    setShowQuantityModal(true);
  };

  const handleConfirmQuantity = () => {
    if (!selectedFood) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity in grams.');
      return;
    }
    onSelect(selectedFood, qty);
    setShowQuantityModal(false);
    setSelectedFood(null);
    setQuery('');
    setResults([]);
    onClose();
  };

  const popularFoods = openFoodFactsService.getPopularFoods();
  const displayResults = hasSearched ? results : popularFoods.map((f, i) => ({
    ...f,
    id: `popular_${i}`,
    user_id: user?.id ?? '',
    times_used: 0,
  } as Food));

  if (showQuantityModal && selectedFood) {
    return (
      <Modal visible={true} onClose={() => setShowQuantityModal(false)} title="Set Quantity">
        <View style={styles.quantityContainer}>
          <Text style={styles.selectedName}>{selectedFood.name}</Text>
          {selectedFood.brand && <Text style={styles.selectedBrand}>{selectedFood.brand}</Text>}

          <View style={styles.macroPreview}>
            {['Calories', 'Protein', 'Carbs', 'Fats'].map((label, idx) => {
              const values = [
                selectedFood.calories_per_100g,
                selectedFood.protein_per_100g,
                selectedFood.carbs_per_100g,
                selectedFood.fats_per_100g,
              ];
              const colors = ['#f0f0f0', '#60d4f0', '#f0c060', '#f060a8'];
              const units = ['kcal', 'g', 'g', 'g'];
              const factor = parseFloat(quantity) / 100 || 0;
              return (
                <View key={label} style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors[idx] }]}>
                    {(values[idx] * factor).toFixed(idx === 0 ? 0 : 1)}
                  </Text>
                  <Text style={styles.macroLabel}>{label} ({units[idx]})</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.qtyLabel}>Quantity (grams)</Text>
          <TextInput
            style={styles.qtyInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="100"
            placeholderTextColor="#3a3a4a"
            autoFocus
          />

          {/* Quick portion buttons */}
          <View style={styles.portionButtons}>
            {[50, 100, 150, 200, 300].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.portionBtn, quantity === String(p) && styles.portionBtnActive]}
                onPress={() => setQuantity(String(p))}
              >
                <Text style={[styles.portionBtnText, quantity === String(p) && styles.portionBtnTextActive]}>
                  {p}g
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmQuantity}>
            <Text style={styles.confirmBtnText}>Add to Meal</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} onClose={onClose} title="Add Food" fullHeight>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#7a7a90" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search foods…"
          placeholderTextColor="#3a3a4a"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {isSearchingFoods && (
          <ActivityIndicator size="small" color="#c8f060" />
        )}
        {query.length > 0 && !isSearchingFoods && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
            <Ionicons name="close-circle" size={18} color="#7a7a90" />
          </TouchableOpacity>
        )}
      </View>

      {!hasSearched && (
        <Text style={styles.sectionLabel}>Popular Foods</Text>
      )}

      <FlatList
        data={displayResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FoodCard
            food={item}
            onPress={() => handleSelectFood(item)}
            onAdd={() => handleSelectFood(item)}
            showMacros
          />
        )}
        ListEmptyComponent={
          hasSearched && !isSearchingFoods ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={40} color="#2a2a35" />
              <Text style={styles.emptyText}>No foods found for "{query}"</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f12',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
    marginBottom: 16,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    color: '#f0f0f0',
    fontSize: 15,
  },
  sectionLabel: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  list: {
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#7a7a90',
    fontSize: 13,
  },
  // Quantity modal
  quantityContainer: {
    gap: 16,
  },
  selectedName: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '700',
  },
  selectedBrand: {
    color: '#7a7a90',
    fontSize: 14,
    marginTop: -10,
  },
  macroPreview: {
    flexDirection: 'row',
    backgroundColor: '#0f0f12',
    borderRadius: 14,
    padding: 16,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  macroItem: {
    alignItems: 'center',
    gap: 4,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  macroLabel: {
    color: '#7a7a90',
    fontSize: 11,
  },
  qtyLabel: {
    color: '#7a7a90',
    fontSize: 13,
    fontWeight: '600',
  },
  qtyInput: {
    backgroundColor: '#0f0f12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f0f0f0',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  portionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  portionBtn: {
    flex: 1,
    backgroundColor: '#2a2a35',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  portionBtnActive: {
    backgroundColor: '#c8f060',
  },
  portionBtnText: {
    color: '#7a7a90',
    fontSize: 13,
    fontWeight: '600',
  },
  portionBtnTextActive: {
    color: '#0f0f12',
  },
  confirmBtn: {
    backgroundColor: '#c8f060',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: {
    color: '#0f0f12',
    fontSize: 16,
    fontWeight: '700',
  },
});
