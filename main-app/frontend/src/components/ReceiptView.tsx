import { useState } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { printInvoice, printKOT, rasterizeLogoForEscPos } from '../utils/agentPrinter';

// ── Types ──────────────────────────────────────────────────────

export type DocType = 'sale' | 'quotation' | 'credit_sale' | 'return' | 'delivery' | 'kot';

export interface ReceiptItem {
  name: string;
  quantity: number | string;
  price?: number;
  note?: string;
  category?: string;
}

export interface ReceiptData {
  docType: DocType;
  docNumber?: string;
  tokenNo?: string;
  date?: string;

  // Store
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  logoUrl?: string;
  currencySymbol?: string;
  footer?: string;

  // People
  cashierName?: string;
  customerName?: string;
  tableNo?: string;
  orderType?: string;
  riderName?: string;

  // Items
  items: ReceiptItem[];

  // Amounts
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  taxPercent?: number;
  chargesAmount?: number;
  totalAmount: number;

  // Payment
  amountPaid?: number;
  changeDue?: number;
  paymentMethod?: string;

  // Credit sale
  balanceDue?: number;
  dueDate?: string;
  status?: string;

  // Return
  refundAmount?: number;
  refundMethod?: string;
  reason?: string;

  // Paper width for ESC/POS
  paperWidth?: 58 | 80;
}

// ── Label maps ────────────────────────────────────────────────

const DOC_LABELS: Record<DocType, string> = {
  sale:        'SALES RECEIPT',
  quotation:   'QUOTATION',
  credit_sale: 'CREDIT SALE',
  return:      'RETURN RECEIPT',
  delivery:    'DELIVERY ORDER',
  kot:         'KITCHEN ORDER',
};

const DOC_COLORS: Record<DocType, string> = {
  sale:        'bg-emerald-100 text-emerald-700',
  quotation:   'bg-blue-100 text-blue-700',
  credit_sale: 'bg-amber-100 text-amber-700',
  return:      'bg-red-100 text-red-700',
  delivery:    'bg-purple-100 text-purple-700',
  kot:         'bg-orange-100 text-orange-700',
};

// ── Helper ────────────────────────────────────────────────────

function fmt(n?: number, cs = 'Rs.') {
  if (n == null) return '';
  return `${cs} ${Number(n).toFixed(2)}`;
}

function Row({ label, value, bold, cs }: { label: string; value?: number; bold?: boolean; cs?: string }) {
  if (value == null || value === 0) return null;
  return (
    <div className={`flex justify-between text-sm py-0.5 ${bold ? 'font-bold' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={bold ? 'text-gray-900' : 'text-gray-800'}>{fmt(value, cs)}</span>
    </div>
  );
}

// ── ReceiptView ───────────────────────────────────────────────

export function ReceiptView({ data }: { data: ReceiptData }) {
  const cs = data.currencySymbol || 'Rs.';
  const isKOT = data.docType === 'kot';

  return (
    <div className="bg-white font-mono text-sm select-text" style={{ minWidth: 280, maxWidth: 380 }}>

      {/* Logo */}
      {data.logoUrl && (
        <div className="flex justify-center mb-3">
          <img src={data.logoUrl} alt="Logo" className="max-h-20 max-w-[160px] object-contain" />
        </div>
      )}

      {/* Store Header */}
      <div className="text-center mb-3">
        <p className="text-base font-extrabold text-gray-900 tracking-wide">
          {data.storeName.toUpperCase()}
        </p>
        {data.storeAddress && <p className="text-xs text-gray-500 mt-0.5">{data.storeAddress}</p>}
        {data.storePhone   && <p className="text-xs text-gray-500">Tel: {data.storePhone}</p>}
      </div>

      <Divider />

      {/* Doc type badge */}
      <div className="flex justify-center my-2">
        <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-widest ${DOC_COLORS[data.docType]}`}>
          {DOC_LABELS[data.docType]}
        </span>
      </div>

      {/* Meta info */}
      <div className="space-y-0.5 text-xs text-gray-600 mb-2">
        {data.docNumber   && <MetaRow label={data.docType === 'quotation' ? 'Quote #' : data.docType === 'return' ? 'Return #' : 'Invoice'} value={data.docNumber} />}
        {data.tokenNo     && <MetaRow label="Token"    value={data.tokenNo} bold />}
        {data.date        && <MetaRow label="Date"     value={data.date} />}
        {data.cashierName && <MetaRow label="Cashier"  value={data.cashierName} />}
        {data.customerName && <MetaRow label="Customer" value={data.customerName} />}
        {data.tableNo     && <MetaRow label="Table"    value={data.tableNo} />}
        {data.orderType   && <MetaRow label="Type"     value={data.orderType} />}
        {data.riderName   && <MetaRow label="Rider"    value={data.riderName} />}
        {/* credit sale */}
        {data.dueDate     && <MetaRow label="Due Date" value={data.dueDate} />}
        {data.status      && <MetaRow label="Status"   value={data.status.toUpperCase()} />}
        {/* return */}
        {data.reason      && <MetaRow label="Reason"   value={data.reason} />}
      </div>

      <Divider />

      {/* Items */}
      {!isKOT ? (
        <div className="my-2 space-y-1">
          {/* Column header */}
          <div className="flex text-xs font-bold text-gray-500 pb-1 border-b border-dashed border-gray-300">
            <span className="flex-1">Item</span>
            <span className="w-8 text-center">Qty</span>
            <span className="w-20 text-right">Price</span>
          </div>
          {data.items.map((item, i) => (
            <div key={i}>
              <div className="flex items-start text-xs">
                <span className="flex-1 text-gray-800 leading-tight">{item.name}</span>
                <span className="w-8 text-center text-gray-700">{item.quantity}</span>
                <span className="w-20 text-right text-gray-800">
                  {item.price != null ? fmt(item.price, cs) : '—'}
                </span>
              </div>
              {item.note && (
                <p className="text-xs text-gray-400 pl-2 leading-tight">* {item.note}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* KOT items — grouped by category */
        <KOTItems items={data.items} />
      )}

      <Divider />

      {/* Totals (not for KOT) */}
      {!isKOT && (
        <div className="my-2 space-y-0.5">
          {data.subtotal != null && <Row label="Subtotal"          value={data.subtotal}      cs={cs} />}
          {data.discount   ? <Row label="Discount"           value={-data.discount}     cs={cs} /> : null}
          {data.taxAmount  ? <Row label={`Tax (${data.taxPercent ?? 0}%)`} value={data.taxAmount} cs={cs} /> : null}
          {data.chargesAmount ? <Row label="Charges"          value={data.chargesAmount} cs={cs} /> : null}

          <div className="border-t-2 border-gray-800 mt-1 pt-1">
            <div className="flex justify-between font-extrabold text-base">
              <span>TOTAL</span>
              <span>{fmt(data.totalAmount, cs)}</span>
            </div>
          </div>

          {/* Payment */}
          {data.paymentMethod && (
            <div className="mt-1 space-y-0.5 border-t border-dashed border-gray-300 pt-1">
              <Row label={`Paid (${(data.paymentMethod).toUpperCase()})`} value={data.amountPaid} cs={cs} />
              {(data.changeDue ?? 0) > 0 && <Row label="Change Due" value={data.changeDue} cs={cs} />}
            </div>
          )}

          {/* Credit sale balance */}
          {data.balanceDue != null && (
            <div className="mt-1 border-t border-dashed border-gray-300 pt-1">
              <div className="flex justify-between text-sm font-bold text-red-600">
                <span>Balance Due</span>
                <span>{fmt(data.balanceDue, cs)}</span>
              </div>
            </div>
          )}

          {/* Return refund */}
          {data.refundAmount != null && (
            <div className="mt-1 border-t border-dashed border-gray-300 pt-1">
              <div className="flex justify-between text-sm font-bold text-emerald-600">
                <span>Refund ({data.refundMethod || 'Cash'})</span>
                <span>{fmt(data.refundAmount, cs)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {data.footer && (
        <>
          <Divider />
          <p className="text-center text-xs text-gray-500 mt-2 leading-relaxed">{data.footer}</p>
        </>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-dashed border-gray-300 my-1" />;
}

function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span className={`text-gray-700 ${bold ? 'font-bold text-base' : ''}`}>{value}</span>
    </div>
  );
}

function KOTItems({ items }: { items: ReceiptItem[] }) {
  const groups: Record<string, ReceiptItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return (
    <div className="my-2 space-y-2">
      {Object.entries(groups).map(([cat, catItems]) => (
        <div key={cat}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{cat}</p>
          {catItems.map((item, i) => (
            <div key={i} className="flex items-start text-sm">
              <span className="w-8 font-bold text-gray-900">{item.quantity}x</span>
              <div className="flex-1">
                <span className="text-gray-800">{item.name}</span>
                {item.note && <p className="text-xs text-gray-400">* {item.note}</p>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── ReceiptModal (wrapper with Print / Close) ─────────────────

interface ReceiptModalProps {
  data: ReceiptData;
  onClose: () => void;
}

export function ReceiptModal({ data, onClose }: ReceiptModalProps) {
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg]           = useState('');

  const handlePrint = async () => {
    setPrinting(true);
    setMsg('');
    try {
      const paperWidth = data.paperWidth ?? 80;

      if (data.docType === 'kot') {
        const result = await printKOT({
          tokenNo:     data.tokenNo,
          tableNo:     data.tableNo,
          date:        data.date,
          cashierName: data.cashierName,
          items: data.items.map(i => ({
            name:          i.name,
            quantity:      i.quantity,
            category_name: i.category,
            note:          i.note,
          })),
        });
        setMsg(result.success ? '✓ Sent to printer' : `✗ ${result.error}`);
      } else {
        const logoEscPosData = data.logoUrl
          ? await rasterizeLogoForEscPos(data.logoUrl, paperWidth).catch(() => null) ?? undefined
          : undefined;

        const result = await printInvoice({
          storeName:      data.storeName,
          storeAddress:   data.storeAddress,
          storePhone:     data.storePhone,
          logoEscPosData,
          saleId:         data.docNumber,
          invoiceNo:      data.docNumber,
          tokenNo:        data.tokenNo,
          tableNo:        data.tableNo,
          date:           data.date,
          cashierName:    data.cashierName,
          customerName:   data.customerName,
          currencySymbol: data.currencySymbol,
          items:          data.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price ?? 0, note: i.note })),
          subtotal:       data.subtotal,
          discount:       data.discount,
          taxAmount:      data.taxAmount,
          taxPercent:     data.taxPercent,
          chargesAmount:  data.chargesAmount,
          totalAmount:    data.totalAmount,
          amountPaid:     data.amountPaid,
          changeDue:      data.changeDue,
          paymentMethod:  data.paymentMethod,
          footer:         data.footer,
        });
        setMsg(result.success ? '✓ Sent to printer' : `✗ ${result.error}`);
      }
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col"
           style={{ width: '100%', maxWidth: 420, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">
            {DOC_LABELS[data.docType]}
          </span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Receipt scroll area */}
        <div className="flex-1 overflow-y-auto p-5">
          <ReceiptView data={data} />
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {msg && (
            <p className={`text-xs text-center font-medium ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
              {msg}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Close
            </button>
            <button onClick={handlePrint} disabled={printing}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-60 transition">
              {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              {printing ? 'Printing…' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
