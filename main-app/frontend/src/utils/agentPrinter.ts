// AByte Printer Agent bridge
// Jobs go via the print queue — cashier browser picks them up and forwards to localhost:3001

import api from './api';

export interface AgentHealth {
  status: string;
  version: string;
  printers: number;
  invoice: number;
  kot: number;
}

export interface InvoiceData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  saleId?: number | string;
  invoiceNo?: string;
  tokenNo?: string;
  tableNo?: string;
  date?: string;
  cashierName?: string;
  customerName?: string;
  currencySymbol?: string;
  items: { name: string; quantity: number | string; price: number; note?: string }[];
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  taxPercent?: number;
  chargesAmount?: number;
  totalAmount: number;
  amountPaid?: number;
  changeDue?: number;
  paymentMethod?: string;
  footer?: string;
}

export interface KOTItem {
  name: string;
  quantity: number | string;
  category_id?: number;
  category_name?: string;
  note?: string;
}

export interface KOTData {
  tokenNo?: string;
  tableNo?: string;
  date?: string;
  cashierName?: string;
  items: KOTItem[];
}

export interface PrintResult {
  success: boolean;
  error?: string;
  printer?: string;
}

// Always returns true for health so callers don't need to change
export async function checkAgentHealth(): Promise<AgentHealth | null> {
  return { status: 'ok', version: '3.0.0', printers: 1, invoice: 1, kot: 1 };
}

export async function printInvoice(receiptData: InvoiceData): Promise<PrintResult> {
  try {
    await api.post('/settings/print-queue', { type: 'invoice', receiptData });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.response?.data?.message || e.message };
  }
}

export async function printKOT(kotData: KOTData): Promise<PrintResult> {
  try {
    await api.post('/settings/print-queue', { type: 'kot', kotData });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.response?.data?.message || e.message };
  }
}
