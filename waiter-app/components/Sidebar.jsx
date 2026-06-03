import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useAuthStore from '../store/authStore';

export default function Sidebar({ visible, onClose }) {
  const { user, logout } = useAuthStore();

  if (!visible) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/login');
  };

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={[styles.sidebar, { paddingTop: statusBarHeight }]}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.username || 'W').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Waiter'}</Text>
          <Text style={styles.profileUsername}>@{user?.username || ''}</Text>
        </View>

        {/* Info Rows */}
        <View style={styles.infoSection}>
          <InfoRow icon="person-circle-outline" label="Full Name" value={user?.name} />
          <InfoRow icon="at-circle-outline" label="Username" value={user?.username} />
          <InfoRow icon="business-outline" label="Branch" value={user?.branch_name || 'Main Branch'} />
          <InfoRow icon="shield-checkmark-outline" label="Role" value={user?.role_name || 'Waiter'} />
        </View>

        {/* Version */}
        <Text style={styles.version}>AByte Waiter v1.0</Text>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#93C5FD" />
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sidebar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 290,
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  profileHeader: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 34, color: '#FFFFFF', fontWeight: 'bold' },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  profileUsername: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  infoSection: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoTexts: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 15,
    color: '#E2E8F0',
    fontWeight: '500',
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#475569',
    marginTop: 'auto',
    marginBottom: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  logoutText: { fontSize: 15, color: '#EF4444', fontWeight: '700' },
});
