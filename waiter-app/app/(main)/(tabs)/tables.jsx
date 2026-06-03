import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import useCartStore from '../../../store/cartStore';

export default function TablesScreen() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { setTable } = useCartStore();

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get('/restaurant/tables');
      const all = res.data || [];
      // Only free tables (available + no pending order)
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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTables();
    }, [fetchTables])
  );

  const handleTablePress = (table) => {
    setTable(table.table_id, table.table_name, null);
    router.push(
      `/(main)/order/${table.table_id}?name=${encodeURIComponent(table.table_name)}`
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading tables...</Text>
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={72} color="#22C55E" />
        <Text style={styles.emptyTitle}>All Tables Occupied</Text>
        <Text style={styles.emptySubtitle}>No free tables available right now</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchTables}>
          <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sub header */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>
          {tables.length} Free {tables.length === 1 ? 'Table' : 'Tables'}
        </Text>
        <TouchableOpacity onPress={fetchTables} style={styles.refreshIconBtn}>
          <Ionicons name="refresh-outline" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tables}
        keyExtractor={(item) => String(item.table_id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchTables(); }}
            colors={['#1E40AF']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tableCard}
            onPress={() => handleTablePress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.tableIconCircle}>
              <Ionicons name="restaurant-outline" size={30} color="#1E40AF" />
            </View>
            <Text style={styles.tableName}>{item.table_name}</Text>
            <Text style={styles.tableFloor}>{item.floor || 'Main Floor'}</Text>
            <View style={styles.availableBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.availableText}>Free</Text>
            </View>
            <Text style={styles.capacity}>
              {item.capacity || '—'} seats
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9', gap: 12,
  },
  loadingText: { color: '#64748B', marginTop: 8, fontSize: 14 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1E40AF', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, marginTop: 4,
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  subHeaderText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  refreshIconBtn: { padding: 4 },
  grid: { padding: 12, paddingBottom: 24 },
  row: { gap: 12 },
  tableCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, alignItems: 'center', marginBottom: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  tableIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  tableName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  tableFloor: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  availableBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#DCFCE7', borderRadius: 20,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  availableText: { fontSize: 11, color: '#16A34A', fontWeight: '700' },
  capacity: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
});
