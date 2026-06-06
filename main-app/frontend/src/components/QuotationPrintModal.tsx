import { useState, useEffect } from 'react';
import { X, Printer, Zap } from 'lucide-react';
import api from '../utils/api';
import { printReport } from '../utils/reportPrinter';

interface QuotationPrintModalProps {
  quotationId: number;
  onClose: () => void;
}

interface PrintItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sku?: string;
}

interface PrintQuotation {
  quotation_id: number;
  quotation_number: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  status: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  created_by_name: string;
  items: PrintItem[];
}

interface StoreInfo {
  store_name: string;
  address?: string;
  phone?: string;
  email?: string;
}

const QuotationPrintModal = ({ quotationId, onClose }: QuotationPrintModalProps) => {
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<PrintQuotation | null>(null);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [error, setError] = useState('');
  const [thermalAvailable, setThermalAvailable] = useState(false);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [thermalMsg, setThermalMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [qtRes, storeRes] = await Promise.all([
          api.get(`/quotations/${quotationId}`),
          api.get('/settings'),
        ]);
        setQuotation(qtRes.data);
        setStore({
          store_name: storeRes.data.store_name || 'AByte ERP',
          address: storeRes.data.address,
          phone: storeRes.data.phone,
          email: storeRes.data.email,
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load quotation data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quotationId]);

  useEffect(() => {
    api.get('/settings/printers/check?purpose=quotation')
      .then(r => setThermalAvailable(r.data.available))
      .catch(() => setThermalAvailable(false));
  }, []);

  const handlePrint = () => {
    if (!quotation || !store) return;

    const itemsRows = quotation.items.map((item, idx) =>
      `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 8px;font-size:13px;color:#666;">${idx + 1}</td>
        <td style="padding:10px 8px;font-size:13px;color:#1f2937;">${item.product_name}</td>
        <td style="padding:10px 8px;font-size:13px;color:#1f2937;text-align:right;">${item.quantity}</td>
        <td style="padding:10px 8px;font-size:13px;color:#1f2937;text-align:right;">Rs. ${Number(item.unit_price).toFixed(0)}</td>
        <td style="padding:10px 8px;font-size:13px;color:#1f2937;text-align:right;font-weight:500;">Rs. ${Number(item.total_price).toFixed(0)}</td>
      </tr>`
    ).join('');

    const content = `
      <div style="max-width:700px;margin:0 auto;">
        <!-- Store Header -->
        <div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #1f2937;">
          <h1 style="font-size:26px;font-weight:bold;color:#1f2937;margin:0;">${store.store_name}</h1>
          ${store.address ? `<p style="font-size:13px;color:#666;margin:4px 0 0;">${store.address}</p>` : ''}
          <div style="font-size:13px;color:#666;margin-top:4px;">
            ${store.phone ? `Tel: ${store.phone}` : ''}${store.phone && store.email ? ' &nbsp;|&nbsp; ' : ''}${store.email ? `Email: ${store.email}` : ''}
          </div>
        </div>

        <!-- Quotation Title -->
        <div style="text-align:center;margin-bottom:30px;">
          <h2 style="font-size:22px;font-weight:bold;color:#1f2937;letter-spacing:2px;text-transform:uppercase;margin:0;">Quotation</h2>
        </div>

        <!-- Customer & Quotation Details -->
        <table style="width:100%;margin-bottom:30px;"><tr>
          <td style="vertical-align:top;width:50%;">
            <p style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;margin:0 0 8px;">Quotation For</p>
            <p style="font-size:16px;font-weight:600;color:#1f2937;margin:0;">${quotation.customer_name}</p>
            ${quotation.customer_phone ? `<p style="font-size:13px;color:#666;margin:2px 0 0;">Tel: ${quotation.customer_phone}</p>` : ''}
          </td>
          <td style="vertical-align:top;width:50%;text-align:right;">
            <p style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;margin:0 0 8px;">Quotation Details</p>
            <p style="font-size:16px;font-weight:600;color:#1f2937;margin:0;">${quotation.quotation_number}</p>
            <p style="font-size:13px;color:#666;margin:2px 0 0;">Date: ${new Date(quotation.created_at).toLocaleDateString()}</p>
            ${quotation.valid_until ? `<p style="font-size:13px;color:#666;margin:2px 0 0;">Valid Until: ${new Date(quotation.valid_until).toLocaleDateString()}</p>` : ''}
            <p style="font-size:13px;color:#666;margin:2px 0 0;">Prepared by: ${quotation.created_by_name}</p>
          </td>
        </tr></table>

        <!-- Items Table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <thead>
            <tr style="border-bottom:2px solid #1f2937;">
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#374151;width:40px;">#</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#374151;">Item</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600;color:#374151;width:60px;">Qty</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600;color:#374151;width:120px;">Unit Price</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600;color:#374151;width:120px;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:30px;">
          <div style="width:280px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">
              <span style="color:#666;">Subtotal</span>
              <span style="color:#1f2937;font-weight:500;">Rs. ${Number(quotation.subtotal).toFixed(0)}</span>
            </div>
            ${Number(quotation.tax_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">
              <span style="color:#666;">Tax</span>
              <span style="color:#1f2937;font-weight:500;">Rs. ${Number(quotation.tax_amount).toFixed(0)}</span>
            </div>` : ''}
            ${Number(quotation.discount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">
              <span style="color:#666;">Discount</span>
              <span style="color:#dc2626;font-weight:500;">-Rs. ${Number(quotation.discount).toFixed(0)}</span>
            </div>` : ''}
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #1f2937;margin-top:8px;">
              <span style="font-size:16px;font-weight:bold;color:#1f2937;">Grand Total</span>
              <span style="font-size:16px;font-weight:bold;color:#1f2937;">Rs. ${Number(quotation.total_amount).toFixed(0)}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        ${quotation.notes ? `<div style="border-top:1px solid #e5e7eb;padding-top:20px;">
          <h4 style="font-size:13px;font-weight:600;color:#374151;margin:0 0 4px;">Notes / Terms</h4>
          <p style="font-size:13px;color:#666;margin:0;">${quotation.notes}</p>
        </div>` : ''}

        <!-- Footer -->
        <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
          <p style="font-size:13px;color:#6b7280;margin:0;">This is a quotation and not an invoice. Prices are subject to change.</p>
          <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Thank you for your interest!</p>
        </div>
      </div>
    `;

    printReport({
      title: `Quotation ${quotation.quotation_number}`,
      storeName: store.store_name,
      content
    });
  };

  const handleThermalPrint = async () => {
    if (!quotation || !store) return;
    setThermalPrinting(true);
    setThermalMsg('');
    try {
      await api.post('/settings/print-thermal-document', {
        purpose: 'quotation',
        documentData: {
          storeName: store.store_name,
          storeAddress: store.address,
          storePhone: store.phone,
          number: quotation.quotation_number,
          date: new Date(quotation.created_at).toLocaleDateString(),
          customerName: quotation.customer_name,
          items: quotation.items.map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
          subtotal: quotation.subtotal,
          tax_amount: quotation.tax_amount,
          discount: quotation.discount,
          total_amount: quotation.total_amount,
        }
      });
      setThermalMsg('Sent to thermal printer!');
    } catch (err: any) {
      setThermalMsg(err.response?.data?.message || 'Thermal print failed');
    } finally {
      setThermalPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-800">Print Quotation</h2>
          <div className="flex items-center gap-2">
            {thermalAvailable && (
              <div className="flex items-center gap-2">
                <button onClick={handleThermalPrint} disabled={loading || !!error || thermalPrinting}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:bg-gray-400 text-sm font-semibold">
                  <Zap size={16} />
                  {thermalPrinting ? 'Printing...' : 'Direct Print (Thermal)'}
                </button>
                {thermalMsg && <span className={`text-xs font-medium ${thermalMsg.includes('failed') ? 'text-red-500' : 'text-emerald-600'}`}>{thermalMsg}</span>}
              </div>
            )}
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:bg-gray-400 text-sm"
            >
              <Printer size={16} />
              Print A4
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Print Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500">{error}</div>
          ) : quotation && store ? (
            <div className="max-w-3xl mx-auto">
              {/* Store Header */}
              <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
                <h1 className="text-3xl font-bold text-gray-900">{store.store_name}</h1>
                {store.address && <p className="text-sm text-gray-600 mt-1">{store.address}</p>}
                <div className="flex items-center justify-center gap-4 mt-1 text-sm text-gray-600">
                  {store.phone && <span>Tel: {store.phone}</span>}
                  {store.email && <span>Email: {store.email}</span>}
                </div>
              </div>

              {/* Quotation Title */}
              <div className="text-center mb-8">
                <h2 className="text-base font-semibold text-gray-800 tracking-wider uppercase">Quotation</h2>
              </div>

              {/* Quotation Details & Customer Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Quotation For</h3>
                  <p className="text-lg font-semibold text-gray-800">{quotation.customer_name}</p>
                  {quotation.customer_phone && <p className="text-sm text-gray-600">Tel: {quotation.customer_phone}</p>}
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Quotation Details</h3>
                  <p className="text-lg font-semibold text-gray-800">{quotation.quotation_number}</p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(quotation.created_at).toLocaleDateString()}
                  </p>
                  {quotation.valid_until && (
                    <p className="text-sm text-gray-600">
                      Valid Until: {new Date(quotation.valid_until).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Prepared by: {quotation.created_by_name}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="py-3 text-left text-sm font-semibold text-gray-700 w-12">#</th>
                    <th className="py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                    <th className="py-3 text-right text-sm font-semibold text-gray-700 w-20">Qty</th>
                    <th className="py-3 text-right text-sm font-semibold text-gray-700 w-32">Unit Price</th>
                    <th className="py-3 text-right text-sm font-semibold text-gray-700 w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-3 text-sm text-gray-600">{idx + 1}</td>
                      <td className="py-3 text-sm text-gray-800">{item.product_name}</td>
                      <td className="py-3 text-sm text-gray-800 text-right">{item.quantity}</td>
                      <td className="py-3 text-sm text-gray-800 text-right">
                        Rs. {Number(item.unit_price).toFixed(0)}
                      </td>
                      <td className="py-3 text-sm text-gray-800 text-right font-medium">
                        Rs. {Number(item.total_price).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-800 font-medium">Rs. {Number(quotation.subtotal).toFixed(0)}</span>
                  </div>
                  {Number(quotation.tax_amount) > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="text-gray-800 font-medium">Rs. {Number(quotation.tax_amount).toFixed(0)}</span>
                    </div>
                  )}
                  {Number(quotation.discount) > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="text-red-600 font-medium">-Rs. {Number(quotation.discount).toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-t-2 border-gray-800 mt-2">
                    <span className="text-lg font-bold text-gray-800">Grand Total</span>
                    <span className="text-lg font-bold text-gray-800">Rs. {Number(quotation.total_amount).toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {quotation.notes && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-semibold text-gray-700">Notes / Terms</h4>
                  <p className="text-sm text-gray-600 mt-1">{quotation.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center mt-10 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">This is a quotation and not an invoice. Prices are subject to change.</p>
                <p className="text-sm text-gray-500 mt-1">Thank you for your interest!</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
};

export default QuotationPrintModal;
