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
import { C, shadow } from '../../../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const round2 = (n) => Math.round(n * 100) / 100;

const ORDER_TYPE_LABEL = {
  dine_in: 'Dine In', takeaway: 'Takeaway', on_spot: 'Walk-in', delivery: 'Delivery',
};

const ORDER_TYPE_COLOR = {
  dine_in:  { color: C.primary, bg: C.primaryLt, border: C.primaryBd },
  takeaway: { color: C.amber,   bg: C.amberBg,   border: C.amberBd   },
  on_spot:  { color: C.blue,    bg: C.blueBg,    border: C.blueBd    },
  delivery: { color: C.purple,  bg: C.purpleBg,  border: C.purpleBd  },
};

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash',   icon: 'cash-outline',             color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  { value: 'card',   label: 'Card',   icon: 'card-outline',             color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
  { value: 'online', label: 'Online', icon: 'phone-portrait-outline',   color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

// pos_tax_config keys: dine_in | takeaway | delivery | walk_in (on_spot maps to walk_in)
function getCatKey(orderType) {
  return orderType === 'on_spot' ? 'walk_in' : (orderType || 'dine_in');
}

function calcTax(settings, orderType, paymentMethod) {
  if (!settings) return 0;
  const pm = paymentMethod || 'cash';
  const cashRate   = parseFloat(settings.tax_on_cash   || settings.tax_rate || 0);
  const cardRate   = parseFloat(settings.tax_on_card   || settings.tax_rate || 0);
  const onlineRate = parseFloat(settings.tax_on_online || settings.tax_rate || 0);
  const rateByPm   = pm === 'card' ? cardRate : pm === 'online' ? onlineRate : cashRate;
  if (settings.pos_mode === 'category' && settings.pos_tax_config) {
    const cat = settings.pos_tax_config[getCatKey(orderType)] || {};
    return cat.tax_enabled ? parseFloat(cat.tax_rate || 0) : rateByPm;
  }
  return rateByPm;
}

function calcAdditional(settings, orderType) {
  if (!settings?.pos_tax_config) return 0;
  const cat = settings.pos_tax_config[getCatKey(orderType)] || {};
  const service = cat.service_enabled ? parseFloat(cat.service_rate || 0) : 0;
  const other   = cat.other_enabled   ? parseFloat(cat.other_rate   || 0) : 0;
  return service + other;
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

      // Calculate subtotal and service charges (don't depend on payment method)
      const storedAddPct   = parseFloat(sale.additional_charges_percent || 0);
      const storedAddAmt   = parseFloat(sale.additional_charges_amount  || 0);
      const storedSubtotal = parseFloat(sale.sub_total || 0);

      const subtotal   = storedSubtotal > 0
        ? storedSubtotal
        : round2(items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0));
      const addPercent = storedAddPct > 0 ? storedAddPct : calcAdditional(settings, orderType);
      const addAmt     = storedAddAmt > 0 ? storedAddAmt : round2(subtotal * addPercent / 100);

      // Use table_name from list (order) as fallback if sale doesn't have it
      const tableName = sale.table_name || order.table_name || null;

      // Store raw data — tax is recalculated per payment type in the preview
      setBillData({ sale: { ...sale, table_name: tableName }, items, settings, orderType, subtotal, addPercent, addAmt });
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
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  const pm = selectedPayment ? PAYMENT_METHODS.find((p) => p.value === selectedPayment) : null;

  // Tax: in category mode respect tax_enabled; if enabled use payment-method rates
  const billTaxPercent = (() => {
    if (!billData?.settings) return 0;
    const s  = billData.settings;
    const pm = selectedPayment || 'cash';
    if (s.pos_mode === 'category' && s.pos_tax_config) {
      const cat = s.pos_tax_config[getCatKey(billData.orderType)] || {};
      if (!cat.tax_enabled) return 0;
    }
    if (pm === 'card')   return parseFloat(s.tax_on_card   || s.tax_rate || 0);
    if (pm === 'online') return parseFloat(s.tax_on_online || s.tax_rate || 0);
    return parseFloat(s.tax_on_cash || s.tax_rate || 0);
  })();
  const billSubtotal  = billData?.subtotal || 0;
  const billTaxAmt    = round2(billSubtotal * billTaxPercent / 100);
  const billAddPct    = billData?.addPercent || 0;
  const billAddAmt    = billData?.addAmt || 0;
  const billTotal     = round2(billSubtotal + billTaxAmt + billAddAmt);

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.subHeaderText}>
            {orders.length} Running {orders.length === 1 ? 'Order' : 'Orders'}
          </Text>
        </View>
        <TouchableOpacity onPress={fetchOrders} style={styles.refreshIcon}>
          <Ionicons name="refresh-outline" size={18} color={C.t2} />
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
              colors={[C.primary]} />
          }
          renderItem={({ item }) => {
            const otc = ORDER_TYPE_COLOR[item.order_type] || ORDER_TYPE_COLOR.dine_in;
            return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenLabel}>TOKEN</Text>
                  <Text style={styles.tokenText}>{item.token_no || `#${item.sale_id}`}</Text>
                </View>
                <View style={styles.cardMid}>
                  <Text style={styles.cardTable}>{item.table_name || 'No Table'}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: otc.bg, borderColor: otc.border }]}>
                    <Text style={[styles.typeBadgeText, { color: otc.color }]}>
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
            );
          }}
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
                      <Text style={styles.totalValue}>PKR {billSubtotal.toFixed(0)}</Text>
                    </View>
                    {billTaxPercent > 0 && (
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Tax ({billTaxPercent.toFixed(1)}%)</Text>
                        <Text style={styles.totalValue}>PKR {billTaxAmt.toFixed(0)}</Text>
                      </View>
                    )}
                    {billAddPct > 0 && (
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Service Charges ({billAddPct.toFixed(1)}%)</Text>
                        <Text style={styles.totalValue}>PKR {billAddAmt.toFixed(0)}</Text>
                      </View>
                    )}
                    <View style={[styles.totalRow, styles.grandTotalRow]}>
                      <Text style={styles.grandTotalLabel}>TOTAL PAYABLE</Text>
                      <Text style={styles.grandTotalValue}>PKR {billTotal.toFixed(0)}</Text>
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
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.t2, fontSize: 14, marginTop: 8 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.t1 },
  emptySub: { fontSize: 13, color: C.t2 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, marginTop: 6,
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderText: { fontSize: 14, fontWeight: '700', color: C.t1 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.primary,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 2,
  },
  refreshIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },

  list: { padding: 14, gap: 12, paddingBottom: 28 },
  card: {
    backgroundColor: C.card, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
    ...shadow.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  tokenBox: {
    backgroundColor: C.primaryLt, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.primaryBd,
    paddingHorizontal: 10, paddingVertical: 10, minWidth: 64, alignItems: 'center',
  },
  tokenLabel: { fontSize: 9, fontWeight: '700', color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
  tokenText: { fontSize: 14, fontWeight: '800', color: C.primaryDk, textAlign: 'center', marginTop: 2 },
  cardMid: { flex: 1, gap: 4 },
  cardTable: { fontSize: 15, fontWeight: '800', color: C.t1, letterSpacing: -0.2 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  cardWaiter: { fontSize: 11.5, color: C.t3, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 5 },
  cardAmount: { fontSize: 17, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
  cardTime: { fontSize: 11, color: C.t3 },
  elapsedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.amberBg, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.amberBd,
  },
  elapsedText: { fontSize: 10, color: C.amber, fontWeight: '700' },

  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.borderLt },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, backgroundColor: C.blueBg,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: C.blue },
  billBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, backgroundColor: C.primary,
  },
  billBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Modal
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  billSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 10,
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.t1, flex: 1, textAlign: 'center', letterSpacing: -0.3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },

  // Payment step
  payStepWrap: { paddingBottom: 28 },
  payStepSub: { fontSize: 13, color: C.t2, textAlign: 'center', paddingHorizontal: 20, marginTop: 12, marginBottom: 20, lineHeight: 20 },
  payGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  payCard: {
    flex: 1, borderRadius: 18, borderWidth: 1.5,
    padding: 16, alignItems: 'center', gap: 7,
    ...shadow.sm,
  },
  payIconCircle: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  payLabel: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  payDesc: { fontSize: 11, color: C.t3, textAlign: 'center', lineHeight: 15 },

  // Receipt
  receiptHeader: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  receiptLogoCircle: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  receiptStoreName: { fontSize: 17, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
  receiptSubLabel: { fontSize: 10, letterSpacing: 2.5, fontWeight: '700', color: C.t3, marginTop: 3 },

  pmBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
  },
  pmBannerText: { fontSize: 13, fontWeight: '700' },

  receiptInfo: { paddingHorizontal: 20, paddingBottom: 4 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  infoLabel: { fontSize: 12, color: C.t3, fontWeight: '500' },
  infoValue: { fontSize: 12, color: C.t1, fontWeight: '700' },

  divider: { height: 1, backgroundColor: C.borderLt, marginHorizontal: 20, marginVertical: 8 },

  itemsSection: { paddingHorizontal: 20 },
  itemsHeader: {
    flexDirection: 'row', paddingBottom: 8,
    borderBottomWidth: 1.5, borderBottomColor: C.border, marginBottom: 4,
  },
  itemCol: { fontSize: 10, fontWeight: '700', color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8 },
  colCenter: { textAlign: 'center', width: 40 },
  colRight: { textAlign: 'right', width: 72 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemName: { fontSize: 13, color: C.t1, fontWeight: '500' },
  itemQty: { fontSize: 13, color: C.t2, width: 40, textAlign: 'center', fontWeight: '600' },
  itemAmt: { fontSize: 13, color: C.t1, fontWeight: '700', width: 72, textAlign: 'right' },

  totalsSection: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 5,
  },
  totalLabel: { fontSize: 13, color: C.t2 },
  totalValue: { fontSize: 13, color: C.t1, fontWeight: '700' },
  grandTotalRow: {
    marginTop: 8, paddingTop: 12,
    borderTopWidth: 2, borderTopColor: C.border,
  },
  grandTotalLabel: { fontSize: 14, fontWeight: '800', color: C.t1, letterSpacing: 0.5 },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },

  pendingNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.amberBg, marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.amberBd,
  },
  pendingNoteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  closeFullBtn: {
    margin: 16, marginTop: 6, paddingVertical: 15,
    backgroundColor: C.surface, borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  closeFullBtnText: { fontSize: 15, fontWeight: '700', color: C.t1 },
});
