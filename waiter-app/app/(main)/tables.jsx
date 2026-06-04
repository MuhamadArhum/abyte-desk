import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, StatusBar, Platform, Animated,
} from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import useCartStore from '../../store/cartStore';
import { C, shadow } from '../../constants/theme';

// Pulsing skeleton box
function SkeletonBox({ style }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#E2E8F0', borderRadius: 12 }, style, { opacity }]} />;
}

function TableSkeleton() {
  return (
    <View style={skStyles.wrap}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={skStyles.card}>
          <SkeletonBox style={{ width: 58, height: 58, borderRadius: 18, marginBottom: 10 }} />
          <SkeletonBox style={{ width: 80, height: 14, marginBottom: 6 }} />
          <SkeletonBox style={{ width: 60, height: 11, marginBottom: 10 }} />
          <SkeletonBox style={{ width: 80, height: 26, borderRadius: 20 }} />
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 12 },
  card: {
    flex: 1, minWidth: '44%', backgroundColor: C.card, borderRadius: 20,
    padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
    ...shadow.md,
  },
});

export default function TablesScreen() {
  const { orderType } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { setTable } = useCartStore();

  const fetchTables = useCallback(async () => {
    try {
      const res = await api.get('/restaurant/tables');
      const all = res.data || [];
      setTables(all.filter((t) => t.status === 'available' && Number(t.has_pending_order) === 0));
    } catch (err) {
      console.error('fetchTables error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchTables();
  }, [fetchTables]));

  const handleTablePress = (table) => {
    setTable(table.table_id, table.table_name, null);
    router.push(`/(main)/order/${table.table_id}?name=${encodeURIComponent(table.table_name)}&orderType=${orderType || 'dine_in'}`);
  };

  const filteredTables = searchQuery.trim()
    ? tables.filter((t) =>
        t.table_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (t.floor && t.floor.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      )
    : tables;

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: statusBarH }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryHd} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Table</Text>
          <Text style={styles.headerSub}>Dine In — Free tables</Text>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); fetchTables(); }} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={C.t3} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tables or floors..."
          placeholderTextColor={C.t3}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={C.t3} style={{ paddingRight: 10 }} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <TableSkeleton />
      ) : filteredTables.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyCircle}>
            <Ionicons name={tables.length === 0 ? 'close-circle' : 'search-outline'} size={40} color={tables.length === 0 ? C.red : C.t3} />
          </View>
          <Text style={styles.emptyTitle}>{tables.length === 0 ? 'All Tables Occupied' : 'No Match Found'}</Text>
          <Text style={styles.emptySub}>{tables.length === 0 ? 'No free tables right now' : 'Try a different name or floor'}</Text>
          {tables.length === 0 && (
            <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); fetchTables(); }}>
              <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTables}
          keyExtractor={(item) => String(item.table_id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchTables(); }}
              colors={[C.primary]} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.badge}>
                <View style={styles.greenDot} />
                <Text style={styles.badgeText}>
                  {filteredTables.length}{searchQuery ? ` of ${tables.length}` : ''} free {filteredTables.length === 1 ? 'table' : 'tables'}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tableCard}
              onPress={() => handleTablePress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.tableTop}>
                <View style={styles.tableIcon}>
                  <Ionicons name="restaurant" size={26} color={C.primary} />
                </View>
                <View style={styles.availDot} />
              </View>
              <Text style={styles.tableName}>{item.table_name}</Text>
              {item.floor ? <Text style={styles.tableFloor}>{item.floor}</Text> : null}
              {item.capacity ? (
                <View style={styles.capRow}>
                  <Ionicons name="people-outline" size={12} color={C.t3} />
                  <Text style={styles.capText}>{item.capacity} seats</Text>
                </View>
              ) : null}
              <View style={styles.availBadge}>
                <Text style={styles.availText}>Available</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primaryHd,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 14, marginTop: 12, marginBottom: 4,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    height: 46, ...shadow.sm,
  },
  searchIcon: { paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: C.t1, height: 46 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.redBg, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.t1 },
  emptySub: { fontSize: 13, color: C.t2 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, marginTop: 4,
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  listHeader: { paddingBottom: 12, paddingHorizontal: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.primaryLt, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd,
  },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  badgeText: { fontSize: 12, fontWeight: '700', color: C.primary },

  grid: { padding: 14, paddingBottom: 30 },
  row: { gap: 12, marginBottom: 12 },
  tableCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 20,
    padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
    ...shadow.md,
  },
  tableTop: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10, position: 'relative' },
  tableIcon: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: C.primaryLt,
    alignItems: 'center', justifyContent: 'center',
  },
  availDot: {
    position: 'absolute', right: 0, top: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.primary,
    borderWidth: 2, borderColor: C.card,
  },
  tableName: { fontSize: 16, fontWeight: '800', color: C.t1, marginBottom: 2, textAlign: 'center' },
  tableFloor: { fontSize: 11, color: C.t3, marginBottom: 4 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  capText: { fontSize: 11, color: C.t3 },
  availBadge: {
    backgroundColor: C.primaryLt, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd, marginTop: 2,
  },
  availText: { fontSize: 11, fontWeight: '700', color: C.primary },
});
