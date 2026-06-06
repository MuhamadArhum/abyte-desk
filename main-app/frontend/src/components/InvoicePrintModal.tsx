import { useState, useEffect } from 'react';
import { X, Printer, Zap } from 'lucide-react';
import api from '../utils/api';
import { printReport } from '../utils/reportPrinter';
import { buildInvoiceHTML, type PrintInvoice, type StoreInfo } from '../templates/invoiceTemplate';

interface InvoicePrintModalProps {
  invoiceId: number;
  onClose: () => void;
}

const InvoicePrintModal = ({ invoiceId, onClose }: InvoicePrintModalProps) => {
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<PrintInvoice | null>(null);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [error, setError] = useState('');
  const [thermalAvailable, setThermalAvailable] = useState(false);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [thermalMsg, setThermalMsg] = useState('');

  useEffect(() => {
    const fetchPrintData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/invoices/${invoiceId}/print`);
        setInvoice(res.data.invoice);
        setStore(res.data.store);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load invoice data');
      } finally {
        setLoading(false);
      }
    };
    fetchPrintData();
  }, [invoiceId]);

  useEffect(() => {
    api.get('/settings/printers/check?purpose=invoice')
      .then(r => setThermalAvailable(r.data.available))
      .catch(() => setThermalAvailable(false));
  }, []);

  const handlePrint = () => {
    if (!invoice || !store) return;
    printReport({
      title: `Invoice ${invoice.invoice_number}`,
      storeName: store.store_name,
      content: buildInvoiceHTML(invoice, store),
    });
  };

  const handleThermalPrint = async () => {
    if (!invoice || !store) return;
    setThermalPrinting(true);
    setThermalMsg('');
    try {
      await api.post('/settings/print-thermal-document', {
        purpose: 'invoice',
        documentData: {
          storeName: store.store_name,
          storeAddress: store.address,
          storePhone: store.phone,
          number: invoice.invoice_number,
          date: new Date(invoice.created_at).toLocaleDateString(),
          customerName: invoice.customer_name,
          items: invoice.items.map(i => ({ name: i.description || i.product_name || 'Item', quantity: i.quantity, unit_price: i.unit_price })),
          subtotal: invoice.subtotal,
          tax_amount: invoice.tax_amount,
          discount: invoice.discount,
          total_amount: invoice.total_amount,
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
          <h2 className="text-sm font-semibold text-gray-800">Print Invoice</h2>
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
            <button onClick={handlePrint} disabled={loading || !!error}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:bg-gray-400 text-sm">
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
          ) : invoice && store ? (
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

              {/* Invoice Title */}
              <div className="text-center mb-8">
                <h2 className="text-base font-semibold text-gray-800 tracking-wider uppercase">Invoice</h2>
              </div>

              {/* Invoice Details & Customer Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
                  <p className="text-lg font-semibold text-gray-800">{invoice.customer_name}</p>
                  {invoice.customer_phone && <p className="text-sm text-gray-600">{invoice.customer_phone}</p>}
                  {invoice.customer_email && <p className="text-sm text-gray-600">{invoice.customer_email}</p>}
                  {invoice.customer_address && <b><p className="text-sm text-gray-600">{invoice.customer_address}</p></b>}
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Invoice Details</h3>
                  <p className="text-lg font-semibold text-gray-800">{invoice.invoice_number}</p>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(invoice.created_at).toLocaleDateString()}
                  </p>
                  {invoice.due_date && (
                    <p className="text-sm text-gray-600">
                      Due: {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-sm mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                      invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          invoice.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-gray-100 text-gray-700'
                      }`}>
                      {invoice.status}
                    </span>
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="py-3 text-left text-sm font-semibold text-gray-700 w-12">#</th>
                    <th className="py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="py-3 text-right text-sm font-semibold text-gray-700 w-20">Qty</th>
                    <th className="py-3 text-right text-sm font-semibold text-gray-700 w-32">Unit Price</th>
                    <th className="py-3 text-right text-sm font-semibold text-gray-700 w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-3 text-sm text-gray-600">{idx + 1}</td>
                      <td className="py-3 text-sm text-gray-800">
                        {item.description || item.product_name || 'Item'}
                      </td>
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
                    <span className="text-gray-800 font-medium">Rs. {Number(invoice.subtotal).toFixed(0)}</span>
                  </div>
                  {Number(invoice.tax_amount) > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="text-gray-800 font-medium">Rs. {Number(invoice.tax_amount).toFixed(0)}</span>
                    </div>
                  )}
                  {Number(invoice.discount) > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="text-red-600 font-medium">-Rs. {Number(invoice.discount).toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-t-2 border-gray-800 mt-2">
                    <span className="text-lg font-bold text-gray-800">Grand Total</span>
                    <span className="text-lg font-bold text-gray-800">Rs. {Number(invoice.total_amount).toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Terms & Notes */}
              {(invoice.payment_terms || invoice.notes) && (
                <div className="border-t border-gray-200 pt-6 space-y-3">
                  {invoice.payment_terms && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Payment Terms</h4>
                      <p className="text-sm text-gray-600">{invoice.payment_terms}</p>
                    </div>
                  )}
                  {invoice.notes && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Notes</h4>
                      <p className="text-sm text-gray-600">{invoice.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="text-center mt-10 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">Thank you for your business!</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
};

export default InvoicePrintModal;
