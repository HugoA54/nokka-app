import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useNutritionStore } from '@store/nutritionStore';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import type { ShoppingCategory, ShoppingItem } from '@types/index';

const CATEGORY_ICONS: Record<ShoppingCategory, { icon: string; color: string }> = {
  proteins: { icon: 'fish-outline', color: '#60d4f0' },
  vegetables: { icon: 'leaf-outline', color: '#60f090' },
  fruits: { icon: 'nutrition-outline', color: '#f0c060' },
  dairy: { icon: 'water-outline', color: '#f0f0f0' },
  grains: { icon: 'layers-outline', color: '#f0c060' },
  condiments: { icon: 'flask-outline', color: '#f060a8' },
  other: { icon: 'cube-outline', color: '#7a7a90' },
};

export default function ShoppingListScreen() {
  const user = useAuthStore((s) => s.user);
  const { shoppingList, loadShoppingList, togglePurchased, removeShoppingItem, clearShoppingList } =
    useNutritionStore();
  const toast = useToast();
  const haptics = useHaptics();
  const [refreshing, setRefreshing] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    await loadShoppingList(user.id);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleToggle = async (itemId: string) => {
    await haptics.light();
    await togglePurchased(itemId);
  };

  const handleClear = () => {
    Alert.alert('Clear List', 'Remove all purchased items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await haptics.medium();
          await clearShoppingList(user!.id);
          toast.success('Shopping list cleared.');
        },
      },
    ]);
  };

  const grouped = shoppingList.reduce<Record<ShoppingCategory, ShoppingItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<ShoppingCategory, ShoppingItem[]>);

  const categories = Object.keys(grouped) as ShoppingCategory[];
  const pending = shoppingList.filter((i) => !i.is_purchased);
  const purchased = shoppingList.filter((i) => i.is_purchased);

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {purchased.length} / {shoppingList.length} items
          </Text>
          <Text style={styles.progressSubtext}>completed</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: shoppingList.length > 0
                  ? `${(purchased.length / shoppingList.length) * 100}%` as any
                  : '0%',
              },
            ]}
          />
        </View>
        {purchased.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearBtnText}>Clear done</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
        renderItem={({ item: category }) => {
          const items = grouped[category];
          const catInfo = CATEGORY_ICONS[category];
          return (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons name={catInfo.icon as any} size={16} color={catInfo.color} />
                <Text style={[styles.categoryTitle, { color: catInfo.color }]}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <Text style={styles.categoryCount}>
                  {items.filter((i) => i.is_purchased).length}/{items.length}
                </Text>
              </View>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemRow, item.is_purchased && styles.itemRowDone]}
                  onPress={() => handleToggle(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, item.is_purchased && styles.checkboxDone]}>
                    {item.is_purchased && (
                      <Ionicons name="checkmark" size={14} color="#0f0f12" />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, item.is_purchased && styles.itemNameDone]}>
                      {item.item_name}
                    </Text>
                    <Text style={styles.itemQty}>{item.quantity}{item.unit}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeShoppingItem(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color="#3a3a4a" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={60} color="#2a2a35" />
            <Text style={styles.emptyTitle}>No shopping list yet</Text>
            <Text style={styles.emptyText}>
              Go to Meal Planning and generate your shopping list for the week.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  progressHeader: {
    padding: 16,
    backgroundColor: '#16161c',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a35',
    gap: 10,
  },
  progressInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  progressText: { color: '#f0f0f0', fontSize: 18, fontWeight: '800' },
  progressSubtext: { color: '#7a7a90', fontSize: 13 },
  progressTrack: { height: 6, backgroundColor: '#2a2a35', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#c8f060', borderRadius: 3 },
  clearBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#2a2a35', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  clearBtnText: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 16, paddingBottom: 48 },
  categorySection: { gap: 8 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryTitle: { flex: 1, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  categoryCount: { color: '#7a7a90', fontSize: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16161c', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35', gap: 12,
  },
  itemRowDone: { opacity: 0.5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#3a3a4a',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#c8f060', borderColor: '#c8f060' },
  itemInfo: { flex: 1 },
  itemName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  itemNameDone: { textDecorationLine: 'line-through', color: '#7a7a90' },
  itemQty: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 14, padding: 24 },
  emptyTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
