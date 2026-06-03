import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../../../store/authStore';
import Sidebar from '../../../components/Sidebar';

export default function TabsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token]);

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: '#059669' }}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarH }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuBtn} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="restaurant" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.headerTitle}>AByte Waiter</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#059669',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 4,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'New Order',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="running"
          options={{
            title: 'Running',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
  },
  headerTitle: {
    fontSize: 17, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: -0.2,
  },
  tabIconWrap: {
    width: 32, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  tabIconActive: {},
});
