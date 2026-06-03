import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import useCartStore from '../../store/cartStore';

export default function TablesScreen() {
  const { orderType } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { setTable } = useCartStore();

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get('/restaurant/tables');
      const all = res.data || [];
      const free = all.filter(
        (t) => t.status === 'available' && Number(t.has_pending_order) === 0
      );
      setTables(free);
    } catch (err) {
      console.error('fetchTables error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchTables();
  }, [fetchTables]));

  const handleTablePress = (table) => {
    setTable(table.table_id, table.table_name, null);
    router.push(
      `/(main)/order/${table.table_id}?name=${encodeURIComponent(table.table_name)}&orderType=${orderType || 'dine_in'}`
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Table</Text>
        <TouchableOpacity onPress={fetchTables} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading tables...</Text>
        </View>
      ) : tables.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="close-circle" size={36} color="#DC2626" />
          </View>
          <Text style={styles.emptyTitle}>All Tables Occupied</Text>
          <Text style={styles.emptySub}>No free tables available right now</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchTables}>
            <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(item) => String(item.table_id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchTables(); }}
              colors={['#059669']} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.freeBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.freeText}>{tables.length} free table{tables.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tableCard}
              onPress={() => handleTablePress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.tableIconCircle}>
                <Ionicons name="restaurant-outline" size={28} color="#059669" />
              </View>
              <Text style={styles.tableName}>{item.table_name}</Text>
              <Text style={styles.tableFloor}>{item.floor || 'Main Floor'}</Text>
              <View style={styles.availableBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.availableText}>Available</Text>
              </View>
              {item.capacity && (
                <Text style={styles.capacity}>{item.capacity} seats</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#6B7280', fontSize: 14, marginTop: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#059669', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, marginTop: 4,
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  listHeader: { paddingHorizontal: 4, paddingBottom: 10 },
  freeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#6EE7B7',
  },
  freeText: { fontSize: 12, fontWeight: '700', color: '#059669' },

  grid: { padding: 12, paddingBottom: 24 },
  row: { gap: 12 },
  tableCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, alignItems: 'center', marginBottom: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  tableIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  tableName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tableFloor: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  availableBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#ECFDF5', borderRadius: 20,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' },
  availableText: { fontSize: 11, color: '#059669', fontWeight: '700' },
  capacity: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
});
