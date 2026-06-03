import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useCartStore from '../../../store/cartStore';
import useAuthStore from '../../../store/authStore';
import { C, shadow } from '../../../constants/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

const ORDER_TYPES = [
  {
    value: 'dine_in',  label: 'Dine In',  icon: 'restaurant',
    color: C.primary, bg: C.primaryLt, border: C.primaryBd,
    desc: 'Select a free table',
  },
  {
    value: 'takeaway', label: 'Takeaway', icon: 'bag-handle',
    color: C.amber,   bg: C.amberBg,   border: C.amberBd,
    desc: 'Counter pickup',
  },
  {
    value: 'on_spot',  label: 'Walk-in',  icon: 'walk',
    color: C.blue,    bg: C.blueBg,    border: C.blueBd,
    desc: 'Immediate service',
  },
  {
    value: 'delivery', label: 'Delivery', icon: 'bicycle',
    color: C.purple,  bg: C.purpleBg,  border: C.purpleBd,
    desc: 'Home delivery',
  },
];

export default function HomeScreen() {
  const { clearCart, setTable } = useCartStore();
  const { user } = useAuthStore();

  const handleSelect = (type) => {
    clearCart();
    if (type.value === 'dine_in') {
      router.push(`/(main)/tables?orderType=dine_in`);
    } else {
      setTable(null, type.label, null);
      router.push(`/(main)/order/0?orderType=${type.value}&name=${encodeURIComponent(type.label)}`);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Welcome Banner */}
      <View style={styles.banner}>
        {/* Decorative rings */}
        <View style={styles.bannerRing1} pointerEvents="none" />
        <View style={styles.bannerRing2} pointerEvents="none" />

        <View style={styles.bannerLeft}>
          <Text style={styles.bannerGreeting}>{greeting}</Text>
          <Text style={styles.bannerName}>{user?.name?.split(' ')[0] || 'Waiter'}</Text>
          <View style={styles.bannerDateRow}>
            <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.5)" />
            <Text style={styles.bannerDate}>{dateStr}</Text>
          </View>
        </View>
        <View style={styles.bannerAvatarWrap}>
          <View style={styles.bannerAvatar}>
            <Text style={styles.bannerAvatarText}>
              {(user?.name || user?.username || 'W')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.bannerOnlineDot} />
        </View>
      </View>

      {/* Section heading */}
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>New Order</Text>
          <Text style={styles.sectionSub}>Choose how the customer will be served</Text>
        </View>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{ORDER_TYPES.length} types</Text>
        </View>
      </View>

      {/* Order Type Cards */}
      <View style={styles.grid}>
        {ORDER_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.card, { borderColor: type.border }]}
            onPress={() => handleSelect(type)}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIcon, { backgroundColor: type.color }]}>
              <Ionicons name={type.icon} size={30} color="#FFFFFF" />
            </View>
            <Text style={[styles.cardLabel, { color: type.color }]}>{type.label}</Text>
            <Text style={styles.cardDesc}>{type.desc}</Text>
            <View style={[styles.cardChip, { backgroundColor: type.bg }]}>
              <Text style={[styles.cardChipText, { color: type.color }]}>Tap to select</Text>
              <Ionicons name="arrow-forward" size={11} color={type.color} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 32 },

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.primaryHd, overflow: 'hidden',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 26,
  },
  bannerRing1: {
    position: 'absolute', right: -30, top: -30,
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bannerRing2: {
    position: 'absolute', right: 40, bottom: -50,
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bannerLeft: { flex: 1 },
  bannerGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginBottom: 3 },
  bannerName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.6 },
  bannerDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  bannerDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2 },
  bannerAvatarWrap: { position: 'relative' },
  bannerAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  bannerAvatarText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  bannerOnlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2, borderColor: C.primaryHd,
  },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: C.t1, letterSpacing: -0.4 },
  sectionSub: { fontSize: 13, color: C.t2, marginTop: 3 },
  sectionBadge: {
    backgroundColor: C.primaryLt, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 14,
  },
  card: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: 20, borderWidth: 1.5,
    padding: 18, alignItems: 'center',
    ...shadow.md,
  },
  cardIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  cardLabel: { fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  cardDesc: { fontSize: 11.5, color: C.t3, textAlign: 'center', marginBottom: 12, lineHeight: 16 },
  cardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  cardChipText: { fontSize: 11, fontWeight: '700' },
});
