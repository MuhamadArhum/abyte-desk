import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@waiter_offline_queue';

const useOfflineQueue = create((set, get) => ({
  queue: [],
  syncing: false,

  loadQueue: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ queue: JSON.parse(raw) });
    } catch {
      // ignore
    }
  },

  addToQueue: async (orderData) => {
    const entry = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...orderData,
    };
    const queue = [...get().queue, entry];
    set({ queue });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // ignore
    }
    return entry.id;
  },

  removeFromQueue: async (id) => {
    const queue = get().queue.filter((o) => o.id !== id);
    set({ queue });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // ignore
    }
  },

  syncQueue: async (apiInstance) => {
    const { queue, syncing, removeFromQueue } = get();
    if (syncing || queue.length === 0) return;

    set({ syncing: true });

    for (const order of queue) {
      try {
        await apiInstance.post('/sales', order.payload);
        await removeFromQueue(order.id);
      } catch (err) {
        // still offline or server error — stop trying
        if (!err.response) break;
        // if server returned error (bad data), remove it so it doesn't block forever
        await removeFromQueue(order.id);
      }
    }

    set({ syncing: false });
  },

  get pendingCount() {
    return get().queue.length;
  },
}));

export default useOfflineQueue;
