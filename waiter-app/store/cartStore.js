import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  items: [],
  tableId: null,
  tableName: '',
  existingSaleId: null,

  setTable: (tableId, tableName, existingSaleId = null) =>
    set({ tableId, tableName, existingSaleId, items: [] }),

  // Pre-load items (used in edit mode)
  setItems: (newItems) => set({ items: newItems }),

  addItem: (product) => {
    const items = get().items;
    const existing = items.find((i) => i.product_id === product.product_id);
    if (existing) {
      set({
        items: items.map((i) =>
          i.product_id === product.product_id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({
        items: [
          ...items,
          {
            product_id: product.product_id,
            product_name: product.product_name,
            unit_price: parseFloat(product.selling_price || product.price || 0),
            quantity: 1,
            variant_id: product.variant_id || null,
          },
        ],
      });
    }
  },

  incrementItem: (product_id) =>
    set({
      items: get().items.map((i) =>
        i.product_id === product_id ? { ...i, quantity: i.quantity + 1 } : i
      ),
    }),

  decrementItem: (product_id) => {
    const items = get().items;
    const item = items.find((i) => i.product_id === product_id);
    if (!item) return;
    if (item.quantity <= 1) {
      set({ items: items.filter((i) => i.product_id !== product_id) });
    } else {
      set({
        items: items.map((i) =>
          i.product_id === product_id ? { ...i, quantity: i.quantity - 1 } : i
        ),
      });
    }
  },

  clearCart: () => set({ items: [], tableId: null, tableName: '', existingSaleId: null }),
}));

export default useCartStore;
