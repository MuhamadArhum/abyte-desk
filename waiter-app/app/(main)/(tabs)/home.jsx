import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useCartStore from '../../../store/cartStore';
import useAuthStore from '../../../store/authStore';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

const ORDER_TYPES = [
  { value: 'dine_in',  label: 'Dine In',  icon: 'restaurant',   color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', desc: 'Select a free table' },
  { value: 'takeaway', label: 'Takeaway', icon: 'bag-handle',   color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', desc: 'Counter pickup' },
  { value: 'on_spot',  label: 'Walk-in',  icon: 'walk',         color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD', desc: 'Immediate service' },
  { value: 'delivery', label: 'Delivery', icon: 'bicycle',      color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD', desc: 'Home delivery' },
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

  return (
    <View style={styles.container}>
      {/* Welcome bar */}
      <View style={styles.welcomeBar}>
        <View style={styles.welcomeAvatar}>
          <Text style={styles.avatarText}>
            {(user?.name || user?.username || 'W')[0].toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.greetingText}>{greeting}, {user?.name?.split(' ')[0] || 'Waiter'}</Text>
          <Text style={styles.greetingDate}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
      </View>

      {/* Heading */}
      <View style={styles.headingWrap}>
        <Text style={styles.heading}>New Order</Text>
        <Text style={styles.headingSub}>Select how the customer will be served</Text>
      </View>

      {/* Order type grid */}
      <View style={styles.grid}>
        {ORDER_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.card, { backgroundColor: type.bg, borderColor: type.border }]}
            onPress={() => handleSelect(type)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, { backgroundColor: type.color }]}>
              <Ionicons name={type.icon} size={32} color="#FFFFFF" />
            </View>
            <Text style={[styles.cardLabel, { color: type.color }]}>{type.label}</Text>
            <Text style={styles.cardDesc}>{type.desc}</Text>
            <View style={[styles.cardArrow, { backgroundColor: type.color + '18' }]}>
              <Ionicons name="arrow-forward" size={13} color={type.color} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  welcomeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  welcomeAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#ECFDF5', borderWidth: 2, borderColor: '#6EE7B7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#059669' },
  greetingText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  greetingDate: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  headingWrap: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#111827', letterSpacing: -0.3 },
  headingSub: { fontSize: 13, color: '#6B7280', marginTop: 3 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 14,
  },
  card: {
    width: CARD_W,
    borderRadius: 18, borderWidth: 1.5,
    padding: 18, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  iconCircle: {
    width: 66, height: 66, borderRadius: 33,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  cardLabel: { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  cardDesc: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 10 },
  cardArrow: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
});
