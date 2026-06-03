import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import useCartStore from '../../../store/cartStore';

export default function RunningScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { setTable } = useCartStore();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/sales/pending');
      const data = res.data?.data || res.data || [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchOrders error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [fetchOrders])
  );

  const handleOrderPress = (order) => {
    setTable(
      order.table_id || 0,
      order.table_name || 'Order',
      order.sale_id
    );
    const tableIdParam = order.table_id || 0;
    const name = encodeURIComponent(order.table_name || 'Order');
    router.push(
      `/(main)/order/${tableIdParam}?saleId=${order.sale_id}&name=${name}`
    );
  };

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const getElapsed = (dateStr) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m ago`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="receipt-outline" size={72} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No Running Orders</Text>
        <Text style={styles.emptySubtitle}>All orders have been completed</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders}>
          <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>
          {orders.length} Running {orders.length === 1 ? 'Order' : 'Orders'}
        </Text>
        <TouchableOpacity onPress={fetchOrders} style={{ padding: 4 }}>
          <Ionicons name="refresh-outline" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.sale_id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchOrders(); }}
            colors={['#1E40AF']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleOrderPress(item)}
            activeOpacity={0.8}
          >
            {/* Token */}
            <View style={styles.tokenBox}>
              <Text style={styles.tokenText}>{item.token_no || `#${item.sale_id}`}</Text>
            </View>

            {/* Middle info */}
            <View style={styles.cardMid}>
              <Text style={styles.cardTable}>{item.table_name || 'No Table'}</Text>
              <Text style={styles.cardType}>
                {(item.order_type || 'dine_in').replace('_', ' ')}
              </Text>
              <Text style={styles.cardWaiter}>
                <Ionicons name="person-outline" size={11} /> {item.cashier_name || 'Waiter'}
              </Text>
            </View>

            {/* Right info */}
            <View style={styles.cardRight}>
              <Text style={styles.cardAmount}>
                PKR {parseFloat(item.total_amount || 0).toFixed(0)}
              </Text>
              <Text style={styles.cardTime}>{formatTime(item.sale_date)}</Text>
              <Text style={styles.cardElapsed}>{getElapsed(item.sale_date)}</Text>
              <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginTop: 4 }} />
            </View>
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
  emptySubtitle: { fontSize: 14, color: '#94A3B8' },
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
  list: { padding: 12, gap: 10, paddingBottom: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    gap: 12, borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tokenBox: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    minWidth: 58, alignItems: 'center',
  },
  tokenText: { fontSize: 12, fontWeight: 'bold', color: '#92400E', textAlign: 'center' },
  cardMid: { flex: 1, gap: 2 },
  cardTable: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  cardType: { fontSize: 12, color: '#64748B', textTransform: 'capitalize' },
  cardWaiter: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  cardAmount: { fontSize: 15, fontWeight: 'bold', color: '#1E40AF' },
  cardTime: { fontSize: 12, color: '#64748B' },
  cardElapsed: { fontSize: 11, color: '#94A3B8' },
});
