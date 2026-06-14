// Print utility — generates HTML and opens browser print dialog
import api from './api';

const getStoreSettings = async (): Promise<{ store_name?: string; address?: string; phone?: string; email?: string }> => {
  try {
    const res = await api.get('/settings');
    return res.data || {};
  } catch {
    return {};
  }
};

// ─── Shared Base Styles (used by Challan & Raw Sale) ─────────
const baseStyles = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 20px; }
    .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .company-name { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    .doc-title { font-size: 15px; font-weight: bold; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; color: #333; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; margin-bottom: 16px; font-size: 12px; }
    .meta-grid span { color: #555; }
    .meta-grid strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    thead th { background: #f3f4f6; border: 1px solid #ccc; padding: 7px 10px; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 11px; }
    tbody td { border: 1px solid #ddd; padding: 6px 10px; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .text-right { text-align: right; }
    .total-row td { font-weight: bold; background: #f3f4f6; border-top: 2px solid #999; font-size: 13px; }
    .notes { font-size: 11px; color: #555; margin-bottom: 20px; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 40px; }
    .sig-box { text-align: center; }
    .sig-line { border-top: 1px solid #555; margin-bottom: 5px; padding-top: 4px; font-size: 11px; color: #444; }
    @media print { @page { margin: 15mm; } }
  </style>
`;

// ─── GRN Premium Styles ───────────────────────────────────────
const grnStyles = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 28px; }

    /* ── Header ── */
    .grn-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1a1a2e; padding-bottom:14px; margin-bottom:18px; }
    .grn-logo-name { font-size:22px; font-weight:700; color:#1a1a2e; letter-spacing:1px; }
    .grn-tagline { font-size:11px; color:#777; margin-top:2px; }
    .grn-address { font-size:11px; color:#555; margin-top:6px; line-height:1.6; }

    /* ── GRN Badge (top-right) ── */
    .grn-badge { background:#1a1a2e; color:#fff; padding:10px 20px; border-radius:6px; text-align:center; min-width:180px; }
    .grn-badge-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; opacity:0.7; }
    .grn-badge-num { font-size:16px; font-weight:700; margin-top:3px; letter-spacing:1px; }
    .grn-badge-date { font-size:10px; opacity:0.65; margin-top:3px; }

    /* ── Title bar ── */
    .grn-title-bar { background:#f0f4ff; border-left:4px solid #1a1a2e; padding:8px 14px; margin-bottom:16px; border-radius:0 4px 4px 0; display:flex; align-items:center; gap:10px; }
    .grn-title-text { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#1a1a2e; }
    .status-pill { background:#e6f9ef; color:#1a7a46; font-size:10px; font-weight:700; padding:2px 10px; border-radius:20px; letter-spacing:0.5px; text-transform:uppercase; }

    /* ── Meta Info ── */
    .grn-meta { display:grid; grid-template-columns:1fr 1fr; gap:6px 32px; background:#fafafa; border:1px solid #eee; border-radius:6px; padding:12px 16px; margin-bottom:18px; }
    .meta-row { display:flex; gap:6px; font-size:12px; }
    .meta-row .lbl { color:#888; min-width:100px; }
    .meta-row .val { color:#111; font-weight:600; }

    /* ── Table ── */
    table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:12px; }
    thead tr { background:#1a1a2e; color:#fff; }
    thead th { padding:9px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.8px; font-weight:600; }
    thead th.r { text-align:right; }
    tbody td { border-bottom:1px solid #eee; padding:8px 12px; color:#222; }
    tbody td.r { text-align:right; }
    tbody tr:nth-child(even) { background:#f9f9fc; }

    /* ── Charge / Discount / Tax rows ── */
    .charge-row td { font-size:11px; color:#666; border-bottom:1px dashed #eee; }
    .discount-row td { color:#bb0000 !important; }

    /* ── Grand Total ── */
    .total-row td { font-size:14px; font-weight:700; color:#1a1a2e !important; padding:10px 12px !important; background:#f0f4ff !important; border-top:2px solid #1a1a2e !important; border-bottom:none !important; }

    /* ── Notes ── */
    .notes-box { background:#fffbee; border-left:3px solid #f5c842; border-radius:0 4px 4px 0; padding:8px 12px; font-size:11px; color:#665500; margin:12px 0 16px; }

    /* ── Signatures ── */
    .sig-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:30px; margin-top:44px; }
    .sig-box { text-align:center; }
    .sig-line { border-top:1.5px solid #aaa; padding-top:6px; font-size:11px; color:#555; letter-spacing:0.5px; }

    /* ── Footer ── */
    .grn-footer { margin-top:24px; border-top:1px solid #e0e0e0; padding-top:8px; display:flex; justify-content:space-between; font-size:10px; color:#aaa; }

    @media print { @page { margin: 15mm; } }
  </style>
`;

const openPrintWindow = (bodyHtml: string, title: string, customStyles: string = baseStyles) => {
  const w = window.open('', '_blank', 'width=820,height=650');
  if (!w) { alert('Allow popups to print.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${customStyles}</head><body>${bodyHtml}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
};

// Opens window synchronously (required for popup blocker), then populates async
const openPrintWindowAsync = async (
  buildHtml: (settings: Awaited<ReturnType<typeof getStoreSettings>>) => string,
  title: string,
  customStyles: string = baseStyles
) => {
  const w = window.open('', '_blank', 'width=820,height=650');
  if (!w) { alert('Allow popups to print.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${customStyles}</head><body><p style="padding:30px;font-family:Arial">Loading...</p></body></html>`);
  const settings = await getStoreSettings();
  const bodyHtml = buildHtml(settings);
  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${customStyles}</head><body>${bodyHtml}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
};

const getCompanyName = () => {
  try { return localStorage.getItem('company_name') || 'AByte Manufacturing'; } catch { return 'AByte Manufacturing'; }
};

const fmt3 = (n: any) => Number(n || 0).toFixed(3);
const fmt2 = (n: any) => Number(n || 0).toFixed(0);
const fmtCurrency = (n: any) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ─── GRN (Goods Received Note) — Improved ────────────────────
export const printGRN = (voucher: any) => {
  const title = `GRN - ${voucher.pv_number}`;

  openPrintWindowAsync((settings) => {
    const companyName = settings.store_name || getCompanyName();
    const address     = settings.address || '';
    const phone       = settings.phone   || '';
    const email       = settings.email   || '';

    const printDateTime = (() => {
      const d = voucher.created_at ? new Date(voucher.created_at) : new Date();
      const date = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${date} &nbsp;|&nbsp; ${time}`;
    })();

    const supplierDisplay = voucher.supplier_name || voucher.payable_account_name || '—';

    const rows = (voucher.items || []).map((item: any, idx: number) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.product_name}</td>
        <td class="r">${fmt3(item.quantity_received)}</td>
        <td class="r">${fmt2(item.unit_price)}</td>
        <td class="r">${fmt2(Number(item.quantity_received) * Number(item.unit_price))}</td>
      </tr>`).join('');

    const shipping        = Number(voucher.shipping_cost)    || 0;
    const extra           = Number(voucher.extra_charges)    || 0;
    const other           = Number(voucher.other_charges)    || 0;
    const discount_pct    = Number(voucher.discount_percent) || 0;
    const discount_amount = Number(voucher.discount_amount)  || 0;
    const tax_pct         = Number(voucher.tax_percent)      || 0;
    const tax_amount      = Number(voucher.tax_amount)       || 0;

    const chargeRows = [
      shipping > 0        ? `<tr class="charge-row"><td colspan="4" class="r">Shipping Cost</td><td class="r">${fmt2(shipping)}</td></tr>` : '',
      extra    > 0        ? `<tr class="charge-row"><td colspan="4" class="r">Extra Charges</td><td class="r">${fmt2(extra)}</td></tr>` : '',
      other    > 0        ? `<tr class="charge-row"><td colspan="4" class="r">Other Charges</td><td class="r">${fmt2(other)}</td></tr>` : '',
      discount_amount > 0 ? `<tr class="charge-row discount-row"><td colspan="4" class="r">Discount (${fmt2(discount_pct)}%)</td><td class="r">- ${fmt2(discount_amount)}</td></tr>` : '',
      tax_amount      > 0 ? `<tr class="charge-row"><td colspan="4" class="r">Tax (${fmt2(tax_pct)}%)</td><td class="r">${fmt2(tax_amount)}</td></tr>` : '',
    ].join('');

    return `
      <div class="grn-header">
        <div>
          <div class="grn-logo-name">${companyName}</div>
          <div class="grn-tagline">Precision. Quality. Reliability.</div>
          <div class="grn-address">
            ${address ? `&#128205; ${address}<br>` : ''}
            ${phone   ? `&#128222; ${phone}` : ''}
            ${email   ? ` &nbsp;|&nbsp; &#9993; ${email}` : ''}
          </div>
        </div>
        <div class="grn-badge">
          <div class="grn-badge-label">GRN Number</div>
          <div class="grn-badge-num">${voucher.pv_number}</div>
          <div class="grn-badge-date">${printDateTime}</div>
        </div>
      </div>

      <div class="grn-title-bar">
        <span class="grn-title-text">Goods Received Note (GRN)</span>
        <span class="status-pill">&#10003; Received</span>
      </div>

      <div class="grn-meta">
        <div class="meta-row"><span class="lbl">Supplier</span><span class="val">${supplierDisplay}</span></div>
        <div class="meta-row"><span class="lbl">PO Reference</span><span class="val">${voucher.po_number || '—'}</span></div>
        <div class="meta-row"><span class="lbl">Received By</span><span class="val">${voucher.created_by_name || '—'}</span></div>
        <div class="meta-row"><span class="lbl">Voucher Date</span><span class="val">${voucher.voucher_date || '—'}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:32px">#</th>
            <th>Product</th>
            <th class="r">Qty Received</th>
            <th class="r">Unit Price</th>
            <th class="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${chargeRows}
          <tr class="total-row">
            <td colspan="4" style="text-align:right">Grand Total</td>
            <td style="text-align:right">${fmtCurrency(voucher.total_amount)}</td>
          </tr>
        </tbody>
      </table>

      ${voucher.notes ? `<div class="notes-box">&#128221; <strong>Notes:</strong> ${voucher.notes}</div>` : ''}

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line">Received By</div></div>
        <div class="sig-box"><div class="sig-line">Store Keeper</div></div>
        <div class="sig-box"><div class="sig-line">Authorized By</div></div>
      </div>

      <div class="grn-footer">
        <span>Generated: ${printDateTime} &nbsp;|&nbsp; AByte ERP System</span>
        <span>erp.abytesol.com</span>
      </div>`;

  }, title, grnStyles);
};

// ─── Stock Issue Challan ──────────────────────────────────────
export const printChallan = (issue: any) => {
  const rows = (issue.items || []).map((item: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.product_name}</td>
      <td class="text-right">${fmt3(item.quantity)}</td>
      <td class="text-right">${fmt2(item.unit_cost)}</td>
      <td class="text-right">${fmt2(Number(item.quantity) * Number(item.unit_cost))}</td>
    </tr>`).join('');

  const totalCost = issue.total_cost
    || (issue.items || []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_cost), 0);

  const html = `
    <div class="doc-header">
      <div class="company-name">${getCompanyName()}</div>
      <div class="doc-title">Stock Issue Challan</div>
    </div>
    <div class="meta-grid">
      <div><span>Challan # : </span><strong>${issue.issue_number}</strong></div>
      <div><span>Date : </span><strong>${issue.issue_date}</strong></div>
      <div><span>Section : </span><strong>${issue.section_name}</strong></div>
      <div><span>Issued By : </span><strong>${issue.created_by_name || ''}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th>Product</th>
          <th class="text-right">Quantity</th>
          <th class="text-right">Unit Cost</th>
          <th class="text-right">Total Cost</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="4" class="text-right">Total Cost</td>
          <td class="text-right">${fmtCurrency(totalCost)}</td>
        </tr>
      </tbody>
    </table>
    ${issue.notes ? `<p class="notes">Notes: ${issue.notes}</p>` : ''}
    <div class="sig-row">
      <div class="sig-box"><div class="sig-line">Issued By</div></div>
      <div class="sig-box"><div class="sig-line">Received By (Section)</div></div>
      <div class="sig-box"><div class="sig-line">Store Keeper</div></div>
    </div>`;

  openPrintWindow(html, `Challan - ${issue.issue_number}`);
};

// ─── Raw Sale Invoice ─────────────────────────────────────────
export const printRawSaleInvoice = (sale: any) => {
  const rows = (sale.items || []).map((item: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.product_name}</td>
      <td class="text-right">${fmt3(item.quantity)}</td>
      <td class="text-right">${fmt2(item.unit_price)}</td>
      <td class="text-right">${fmt2(Number(item.quantity) * Number(item.unit_price))}</td>
    </tr>`).join('');

  const html = `
    <div class="doc-header">
      <div class="company-name">${getCompanyName()}</div>
      <div class="doc-title">Raw Material Sale Invoice</div>
    </div>
    <div class="meta-grid">
      <div><span>Invoice # : </span><strong>${sale.sale_number}</strong></div>
      <div><span>Date : </span><strong>${sale.sale_date}</strong></div>
      <div><span>Customer : </span><strong>${sale.customer_name || '—'}</strong></div>
      <div><span>Section : </span><strong>${sale.section_name}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th>Product</th>
          <th class="text-right">Quantity</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="4" class="text-right">Grand Total</td>
          <td class="text-right">${fmtCurrency(sale.total_amount)}</td>
        </tr>
      </tbody>
    </table>
    ${sale.notes ? `<p class="notes">Notes: ${sale.notes}</p>` : ''}
    <div class="sig-row">
      <div class="sig-box"><div class="sig-line">Prepared By</div></div>
      <div class="sig-box"><div class="sig-line">Customer Signature</div></div>
      <div class="sig-box"><div class="sig-line">Authorized By</div></div>
    </div>`;

  openPrintWindow(html, `Invoice - ${sale.sale_number}`);
};