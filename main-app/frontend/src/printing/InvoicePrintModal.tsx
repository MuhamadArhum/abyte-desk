import { useState, useEffect } from 'react';
import api from '../utils/api';
import { ReceiptModal } from './ReceiptView';
import { buildSaleReceipt } from './receiptBuilder';

interface InvoicePrintModalProps {
  invoiceId: number;
  onClose: () => void;
}

const InvoicePrintModal = ({ invoiceId, onClose }: InvoicePrintModalProps) => {
  const [loading, setLoading] = useState(true);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [invRes, sRes] = await Promise.all([
          api.get(`/invoices/${invoiceId}/print`),
          api.get('/settings'),
        ]);
        const { invoice, store } = invRes.data;
        // Map invoice format to sale-like format for buildSaleReceipt
        const salelike = {
          sale_id:        invoice.invoice_id,
          invoice_no:     invoice.invoice_number,
          sale_date:      invoice.created_at,
          customer_name:  invoice.customer_name,
          payment_method: invoice.payment_method || undefined,
          tax_amount:     invoice.tax_amount,
          tax_percent:    0,
          discount:       invoice.discount,
          additional_charges_amount: 0,
          total_amount:   invoice.total_amount,
          amount_paid:    invoice.amount_paid || invoice.total_amount,
          status:         invoice.status,
          items: (invoice.items || []).map((i: any) => ({
            product_name: i.description || i.product_name || 'Item',
            quantity:     i.quantity,
            unit_price:   i.unit_price,
          })),
        };
        const merged = { ...sRes.data, store_name: store?.store_name || sRes.data.store_name, address: store?.address || sRes.data.address, phone: store?.phone || sRes.data.phone };
        setReceiptData(buildSaleReceipt(salelike, merged));
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium">Close</button>
        </div>
      </div>
    );
  }

  return receiptData ? <ReceiptModal data={receiptData} onClose={onClose} /> : null;
};

export default InvoicePrintModal;
