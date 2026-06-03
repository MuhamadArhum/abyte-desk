import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';

const PM_CONFIG = {
  cash:   { color: '#059669', bg: '#ECFDF5', label: 'Cash' },
  card:   { color: '#2563EB', bg: '#EFF6FF', label: 'Card' },
  online: { color: '#7C3AED', bg: '#F5F3FF', label: 'Online' },
};

const ORDER_TYPE_LABEL = { dine_in: 'Dine In', takeaway: 'Takeaway', on_spot: 'Walk-in', delivery: 'Delivery' };

export default function HistoryScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/sales?limit=50&page=1');
      const data = res.data?.data || res.data || [];
      const completed = Array.isArray(data) ? data.filter((s) => s.status === 'completed') : [];
      setSales(completed);
    } catch (err) {
      console.error('fetchHistory error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchHistory();
  }, [fetchHistory]));

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>Recent Completed Orders</Text>
        <TouchableOpacity onPress={fetchHistory} style={{ padding: 4 }}>
          <Ionicons name="refresh-outline" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {sales.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="time-outline" size={36} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptySub}>Completed orders will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => String(item.sale_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchHistory(); }}
              colors={['#059669']} />
          }
          renderItem={({ item }) => {
            const pm = PM_CONFIG[item.payment_method] || PM_CONFIG.cash;
            return (
              <View style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.pmDot, { backgroundColor: pm.color }]} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.invoiceNo}>{item.invoice_no || `Sale #${item.sale_id}`}</Text>
                    <View style={[styles.pmBadge, { backgroundColor: pm.bg }]}>
                      <Text style={[styles.pmText, { color: pm.color }]}>{pm.label}</Text>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    {item.table_name && (
                      <View style={styles.metaItem}>
                        <Ionicons name="restaurant-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.metaText}>{item.table_name}</Text>
                      </View>
                    )}
                    {item.order_type && (
                      <View style={styles.metaItem}>
                        <Ionicons name="layers-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.metaText}>{ORDER_TYPE_LABEL[item.order_type] || item.order_type}</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.metaText}>{formatDate(item.sale_date)} · {formatTime(item.sale_date)}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cashierText}>
                      <Ionicons name="person-outline" size={11} /> {item.cashier_name || '—'}
                    </Text>
                    <Text style={styles.amount}>
                      PKR {parseFloat(item.net_amount || item.total_amount || 0).toFixed(0)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#6B7280', fontSize: 14, marginTop: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6B7280' },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  subHeaderText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  list: { padding: 12, gap: 8, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLeft: {
    width: 4, backgroundColor: '#E5E7EB',
    alignItems: 'center', paddingVertical: 16,
  },
  pmDot: { width: 4, flex: 1, borderRadius: 2 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  invoiceNo: { fontSize: 14, fontWeight: '700', color: '#111827' },
  pmBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  pmText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { gap: 3, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#6B7280' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cashierText: { fontSize: 11, color: '#9CA3AF' },
  amount: { fontSize: 16, fontWeight: '700', color: '#111827' },
});
