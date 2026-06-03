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

const ORDER_TYPE_LABEL = {
  dine_in: 'Dine In',
  takeaway: 'Takeaway',
  on_spot: 'Walk-in',
  delivery: 'Delivery',
};

export default function OrderScreen() {
  const { id: tableId, name, saleId, orderType: orderTypeParam } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const tableName = name ? decodeURIComponent(name) : 'Order';
  const isEditMode = !!saleId;

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [orderType, setOrderType] = useState(orderTypeParam || 'dine_in');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [note, setNote] = useState('');

  const {
    items, addItem, incrementItem, decrementItem,
    setItems, clearCart, existingSaleId,
  } = useCartStore();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

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
      const requests = [
        api.get('/products/categories?type=finished_good'),
        api.get('/products?type=finished_good'),
        api.get('/settings'),
      ];
      if (saleId) requests.push(api.get(`/sales/${saleId}`));

      const results = await Promise.allSettled(requests);

      const catRes  = results[0].status === 'fulfilled' ? results[0].value : null;
      const prodRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const setRes  = results[2].status === 'fulfilled' ? results[2].value : null;
      const saleRes = results[3]?.status === 'fulfilled' ? results[3].value : null;

      const cats  = Array.isArray(catRes?.data?.data)  ? catRes.data.data
                  : Array.isArray(catRes?.data)         ? catRes.data : [];
      const prods = Array.isArray(prodRes?.data?.data) ? prodRes.data.data
                  : Array.isArray(prodRes?.data)        ? prodRes.data : [];

      setCategories(cats);
      setProducts(prods);
      setSelectedCat(null);

      if (setRes?.data) {
        const s = setRes.data;
        if (s.pos_tax_config && typeof s.pos_tax_config === 'string') {
          try { s.pos_tax_config = JSON.parse(s.pos_tax_config); } catch { s.pos_tax_config = null; }
        }
        setSettings(s);
      }

      if (saleRes?.data) {
        const saleData = saleRes.data;
        // Use the sale's stored order type
        if (saleData.order_type) setOrderType(saleData.order_type);

        // Pre-load existing items into cart
        const details = saleData?.items || saleData?.details || [];
        const cartItems = details.map((d) => {
          const matched = prods.find((p) => p.product_id === d.product_id);
          return {
            product_id: d.product_id,
            product_name: d.product_name || matched?.product_name || 'Item',
            unit_price: parseFloat(d.unit_price || d.selling_price || matched?.selling_price || 0),
            quantity: d.quantity,
            variant_id: d.variant_id || null,
          };
        });
        setItems(cartItems);
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

    const title   = isEditMode ? 'Update Order?' : 'Send to Kitchen?';
    const message = isEditMode
      ? `Save changes to this order?\n${totalItems} item(s) • PKR ${totalAmount.toFixed(0)}`
      : `Send order for ${tableName} to kitchen?\n${totalItems} item(s) • PKR ${totalAmount.toFixed(0)}`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: isEditMode ? 'Update' : 'Send', onPress: submitOrder },
    ]);
  };

  const submitOrder = async () => {
    setSending(true);
    try {
      if (isEditMode) {
        await api.put(`/sales/${saleId}/items`, {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: parseFloat(i.unit_price || 0),
            variant_id: i.variant_id || null,
          })),
          total_amount: totalAmount,
          tax_percent: parseFloat(taxPercent.toFixed(2)),
        });

        Alert.alert('Updated!', 'Order has been updated.', [
          { text: 'OK', onPress: () => { clearCart(); router.back(); } },
        ]);
      } else {
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

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTable}>{tableName}</Text>
          <Text style={styles.headerSub}>
            {ORDER_TYPE_LABEL[orderType] || orderType}
            {isEditMode ? '  •  Editing order' : ''}
          </Text>
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

      {/* Edit mode notice */}
      {isEditMode && (
        <View style={styles.editBar}>
          <Ionicons name="create-outline" size={14} color="#1E40AF" />
          <Text style={styles.editBarText}>
            You can add items to this order — reducing or deleting is not allowed
          </Text>
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
                  {/* Hide minus in edit mode — no reducing allowed */}
                  {!isEditMode && (
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => decrementItem(item.product_id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={15} color="#1E40AF" />
                    </TouchableOpacity>
                  )}
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
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={17} color="#FFFFFF" />
                <Text style={styles.sendBtnText}>
                  {isEditMode ? 'Update Order' : 'Send to Kitchen'}
                </Text>
              </>
            )}
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
                        {/* Hide minus in edit mode */}
                        {!isEditMode && (
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => decrementItem(item.product_id)}>
                            <Ionicons name="remove" size={15} color="#1E40AF" />
                          </TouchableOpacity>
                        )}
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

                {!isEditMode && (
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
                  {sending ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={17} color="#FFFFFF" />
                      <Text style={styles.sendBtnText}>
                        {isEditMode ? 'Update Order' : 'Send to Kitchen'}
                      </Text>
                    </>
                  )}
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB', gap: 12,
  },
  loadingText: { color: '#6B7280', fontSize: 14, marginTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#059669', paddingHorizontal: 14,
    paddingVertical: 12, gap: 10,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1 },
  headerTable: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cartIconBtn: { padding: 6, position: 'relative' },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#DC2626', width: 17, height: 17,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },

  editBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#6EE7B7',
  },
  editBarText: { fontSize: 12, color: '#047857', flex: 1 },

  catBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  catScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  catTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  catTabActive: { backgroundColor: '#059669', borderColor: '#059669' },
  catTabText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  catTabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  productGrid: { padding: 12 },
  productRow: { gap: 10 },
  prodCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 12, marginBottom: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  prodCardActive: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  prodName: {
    fontSize: 13, fontWeight: '600', color: '#111827',
    textAlign: 'center', marginBottom: 4, minHeight: 36,
  },
  prodPrice: { fontSize: 14, fontWeight: 'bold', color: '#059669', marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  qtyNum: { fontSize: 14, fontWeight: 'bold', color: '#111827', minWidth: 20, textAlign: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontSize: 13, color: '#059669', fontWeight: '600' },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  bottomCount: { fontSize: 12, color: '#9CA3AF' },
  bottomTotal: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#059669', paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 12,
  },
  sendBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  cartSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: SCREEN_H * 0.85,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  cartEmpty: { alignItems: 'center', padding: 40, gap: 10 },
  cartEmptyText: { color: '#9CA3AF', fontSize: 15 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 12,
  },
  cartItemName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
  cartItemRight: { alignItems: 'flex-end', gap: 6 },
  cartItemTotal: { fontSize: 13, fontWeight: 'bold', color: '#059669' },
  noteWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  noteLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  noteInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 10, fontSize: 14, color: '#111827',
    minHeight: 60, backgroundColor: '#F9FAFB', textAlignVertical: 'top',
  },
  sheetFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  sheetTotalLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sheetTotalAmount: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  taxLabel: { fontSize: 12, color: '#9CA3AF' },
  taxValue: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});
