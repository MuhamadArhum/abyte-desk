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
import { C, shadow } from '../../../constants/theme';

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
  const [searchQuery, setSearchQuery] = useState('');

  const {
    items, addItem, incrementItem, decrementItem,
    setItems, clearCart, existingSaleId,
  } = useCartStore();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const getCatKey = (ot) => ot === 'on_spot' ? 'walk_in' : (ot || 'dine_in');

  const taxPercent = React.useMemo(() => {
    if (!settings) return 0;
    const cashRate   = parseFloat(settings.tax_on_cash   || settings.tax_rate || 0);
    const onlineRate = parseFloat(settings.tax_on_online || settings.tax_rate || 0);
    if (settings.pos_mode === 'category' && settings.pos_tax_config) {
      const cat = settings.pos_tax_config[getCatKey(orderType)] || {};
      if (!cat.tax_enabled) return 0;
      // Tax enabled for this order type — use payment method rate
    }
    return orderType === 'delivery' ? onlineRate : cashRate;
  }, [settings, orderType]);

  const additionalPercent = React.useMemo(() => {
    if (!settings?.pos_tax_config) return 0;
    const cat = settings.pos_tax_config[getCatKey(orderType)] || {};
    const service = cat.service_enabled ? parseFloat(cat.service_rate || 0) : 0;
    const other   = cat.other_enabled   ? parseFloat(cat.other_rate   || 0) : 0;
    return service + other;
  }, [settings, orderType]);

  const taxAmount        = Math.round((subtotal * taxPercent)        / 100 * 100) / 100;
  const additionalAmount = Math.round((subtotal * additionalPercent) / 100 * 100) / 100;
  const totalAmount      = Math.round((subtotal + taxAmount + additionalAmount) * 100) / 100;

  const displayProducts = React.useMemo(() => {
    let list = selectedCat ? products.filter((p) => p.category_id === selectedCat) : products;
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((p) => p.product_name.toLowerCase().includes(q));
    return list;
  }, [products, selectedCat, searchQuery]);

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
          additional_charges_percent: parseFloat(additionalPercent.toFixed(2)),
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
          additional_charges_percent: parseFloat(additionalPercent.toFixed(2)),
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
        <ActivityIndicator size="large" color={C.primary} />
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
          <Ionicons name="create-outline" size={14} color={C.amber} />
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

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={C.t3} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu items..."
          placeholderTextColor={C.t3}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={C.t3} />
          </TouchableOpacity>
        )}
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
        ListEmptyComponent={
          <View style={styles.searchEmpty}>
            <Ionicons name="search-outline" size={36} color={C.t3} />
            <Text style={styles.searchEmptyTitle}>No items found</Text>
            <Text style={styles.searchEmptySub}>Try a different name or category</Text>
          </View>
        }
        renderItem={({ item }) => {
          const inCart = items.find((i) => i.product_id === item.product_id);
          const price = parseFloat(item.selling_price || item.price || 0);
          return (
            <TouchableOpacity
              style={[styles.prodCard, inCart && styles.prodCardActive]}
              onPress={() => addItem(item)}
              activeOpacity={0.85}
            >
              {inCart && (
                <View style={styles.prodCheckBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
              <Text style={[styles.prodName, inCart && styles.prodNameActive]} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={[styles.prodPrice, inCart && styles.prodPriceActive]}>
                PKR {price.toFixed(0)}
              </Text>
              {inCart ? (
                <View style={styles.qtyRow}>
                  {!isEditMode && (
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => decrementItem(item.product_id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={15} color={C.primary} />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.qtyNum}>{inCart.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => incrementItem(item.product_id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={15} color={C.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.addRow}>
                  <Ionicons name="add-circle-outline" size={22} color={C.primary} />
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
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setCartVisible(false)}>
                <Ionicons name="close" size={18} color={C.t2} />
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.cartEmpty}>
                <Ionicons name="cart-outline" size={52} color={C.t3} />
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
                            <Ionicons name="remove" size={15} color={C.primary} />
                          </TouchableOpacity>
                        )}
                        <Text style={styles.qtyNum}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => incrementItem(item.product_id)}>
                          <Ionicons name="add" size={15} color={C.primary} />
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
                      placeholderTextColor={C.t3}
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
  container: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, gap: 12,
  },
  loadingText: { color: C.t2, fontSize: 14, marginTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primaryHd, paddingHorizontal: 14,
    paddingVertical: 14, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTable: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  cartIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: C.red, minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.primaryHd,
  },
  cartBadgeText: { fontSize: 9, color: '#FFF', fontWeight: '800' },

  editBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.amberBg, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.amberBd,
  },
  editBarText: { fontSize: 12, color: C.amber, flex: 1, fontWeight: '500' },

  catBar: {
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  catScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
  },
  catTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  catTabText: { fontSize: 13, color: C.t2, fontWeight: '600' },
  catTabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  productGrid: { padding: 12 },
  productRow: { gap: 10 },
  prodCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 18,
    padding: 14, marginBottom: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
    ...shadow.sm,
  },
  prodCardActive: {
    borderColor: C.primary, backgroundColor: C.primaryLt,
    borderWidth: 2,
  },
  prodCheckBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  prodName: {
    fontSize: 13, fontWeight: '700', color: C.t1,
    textAlign: 'center', marginBottom: 5, minHeight: 36, lineHeight: 18,
  },
  prodNameActive: { color: C.primaryDk },
  prodPrice: { fontSize: 15, fontWeight: '800', color: C.primary, marginBottom: 10, letterSpacing: -0.3 },
  prodPriceActive: { color: C.primaryDk },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.primaryBd,
  },
  qtyNum: { fontSize: 15, fontWeight: '800', color: C.t1, minWidth: 22, textAlign: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addText: { fontSize: 13, color: C.primary, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  bottomCount: { fontSize: 12, color: C.t3, marginBottom: 2 },
  bottomTotal: { fontSize: 22, fontWeight: '800', color: C.t1, letterSpacing: -0.5 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  cartSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: SCREEN_H * 0.85,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  cartEmpty: { alignItems: 'center', padding: 48, gap: 10 },
  cartEmptyText: { color: C.t2, fontSize: 15, fontWeight: '600' },
  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: C.borderLt, gap: 12,
  },
  cartItemName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.t1, lineHeight: 20 },
  cartItemRight: { alignItems: 'flex-end', gap: 6 },
  cartItemTotal: { fontSize: 13, fontWeight: '800', color: C.primary },
  noteWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  noteLabel: {
    fontSize: 11, fontWeight: '700', color: C.t3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: C.t1,
    minHeight: 64, backgroundColor: C.surface, textAlignVertical: 'top',
  },
  sheetFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.borderLt,
    gap: 14,
  },
  sheetTotalLabel: { fontSize: 13, fontWeight: '700', color: C.t1 },
  sheetTotalAmount: { fontSize: 20, fontWeight: '800', color: C.t1, letterSpacing: -0.4 },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  taxLabel: { fontSize: 12, color: C.t3 },
  taxValue: { fontSize: 12, color: C.t2, fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 12, marginTop: 10, marginBottom: 2,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    paddingRight: 10, height: 44,
    ...shadow.sm,
  },
  searchIcon: { paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: C.t1, height: 44 },
  searchClear: { padding: 4 },

  searchEmpty: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, gap: 8,
  },
  searchEmptyTitle: { fontSize: 16, fontWeight: '700', color: C.t1 },
  searchEmptySub: { fontSize: 13, color: C.t3 },
});
