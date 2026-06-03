import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { C, shadow } from '../../../constants/theme';

const PM = {
  cash:   { color: C.primary,  bg: C.primaryLt,  border: C.primaryBd,  icon: 'cash-outline',           label: 'Cash'   },
  card:   { color: C.blue,     bg: C.blueBg,      border: C.blueBd,     icon: 'card-outline',           label: 'Card'   },
  online: { color: C.purple,   bg: C.purpleBg,    border: C.purpleBd,   icon: 'phone-portrait-outline', label: 'Online' },
};

const OT_LABEL = { dine_in: 'Dine In', takeaway: 'Takeaway', on_spot: 'Walk-in', delivery: 'Delivery' };
const OT_COLOR = {
  dine_in:  { color: C.primary, bg: C.primaryLt, border: C.primaryBd },
  takeaway: { color: C.amber,   bg: C.amberBg,   border: C.amberBd   },
  on_spot:  { color: C.blue,    bg: C.blueBg,    border: C.blueBd    },
  delivery: { color: C.purple,  bg: C.purpleBg,  border: C.purpleBd  },
};

export default function HistoryScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/sales?limit=50&page=1');
      const data = res.data?.data || res.data || [];
      setSales(Array.isArray(data) ? data.filter((s) => s.status === 'completed') : []);
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

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <Text style={styles.subHeaderTitle}>Completed Orders</Text>
          {sales.length > 0 && (
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{sales.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={fetchHistory} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={17} color={C.t2} />
        </TouchableOpacity>
      </View>

      {sales.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyCircle}>
            <Ionicons name="time-outline" size={38} color={C.t3} />
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
              colors={[C.primary]} />
          }
          renderItem={({ item }) => {
            const pm  = PM[item.payment_method] || PM.cash;
            const otc = OT_COLOR[item.order_type] || OT_COLOR.dine_in;
            return (
              <View style={styles.card}>
                {/* Left accent */}
                <View style={[styles.cardAccent, { backgroundColor: pm.color }]} />

                <View style={styles.cardBody}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={styles.invoiceWrap}>
                      <Text style={styles.invoiceNo}>{item.invoice_no || `Sale #${item.sale_id}`}</Text>
                      {item.token_no && (
                        <View style={styles.tokenChip}>
                          <Text style={styles.tokenText}>{item.token_no}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.pmChip, { backgroundColor: pm.bg, borderColor: pm.border }]}>
                      <Ionicons name={pm.icon} size={11} color={pm.color} />
                      <Text style={[styles.pmText, { color: pm.color }]}>{pm.label}</Text>
                    </View>
                  </View>

                  {/* Meta row */}
                  <View style={styles.metaRow}>
                    {item.table_name && (
                      <View style={styles.metaItem}>
                        <Ionicons name="restaurant-outline" size={11} color={C.t3} />
                        <Text style={styles.metaText}>{item.table_name}</Text>
                      </View>
                    )}
                    {item.order_type && (
                      <View style={[styles.metaItem, styles.otChip, { backgroundColor: otc.bg, borderColor: otc.border }]}>
                        <Ionicons name="layers-outline" size={10} color={otc.color} />
                        <Text style={[styles.metaText, { color: otc.color, fontWeight: '700' }]}>
                          {OT_LABEL[item.order_type] || item.order_type}
                        </Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={11} color={C.t3} />
                      <Text style={styles.metaText}>{fmtDate(item.sale_date)} · {fmtTime(item.sale_date)}</Text>
                    </View>
                  </View>

                  {/* Bottom row */}
                  <View style={styles.cardBottom}>
                    <View style={styles.cashierRow}>
                      <Ionicons name="person-circle-outline" size={14} color={C.t3} />
                      <Text style={styles.cashierText}>{item.cashier_name || '—'}</Text>
                    </View>
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
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.t2, fontSize: 14, marginTop: 8 },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.t1 },
  emptySub: { fontSize: 13, color: C.t2 },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderTitle: { fontSize: 14, fontWeight: '700', color: C.t1 },
  countChip: {
    backgroundColor: C.primaryLt, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd,
  },
  countChipText: { fontSize: 11, fontWeight: '700', color: C.primary },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },

  list: { padding: 14, gap: 10, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  invoiceWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  invoiceNo: { fontSize: 14, fontWeight: '700', color: C.t1 },
  tokenChip: {
    backgroundColor: C.primaryLt, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd,
  },
  tokenText: { fontSize: 10, fontWeight: '700', color: C.primary },
  pmChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  pmText: { fontSize: 11, fontWeight: '700' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  otChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1,
  },
  metaText: { fontSize: 11.5, color: C.t2 },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cashierRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cashierText: { fontSize: 12, color: C.t3 },
  amount: { fontSize: 18, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
});
