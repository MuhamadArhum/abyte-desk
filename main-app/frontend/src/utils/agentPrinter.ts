// AByte Printer Agent bridge
// Communicates with the local print agent running at localhost:3001

const AGENT_URL = import.meta.env.VITE_PRINTER_AGENT_URL || 'http://localhost:3001';
const TIMEOUT_MS = 8000;

async function agentFetch(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AGENT_URL}${path}`, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface AgentHealth {
  status: string;
  version: string;
  printers: number;
  invoice: number;
  kot: number;
}

export async function checkAgentHealth(): Promise<AgentHealth | null> {
  try {
    const res = await agentFetch('/health');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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
  results?: { printer: string; items: number; success: boolean; error?: string }[];
}

export async function printInvoice(receiptData: InvoiceData, printerId?: string): Promise<PrintResult> {
  try {
    const res = await agentFetch('/print/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptData, printerId }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Print failed' };
    return data;
  } catch (e: any) {
    if (e.name === 'AbortError') return { success: false, error: 'Printer agent not reachable (timeout). Is it running?' };
    return { success: false, error: e.message };
  }
}

export async function printKOT(kotData: KOTData): Promise<PrintResult> {
  try {
    const res = await agentFetch('/print/kot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kotData }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'KOT print failed' };
    return data;
  } catch (e: any) {
    if (e.name === 'AbortError') return { success: false, error: 'Printer agent not reachable (timeout). Is it running?' };
    return { success: false, error: e.message };
  }
}
