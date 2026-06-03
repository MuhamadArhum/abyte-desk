import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';

export default function HistoryScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/sales?limit=50&page=1');
      const data = res.data?.data || res.data || [];
      const completed = Array.isArray(data)
        ? data.filter((s) => s.status === 'completed')
        : [];
      setSales(completed);
    } catch (err) {
      console.error('fetchHistory error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHistory();
    }, [fetchHistory])
  );

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

  const paymentColor = (method) => {
    if (!method) return '#94A3B8';
    if (method === 'cash') return '#16A34A';
    if (method === 'card') return '#2563EB';
    return '#7C3AED';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  if (sales.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={72} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>No History Yet</Text>
        <Text style={styles.emptySubtitle}>Completed orders will appear here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>Recent Completed Orders</Text>
      </View>

      <FlatList
        data={sales}
        keyExtractor={(item) => String(item.sale_id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchHistory(); }}
            colors={['#1E40AF']}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Top row */}
            <View style={styles.cardTop}>
              <Text style={styles.invoiceNo}>{item.invoice_no || `Sale #${item.sale_id}`}</Text>
              <Text style={styles.saleDate}>{formatDate(item.sale_date)}</Text>
            </View>

            {/* Info row */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="restaurant-outline" size={13} color="#94A3B8" />
                <Text style={styles.infoText}>{item.table_name || 'No Table'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={13} color="#94A3B8" />
                <Text style={styles.infoText}>{formatTime(item.sale_date)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={13} color="#94A3B8" />
                <Text style={styles.infoText}>{item.cashier_name || '—'}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardBottom}>
              <View style={[styles.payBadge, { backgroundColor: `${paymentColor(item.payment_method)}18` }]}>
                <Text style={[styles.payText, { color: paymentColor(item.payment_method) }]}>
                  {(item.payment_method || 'cash').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.amount}>
                PKR {parseFloat(item.net_amount || item.total_amount || 0).toFixed(0)}
              </Text>
            </View>
          </View>
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
  subHeader: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  subHeaderText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  list: { padding: 12, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderLeftWidth: 4, borderLeftColor: '#22C55E',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  invoiceNo: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  saleDate: { fontSize: 12, color: '#94A3B8' },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, color: '#64748B' },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  payBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  payText: { fontSize: 11, fontWeight: '700' },
  amount: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
});
