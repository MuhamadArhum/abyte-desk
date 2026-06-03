import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useCartStore from '../../../store/cartStore';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

const ORDER_TYPES = [
  {
    value: 'dine_in',
    label: 'Dine In',
    icon: 'restaurant',
    color: '#1E40AF',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    desc: 'Select a free table',
  },
  {
    value: 'takeaway',
    label: 'Takeaway',
    icon: 'bag-handle',
    color: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
    desc: 'Counter pickup',
  },
  {
    value: 'on_spot',
    label: 'Walk-in',
    icon: 'walk',
    color: '#15803D',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    desc: 'Immediate order',
  },
  {
    value: 'delivery',
    label: 'Delivery',
    icon: 'bicycle',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    desc: 'Home delivery',
  },
];

export default function HomeScreen() {
  const { clearCart, setTable } = useCartStore();

  const handleSelect = (type) => {
    clearCart();
    if (type.value === 'dine_in') {
      router.push(`/(main)/tables?orderType=dine_in`);
    } else {
      setTable(null, type.label, null);
      router.push(
        `/(main)/order/0?orderType=${type.value}&name=${encodeURIComponent(type.label)}`
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>New Order</Text>
        <Text style={styles.sub}>Select how the customer will be served</Text>

        <View style={styles.grid}>
          {ORDER_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[styles.card, { backgroundColor: type.bg, borderColor: type.border }]}
              onPress={() => handleSelect(type)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconCircle, { backgroundColor: type.color }]}>
                <Ionicons name={type.icon} size={34} color="#FFFFFF" />
              </View>
              <Text style={[styles.cardLabel, { color: type.color }]}>{type.label}</Text>
              <Text style={styles.cardDesc}>{type.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  scroll: { padding: 16, paddingBottom: 32 },
  heading: {
    fontSize: 26, fontWeight: 'bold', color: '#1E293B', marginTop: 8,
  },
  sub: { fontSize: 14, color: '#94A3B8', marginTop: 4, marginBottom: 24 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between',
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 17, fontWeight: 'bold', marginBottom: 6, textAlign: 'center',
  },
  cardDesc: {
    fontSize: 12, color: '#94A3B8', textAlign: 'center',
  },
});
