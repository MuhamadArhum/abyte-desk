import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal,
  TextInput, Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '../../../services/api';
import useCartStore from '../../../store/cartStore';

const { height: SCREEN_H } = Dimensions.get('window');

const ORDER_TYPES = [
  { value: 'dine_in',   label: 'Dine In',   icon: 'restaurant-outline' },
  { value: 'takeaway',  label: 'Takeaway',  icon: 'bag-handle-outline' },
  { value: 'on_spot',   label: 'Walk-in',   icon: 'walk-outline' },
  { value: 'delivery',  label: 'Delivery',  icon: 'bicycle-outline' },
];

export default function OrderScreen() {
  const { id: tableId, name, saleId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const tableName = name ? decodeURIComponent(name) : 'Table';

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [existingItems, setExistingItems] = useState([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [note, setNote] = useState('');

  const {
    items, addItem, incrementItem, decrementItem,
    clearCart, existingSaleId,
  } = useCartStore();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  // Calculate tax based on store settings + pos_mode
  const taxPercent = React.useMemo(() => {
    if (!settings) return 0;
    const fallback = parseFloat(settings.tax_rate || 0);

    if (settings.pos_mode === 'category' && settings.pos_tax_config) {
      const cfg = settings.pos_tax_config;
      if (!items.length) return 0;
      let taxedAmount = 0;
      items.forEach((item) => {
        const prod = products.find((p) => p.product_id === item.product_id);
        const catId = String(prod?.category_id || '');
        const catTax = cfg[catId] != null ? parseFloat(cfg[catId]) : fallback;
        taxedAmount += (item.unit_price * item.quantity * catTax) / 100;
      });
      return subtotal > 0 ? (taxedAmount / subtotal) * 100 : 0;
    }

    // Simple mode
    if (orderType === 'delivery') return parseFloat(settings.tax_on_online ?? fallback);
    return parseFloat(settings.tax_on_cash ?? fallback);
  }, [settings, orderType, items, products, subtotal]);

  const taxAmount = Math.round((subtotal * taxPercent) / 100 * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  const displayProducts = selectedCat
    ? products.filter((p) => p.category_id === selectedCat)
    : products;

  const loadData = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/products/categories?type=finished_good'),
        api.get('/products?type=finished_good'),
      ]);

      const cats = Array.isArray(catRes.data?.data) ? catRes.data.data
                  : Array.isArray(catRes.data) ? catRes.data : [];
      const prods = Array.isArray(prodRes.data?.data) ? prodRes.data.data
                   : Array.isArray(prodRes.data) ? prodRes.data : [];

      setCategories(cats);
      setProducts(prods);
      setSelectedCat(null);

      // Fetch settings separately so menu still loads if settings fail
      try {
        const settingsRes = await api.get('/settings');
        const s = settingsRes.data || {};
        // Parse pos_tax_config if it's a string
        if (s.pos_tax_config && typeof s.pos_tax_config === 'string') {
          try { s.pos_tax_config = JSON.parse(s.pos_tax_config); } catch { s.pos_tax_config = null; }
        }
        console.log('[Settings]', JSON.stringify({
          pos_mode: s.pos_mode,
          tax_rate: s.tax_rate,
          tax_on_cash: s.tax_on_cash,
          tax_on_card: s.tax_on_card,
          tax_on_online: s.tax_on_online,
        }));
        setSettings(s);
      } catch (e) {
        console.warn('[Settings] fetch failed:', e.message);
      }

      // Load existing order items if editing
      if (saleId) {
        const saleRes = await api.get(`/sales/${saleId}`);
        const saleData = saleRes.data;
        setExistingItems(saleData?.items || saleData?.details || []);
      }
    } catch (err) {
      console.error('loadData error:', err.message);
      Alert.alert('Error', 'Failed to load menu. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    loadData();
    return () => clearCart();
  }, []);

  const handleBack = () => {
    clearCart();
    router.back();
  };

  const handleSendOrder = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Please add at least one item.');
      return;
    }

    Alert.alert(
      existingSaleId ? 'Add to Order?' : 'Send to Kitchen?',
      existingSaleId
        ? `Add ${totalItems} item(s) to the existing order?`
        : `Send order for ${tableName} to kitchen?\n${totalItems} item(s) • PKR ${totalAmount.toFixed(0)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: existingSaleId ? 'Add' : 'Send', onPress: submitOrder },
      ]
    );
  };

  const submitOrder = async () => {
    setSending(true);
    try {
      if (existingSaleId) {
        // Merge new items into existing sale
        const merged = [...existingItems];
        items.forEach((newItem) => {
          const existing = merged.find((e) => e.product_id === newItem.product_id);
          if (existing) {
            existing.quantity = (existing.quantity || 0) + newItem.quantity;
          } else {
            merged.push({
              product_id: newItem.product_id,
              quantity: newItem.quantity,
              unit_price: newItem.unit_price,
              variant_id: newItem.variant_id || null,
            });
          }
        });

        await api.put(`/sales/${existingSaleId}/items`, {
          items: merged.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: parseFloat(i.unit_price || i.selling_price || 0),
            variant_id: i.variant_id || null,
          })),
        });

        Alert.alert('Done!', 'Items added to the order.', [
          { text: 'OK', onPress: () => { clearCart(); router.back(); } },
        ]);
      } else {
        // Create new pending order
        const res = await api.post('/sales', {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            variant_id: i.variant_id || null,
          })),
          table_id: parseInt(tableId) || null,
          order_type: orderType,
          status: 'pending',
          payment_method: orderType === 'delivery' ? 'online' : 'cash',
          tax_percent: parseFloat(taxPercent.toFixed(2)),
          discount: 0,
          note: note.trim() || null,
        });

        const token = res.data?.token_no || res.data?.sale?.token_no;
        Alert.alert(
          'Order Sent!',
          `Token: ${token || '—'}\nOrder is now in the kitchen queue.`,
          [{ text: 'OK', onPress: () => { clearCart(); router.back(); } }]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send order. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSending(false);
    }
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  // ─── Main render ───────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTable}>{tableName}</Text>
          {existingSaleId && (
            <Text style={styles.headerSub}>Adding to existing order</Text>
          )}
        </View>
        <TouchableOpacity style={styles.cartIconBtn} onPress={() => setCartVisible(true)} activeOpacity={0.7}>
          <Ionicons name="cart-outline" size={23} color="#FFFFFF" />
          {totalItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Existing order notice */}
      {existingSaleId && existingItems.length > 0 && (
        <View style={styles.existingBar}>
          <Ionicons name="information-circle-outline" size={14} color="#92400E" />
          <Text style={styles.existingBarText}>
            {existingItems.length} item(s) already in this order — add more below
          </Text>
        </View>
      )}

      {/* Order Type Selector — hidden when editing existing order */}
      {!existingSaleId && (
        <View style={styles.orderTypeBar}>
          <Text style={styles.orderTypeLabel}>Order Type:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderTypeScroll}>
            {ORDER_TYPES.map((ot) => (
              <TouchableOpacity
                key={ot.value}
                style={[styles.otBtn, orderType === ot.value && styles.otBtnActive]}
                onPress={() => setOrderType(ot.value)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={ot.icon}
                  size={14}
                  color={orderType === ot.value ? '#FFFFFF' : '#64748B'}
                />
                <Text style={[styles.otBtnText, orderType === ot.value && styles.otBtnTextActive]}>
                  {ot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Category tabs */}
      <View style={styles.catBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          <TouchableOpacity
            style={[styles.catTab, selectedCat === null && styles.catTabActive]}
            onPress={() => setSelectedCat(null)}
          >
            <Text style={[styles.catTabText, selectedCat === null && styles.catTabTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.category_id}
              style={[styles.catTab, selectedCat === cat.category_id && styles.catTabActive]}
              onPress={() => setSelectedCat(cat.category_id)}
            >
              <Text style={[styles.catTabText, selectedCat === cat.category_id && styles.catTabTextActive]}>
                {cat.category_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Product grid */}
      <FlatList
        data={displayProducts}
        keyExtractor={(item) => String(item.product_id)}
        numColumns={2}
        contentContainerStyle={[
          styles.productGrid,
          { paddingBottom: totalItems > 0 ? 100 : 24 },
        ]}
        columnWrapperStyle={styles.productRow}
        renderItem={({ item }) => {
          const inCart = items.find((i) => i.product_id === item.product_id);
          const price = parseFloat(item.selling_price || item.price || 0);
          return (
            <TouchableOpacity
              style={[styles.prodCard, inCart && styles.prodCardActive]}
              onPress={() => addItem(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.prodName} numberOfLines={2}>{item.product_name}</Text>
              <Text style={styles.prodPrice}>PKR {price.toFixed(0)}</Text>
              {inCart ? (
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => decrementItem(item.product_id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="remove" size={15} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{inCart.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => incrementItem(item.product_id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={15} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.addRow}>
                  <Ionicons name="add-circle-outline" size={20} color="#1E40AF" />
                  <Text style={styles.addText}>Add</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom bar */}
      {totalItems > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <View>
            <Text style={styles.bottomCount}>
              {totalItems} item(s){taxPercent > 0 ? `  •  Tax ${taxPercent.toFixed(1)}%` : ''}
            </Text>
            <Text style={styles.bottomTotal}>PKR {totalAmount.toFixed(0)}</Text>
          </View>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSendOrder}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#FFF" size="small" />
              : (
                <>
                  <Ionicons name="send" size={17} color="#FFFFFF" />
                  <Text style={styles.sendBtnText}>
                    {existingSaleId ? 'Add to Order' : 'Send to Kitchen'}
                  </Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Cart modal */}
      <Modal
        visible={cartVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCartVisible(false)}
      >
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setCartVisible(false)} />
          <View style={[styles.cartSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cart</Text>
              <TouchableOpacity onPress={() => setCartVisible(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.cartEmpty}>
                <Ionicons name="cart-outline" size={52} color="#CBD5E1" />
                <Text style={styles.cartEmptyText}>Cart is empty</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: SCREEN_H * 0.45 }}>
                {items.map((item) => (
                  <View key={item.product_id} style={styles.cartItem}>
                    <Text style={styles.cartItemName} numberOfLines={2}>{item.product_name}</Text>
                    <View style={styles.cartItemRight}>
                      <View style={styles.qtyRow}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => decrementItem(item.product_id)}>
                          <Ionicons name="remove" size={15} color="#1E40AF" />
                        </TouchableOpacity>
                        <Text style={styles.qtyNum}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => incrementItem(item.product_id)}>
                          <Ionicons name="add" size={15} color="#1E40AF" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cartItemTotal}>
                        PKR {(item.unit_price * item.quantity).toFixed(0)}
                      </Text>
                    </View>
                  </View>
                ))}

                {!existingSaleId && (
                  <View style={styles.noteWrap}>
                    <Text style={styles.noteLabel}>Order Note (optional)</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Special instructions..."
                      placeholderTextColor="#CBD5E1"
                      value={note}
                      onChangeText={setNote}
                      multiline
                    />
                  </View>
                )}
              </ScrollView>
            )}

            {items.length > 0 && (
              <View style={styles.sheetFooter}>
                <View style={{ flex: 1 }}>
                  <View style={styles.taxRow}>
                    <Text style={styles.taxLabel}>Subtotal</Text>
                    <Text style={styles.taxValue}>PKR {subtotal.toFixed(0)}</Text>
                  </View>
                  {taxPercent > 0 && (
                    <View style={styles.taxRow}>
                      <Text style={styles.taxLabel}>Tax ({taxPercent.toFixed(1)}%)</Text>
                      <Text style={styles.taxValue}>PKR {taxAmount.toFixed(0)}</Text>
                    </View>
                  )}
                  <View style={[styles.taxRow, { marginTop: 4 }]}>
                    <Text style={styles.sheetTotalLabel}>Total</Text>
                    <Text style={styles.sheetTotalAmount}>PKR {totalAmount.toFixed(0)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => { setCartVisible(false); handleSendOrder(); }}
                  disabled={sending}
                >
                  {sending
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : (
                      <>
                        <Ionicons name="send" size={17} color="#FFFFFF" />
                        <Text style={styles.sendBtnText}>
                          {existingSaleId ? 'Add to Order' : 'Send to Kitchen'}
                        </Text>
                      </>
                    )
                  }
                </TouchableOpacity>
              </View>
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
  loadingText: { color: '#64748B', fontSize: 14, marginTop: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E40AF', paddingHorizontal: 14,
    paddingVertical: 12, gap: 10,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1 },
  headerTable: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  cartIconBtn: { padding: 6, position: 'relative' },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#EF4444', width: 17, height: 17,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },

  // Existing order bar
  existingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  existingBarText: { fontSize: 12, color: '#92400E', flex: 1 },

  // Order type bar
  orderTypeBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 14,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  orderTypeLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  orderTypeScroll: { gap: 8 },
  otBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F1F5F9',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  otBtnActive: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  otBtnText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  otBtnTextActive: { color: '#FFFFFF' },

  // Category bar
  catBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  catScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  catTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  catTabActive: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  catTabText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  catTabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Product grid
  productGrid: { padding: 12 },
  productRow: { gap: 10 },
  prodCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 12, marginBottom: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  prodCardActive: { borderColor: '#1E40AF', backgroundColor: '#EFF6FF' },
  prodName: {
    fontSize: 13, fontWeight: '600', color: '#1E293B',
    textAlign: 'center', marginBottom: 4, minHeight: 36,
  },
  prodPrice: { fontSize: 14, fontWeight: 'bold', color: '#1E40AF', marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  qtyNum: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', minWidth: 20, textAlign: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontSize: 13, color: '#1E40AF', fontWeight: '600' },

  // Bottom send bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  bottomCount: { fontSize: 12, color: '#94A3B8' },
  bottomTotal: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1E40AF', paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 12,
  },
  sendBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

  // Cart modal
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  cartSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: SCREEN_H * 0.85,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  cartEmpty: { alignItems: 'center', padding: 40, gap: 10 },
  cartEmptyText: { color: '#94A3B8', fontSize: 15 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: 12,
  },
  cartItemName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1E293B' },
  cartItemRight: { alignItems: 'flex-end', gap: 6 },
  cartItemTotal: { fontSize: 13, fontWeight: 'bold', color: '#1E40AF' },
  noteWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  noteLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  noteInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 10, fontSize: 14, color: '#1E293B',
    minHeight: 60, backgroundColor: '#F8FAFC', textAlignVertical: 'top',
  },
  sheetFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  sheetTotalLabel: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  sheetTotalAmount: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  taxLabel: { fontSize: 12, color: '#94A3B8' },
  taxValue: { fontSize: 12, color: '#64748B', fontWeight: '500' },
});
