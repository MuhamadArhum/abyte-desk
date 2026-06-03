import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import useCartStore from '../../../store/cartStore';

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash',   icon: 'cash-outline',        color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' },
  { value: 'card',   label: 'Card',   icon: 'card-outline',        color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  { value: 'online', label: 'Online', icon: 'phone-portrait-outline', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

export default function RunningScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billModal, setBillModal] = useState(null); // { sale_id, table_name }
  const [completing, setCompleting] = useState(false);
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

  const handleEdit = (order) => {
    setTable(
      order.table_id || 0,
      order.table_name || 'Order',
      order.sale_id
    );
    const tableIdParam = order.table_id || 0;
    const name = encodeURIComponent(order.table_name || 'Order');
    router.push(`/(main)/order/${tableIdParam}?saleId=${order.sale_id}&name=${name}`);
  };

  const handleCompleteSale = async (paymentMethod) => {
    if (!billModal) return;
    setCompleting(true);
    try {
      await api.put(`/sales/${billModal.sale_id}/complete`, {
        payment_method: paymentMethod,
      });
      setBillModal(null);
      Alert.alert('Done!', `Bill printed — paid by ${paymentMethod}.`);
      fetchOrders();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete order.';
      Alert.alert('Error', msg);
    } finally {
      setCompleting(false);
    }
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
          <View style={styles.card}>
            {/* Top row */}
            <View style={styles.cardTop}>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenText}>{item.token_no || `#${item.sale_id}`}</Text>
              </View>
              <View style={styles.cardMid}>
                <Text style={styles.cardTable}>{item.table_name || 'No Table'}</Text>
                <Text style={styles.cardType}>
                  {(item.order_type || 'dine_in').replace(/_/g, ' ')}
                </Text>
                <Text style={styles.cardWaiter}>
                  <Ionicons name="person-outline" size={11} /> {item.cashier_name || 'Waiter'}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>
                  PKR {parseFloat(item.total_amount || 0).toFixed(0)}
                </Text>
                <Text style={styles.cardTime}>{formatTime(item.sale_date)}</Text>
                <Text style={styles.cardElapsed}>{getElapsed(item.sale_date)}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => handleEdit(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={15} color="#1E40AF" />
                <Text style={styles.editBtnText}>Edit Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.billBtn}
                onPress={() => setBillModal({ sale_id: item.sale_id, table_name: item.table_name || 'Order' })}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={15} color="#FFFFFF" />
                <Text style={styles.billBtnText}>Print Bill</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Payment Method Modal */}
      <Modal
        visible={!!billModal}
        transparent
        animationType="slide"
        onRequestClose={() => !completing && setBillModal(null)}
      >
        <View style={styles.modalWrap}>
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => !completing && setBillModal(null)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Payment Method</Text>
            <Text style={styles.sheetSub}>
              {billModal?.table_name} — choose how the customer is paying
            </Text>

            {completing ? (
              <View style={styles.completingWrap}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.completingText}>Processing...</Text>
              </View>
            ) : (
              <View style={styles.paymentGrid}>
                {PAYMENT_METHODS.map((pm) => (
                  <TouchableOpacity
                    key={pm.value}
                    style={[styles.payCard, { backgroundColor: pm.bg, borderColor: pm.border }]}
                    onPress={() => handleCompleteSale(pm.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.payIconCircle, { backgroundColor: pm.color }]}>
                      <Ionicons name={pm.icon} size={28} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.payLabel, { color: pm.color }]}>{pm.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!completing && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBillModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
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

  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    borderRightWidth: 1, borderRightColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  billBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    backgroundColor: '#15803D',
  },
  billBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Modal
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginBottom: 18,
  },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  sheetSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  completingWrap: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  completingText: { color: '#64748B', fontSize: 14 },
  paymentGrid: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 16 },
  payCard: {
    flex: 1, borderRadius: 16, borderWidth: 1.5,
    padding: 16, alignItems: 'center', gap: 10,
  },
  payIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  payLabel: { fontSize: 14, fontWeight: 'bold' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4,
  },
  cancelBtnText: { fontSize: 15, color: '#94A3B8', fontWeight: '600' },
});
