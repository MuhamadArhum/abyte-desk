import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert, ScrollView,
  Dimensions,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import useCartStore from '../../../store/cartStore';

const { height: SCREEN_H } = Dimensions.get('window');
const round2 = (n) => Math.round(n * 100) / 100;

const ORDER_TYPE_LABEL = {
  dine_in: 'Dine In', takeaway: 'Takeaway', on_spot: 'Walk-in', delivery: 'Delivery',
};

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash',   icon: 'cash-outline',             color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  { value: 'card',   label: 'Card',   icon: 'card-outline',             color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
  { value: 'online', label: 'Online', icon: 'phone-portrait-outline',   color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

function calcTax(items, settings, orderType) {
  if (!settings || !items?.length) return 0;
  const fallback = parseFloat(settings.tax_rate || 0);
  if (settings.pos_mode === 'category' && settings.pos_tax_config) {
    const cfg = settings.pos_tax_config;
    const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
    if (!subtotal) return 0;
    let taxAmt = 0;
    items.forEach((i) => {
      const catId = String(i.category_id || '');
      const rate = cfg[catId] != null ? parseFloat(cfg[catId]) : fallback;
      taxAmt += parseFloat(i.unit_price) * i.quantity * rate / 100;
    });
    return subtotal > 0 ? (taxAmt / subtotal) * 100 : 0;
  }
  if (orderType === 'delivery') return parseFloat(settings.tax_on_online ?? fallback);
  return parseFloat(settings.tax_on_cash ?? fallback);
}

export default function RunningScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billData, setBillData] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  // step: 'payment' = select payment type first | 'preview' = show full bill
  const [billStep, setBillStep] = useState('payment');
  const [selectedPayment, setSelectedPayment] = useState(null);
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

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]));

  const handleEdit = (order) => {
    setTable(order.table_id || 0, order.table_name || 'Order', order.sale_id);
    const name = encodeURIComponent(order.table_name || 'Order');
    router.push(`/(main)/order/${order.table_id || 0}?saleId=${order.sale_id}&name=${name}`);
  };

  const handleBillPress = async (order) => {
    setBillLoading(true);
    try {
      const [saleRes, settingsRes] = await Promise.all([
        api.get(`/sales/${order.sale_id}`),
        api.get('/settings'),
      ]);
      const sale = saleRes.data;
      const settings = settingsRes.data || {};
      if (settings.pos_tax_config && typeof settings.pos_tax_config === 'string') {
        try { settings.pos_tax_config = JSON.parse(settings.pos_tax_config); } catch { settings.pos_tax_config = null; }
      }
      const items = sale?.items || sale?.details || [];
      const orderType = sale.order_type || order.order_type;

      // Use stored values (set at order creation) as primary source
      const storedTaxPct = parseFloat(sale.tax_percent || 0);
      const storedTaxAmt = parseFloat(sale.tax_amount || 0);
      const storedSubtotal = parseFloat(sale.sub_total || 0);
      const storedTotal = parseFloat(sale.net_amount || sale.total_amount || 0);

      // Only recalculate from settings if stored tax is 0 (order created before fix)
      const calcedTax = storedTaxPct === 0 ? calcTax(items, settings, orderType) : 0;
      const taxPercent = storedTaxPct > 0 ? storedTaxPct : calcedTax;

      const subtotal = storedSubtotal > 0
        ? storedSubtotal
        : round2(items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0));
      const taxAmt = storedTaxPct > 0
        ? (storedTaxAmt > 0 ? storedTaxAmt : round2(subtotal * storedTaxPct / 100))
        : round2(subtotal * calcedTax / 100);
      const total = storedTotal > 0 ? storedTotal : round2(subtotal + taxAmt);

      // Use table_name from list (order) as fallback if sale doesn't have it
      const tableName = sale.table_name || order.table_name || null;

      setBillData({ sale: { ...sale, table_name: tableName }, items, settings, taxPercent, subtotal, taxAmt, total });
      setSelectedPayment(null);
      setBillStep('payment');
    } catch (err) {
      Alert.alert('Error', 'Could not load bill details.');
    } finally {
      setBillLoading(false);
    }
  };

  const closeBill = () => {
    setBillData(null);
    setSelectedPayment(null);
    setBillStep('payment');
  };

  const getElapsed = (dateStr) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  const pm = selectedPayment ? PAYMENT_METHODS.find((p) => p.value === selectedPayment) : null;

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>
          {orders.length} Running {orders.length === 1 ? 'Order' : 'Orders'}
        </Text>
        <TouchableOpacity onPress={fetchOrders} style={styles.refreshIcon}>
          <Ionicons name="refresh-outline" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {orders.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark-circle" size={40} color="#059669" />
          </View>
          <Text style={styles.emptyTitle}>No Running Orders</Text>
          <Text style={styles.emptySub}>All orders have been completed</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders}>
            <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.sale_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              colors={['#059669']} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenLabel}>TOKEN</Text>
                  <Text style={styles.tokenText}>{item.token_no || `#${item.sale_id}`}</Text>
                </View>
                <View style={styles.cardMid}>
                  <Text style={styles.cardTable}>{item.table_name || 'No Table'}</Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {ORDER_TYPE_LABEL[item.order_type] || item.order_type || 'Dine In'}
                    </Text>
                  </View>
                  <Text style={styles.cardWaiter}>
                    <Ionicons name="person-outline" size={11} /> {item.cashier_name || 'Waiter'}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardAmount}>PKR {parseFloat(item.total_amount || 0).toFixed(0)}</Text>
                  <Text style={styles.cardTime}>{formatTime(item.sale_date)}</Text>
                  <View style={styles.elapsedBadge}>
                    <Ionicons name="time-outline" size={10} color="#D97706" />
                    <Text style={styles.elapsedText}>{getElapsed(item.sale_date)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)} activeOpacity={0.8}>
                  <Ionicons name="create-outline" size={15} color="#2563EB" />
                  <Text style={styles.editBtnText}>Edit Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.billBtn}
                  onPress={() => handleBillPress(item)}
                  disabled={billLoading}
                  activeOpacity={0.8}
                >
                  {billLoading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : (<><Ionicons name="receipt-outline" size={15} color="#FFFFFF" /><Text style={styles.billBtnText}>Print Bill</Text></>)
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Bill Modal */}
      <Modal visible={!!billData} transparent animationType="slide" onRequestClose={closeBill}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalOverlay} onPress={closeBill} />
          <View style={styles.billSheet}>
            <View style={styles.sheetHandle} />

            {/* ── STEP 1: Select Payment Type ── */}
            {billStep === 'payment' && (
              <View style={styles.payStepWrap}>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>Select Payment Type</Text>
                  <TouchableOpacity onPress={closeBill} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.payStepSub}>
                  How will the customer pay? This will appear on the bill.
                </Text>
                <View style={styles.payGrid}>
                  {PAYMENT_METHODS.map((pm) => (
                    <TouchableOpacity
                      key={pm.value}
                      style={[styles.payCard, { backgroundColor: pm.bg, borderColor: pm.border }]}
                      onPress={() => { setSelectedPayment(pm.value); setBillStep('preview'); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.payIconCircle, { backgroundColor: pm.color }]}>
                        <Ionicons name={pm.icon} size={26} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.payLabel, { color: pm.color }]}>{pm.label}</Text>
                      <Text style={styles.payDesc}>
                        {pm.value === 'cash' ? 'Physical cash' : pm.value === 'card' ? 'Debit / Credit' : 'Online transfer'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── STEP 2: Bill Preview ── */}
            {billStep === 'preview' && billData && (
              <>
                <View style={styles.sheetHeaderRow}>
                  <TouchableOpacity onPress={() => setBillStep('payment')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={18} color="#6B7280" />
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>Bill Preview</Text>
                  <TouchableOpacity onPress={closeBill} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.62 }}>
                  {/* Store header */}
                  <View style={styles.receiptHeader}>
                    <View style={styles.receiptLogoCircle}>
                      <Ionicons name="restaurant" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.receiptStoreName}>
                      {billData.settings?.store_name || 'AByte Restaurant'}
                    </Text>
                    <Text style={styles.receiptSubLabel}>CUSTOMER RECEIPT</Text>
                  </View>

                  {/* Payment type banner */}
                  {pm && (
                    <View style={[styles.pmBanner, { backgroundColor: pm.bg, borderColor: pm.border }]}>
                      <Ionicons name={pm.icon} size={16} color={pm.color} />
                      <Text style={[styles.pmBannerText, { color: pm.color }]}>
                        Payment: {pm.label}
                      </Text>
                    </View>
                  )}

                  {/* Order info */}
                  <View style={styles.receiptInfo}>
                    {[
                      { label: 'Token',      value: billData.sale.token_no || `#${billData.sale.sale_id}` },
                      { label: 'Table',      value: billData.sale.table_name || '—' },
                      { label: 'Order Type', value: ORDER_TYPE_LABEL[billData.sale.order_type] || billData.sale.order_type || '—' },
                      { label: 'Date',       value: formatDate(billData.sale.sale_date) },
                      { label: 'Time',       value: formatTime(billData.sale.sale_date) },
                      { label: 'Waiter',     value: billData.sale.cashier_name || '—' },
                    ].map((row) => (
                      <View key={row.label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{row.label}</Text>
                        <Text style={styles.infoValue}>{row.value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.divider} />

                  {/* Items */}
                  <View style={styles.itemsSection}>
                    <View style={styles.itemsHeader}>
                      <Text style={[styles.itemCol, { flex: 3 }]}>Item</Text>
                      <Text style={[styles.itemCol, styles.colCenter]}>Qty</Text>
                      <Text style={[styles.itemCol, styles.colRight]}>PKR</Text>
                    </View>
                    {billData.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={[styles.itemName, { flex: 3 }]} numberOfLines={2}>
                          {item.product_name || 'Item'}
                        </Text>
                        <Text style={[styles.itemQty, styles.colCenter]}>{item.quantity}</Text>
                        <Text style={[styles.itemAmt, styles.colRight]}>
                          {(parseFloat(item.unit_price) * item.quantity).toFixed(0)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.divider} />

                  {/* Totals */}
                  <View style={styles.totalsSection}>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Subtotal</Text>
                      <Text style={styles.totalValue}>PKR {billData.subtotal.toFixed(0)}</Text>
                    </View>
                    {billData.taxPercent > 0 && (
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Tax ({billData.taxPercent.toFixed(1)}%)</Text>
                        <Text style={styles.totalValue}>PKR {billData.taxAmt.toFixed(0)}</Text>
                      </View>
                    )}
                    <View style={[styles.totalRow, styles.grandTotalRow]}>
                      <Text style={styles.grandTotalLabel}>TOTAL PAYABLE</Text>
                      <Text style={styles.grandTotalValue}>PKR {billData.total.toFixed(0)}</Text>
                    </View>
                  </View>

                  <View style={styles.pendingNote}>
                    <Ionicons name="information-circle-outline" size={14} color="#D97706" />
                    <Text style={styles.pendingNoteText}>
                      Payment is collected at the counter by the cashier
                    </Text>
                  </View>
                </ScrollView>

                <TouchableOpacity style={styles.closeFullBtn} onPress={closeBill}>
                  <Text style={styles.closeFullBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#6B7280', fontSize: 14, marginTop: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6B7280' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#059669', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 10, marginTop: 4,
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  subHeaderText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  refreshIcon: { padding: 4 },

  list: { padding: 12, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  tokenBox: {
    backgroundColor: '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#6EE7B7',
    paddingHorizontal: 10, paddingVertical: 8, minWidth: 62, alignItems: 'center',
  },
  tokenLabel: { fontSize: 9, fontWeight: '700', color: '#059669', letterSpacing: 0.5 },
  tokenText: { fontSize: 13, fontWeight: 'bold', color: '#047857', textAlign: 'center' },
  cardMid: { flex: 1, gap: 3 },
  cardTable: { fontSize: 15, fontWeight: '700', color: '#111827' },
  typeBadge: {
    alignSelf: 'flex-start', backgroundColor: '#F3F4F6',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'capitalize' },
  cardWaiter: { fontSize: 11, color: '#9CA3AF' },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardTime: { fontSize: 11, color: '#6B7280' },
  elapsedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBEB', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D',
  },
  elapsedText: { fontSize: 10, color: '#D97706', fontWeight: '700' },

  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, backgroundColor: '#EFF6FF',
    borderRightWidth: 1, borderRightColor: '#E5E7EB',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  billBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, backgroundColor: '#059669',
  },
  billBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Modal
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  billSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
  },
  sheetHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sheetTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827', flex: 1, textAlign: 'center' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  // Payment step
  payStepWrap: { paddingBottom: 24 },
  payStepSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20, marginTop: 10, marginBottom: 16 },
  payGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  payCard: {
    flex: 1, borderRadius: 16, borderWidth: 1.5,
    padding: 14, alignItems: 'center', gap: 6,
  },
  payIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  payLabel: { fontSize: 14, fontWeight: '700' },
  payDesc: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  // Receipt
  receiptHeader: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  receiptLogoCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  receiptStoreName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  receiptSubLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: '#9CA3AF', marginTop: 2 },

  pmBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5,
  },
  pmBannerText: { fontSize: 13, fontWeight: '700' },

  receiptInfo: { paddingHorizontal: 20, paddingBottom: 4 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  infoLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  infoValue: { fontSize: 12, color: '#111827', fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20, marginVertical: 6 },

  itemsSection: { paddingHorizontal: 20 },
  itemsHeader: {
    flexDirection: 'row', paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 4,
  },
  itemCol: { fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  colCenter: { textAlign: 'center', width: 40 },
  colRight: { textAlign: 'right', width: 70 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  itemName: { fontSize: 13, color: '#374151', fontWeight: '500' },
  itemQty: { fontSize: 13, color: '#6B7280', width: 40, textAlign: 'center' },
  itemAmt: { fontSize: 13, color: '#111827', fontWeight: '600', width: 70, textAlign: 'right' },

  totalsSection: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 4,
  },
  totalLabel: { fontSize: 13, color: '#6B7280' },
  totalValue: { fontSize: 13, color: '#374151', fontWeight: '600' },
  grandTotalRow: {
    marginTop: 6, paddingTop: 10,
    borderTopWidth: 2, borderTopColor: '#E5E7EB',
  },
  grandTotalLabel: { fontSize: 14, fontWeight: '800', color: '#111827' },
  grandTotalValue: { fontSize: 20, fontWeight: '800', color: '#059669' },

  pendingNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', marginHorizontal: 20, marginTop: 8, marginBottom: 4,
    padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FCD34D',
  },
  pendingNoteText: { flex: 1, fontSize: 12, color: '#92400E' },

  closeFullBtn: {
    margin: 16, marginTop: 8, paddingVertical: 14,
    backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center',
  },
  closeFullBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },
});
