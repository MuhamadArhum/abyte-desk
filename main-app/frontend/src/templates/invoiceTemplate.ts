/**
 * ============================================================
 *  INVOICE PRINT TEMPLATE — Multi-Tenant SaaS Edition
 *
 *  Accepts TenantConfig so each client sees THEIR:
 *    - Company name & logo
 *    - NTN / STRN (shown only if present)
 *    - Tax name (GST / VAT / etc.) and rate
 *    - Custom receipt header & footer
 *    - Currency symbol
 * ============================================================
 */

export interface PrintItem {
  description: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PrintInvoice {
  invoice_id:        number;
  invoice_number:    string;
  customer_name:     string;
  customer_phone?:   string;
  customer_email?:   string;
  customer_address?: string;
  subtotal:          number;
  tax_amount:        number;
  discount:          number;
  total_amount:      number;
  status:            string;
  due_date:          string | null;
  payment_terms:     string | null;
  notes:             string | null;
  created_at:        string;
  items:             PrintItem[];
}

export interface StoreInfo {
  store_name: string;
  address?:   string;
  phone?:     string;
  email?:     string;
}

// Tenant-specific config injected from AuthContext / tenant config API
export interface TenantConfig {
  company_name?:       string;
  logo_url?:           string | null;
  primary_color?:      string;
  currency_symbol?:    string;
  tax_name?:           string;          // 'GST' | 'VAT' | 'Sales Tax' | etc.
  tax_rate?:           number;
  ntn?:                string | null;
  strn?:               string | null;
  is_tax_exempt?:      boolean;
  receipt_header?:     string | null;
  receipt_footer?:     string | null;
  show_tax_on_receipt?:  boolean;
  show_logo_on_receipt?: boolean;
  show_ntn_on_receipt?:  boolean;
}

// ─── STATUS BADGE COLORS ──────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  paid:    'background:#dcfce7; color:#15803d;',
  overdue: 'background:#fee2e2; color:#b91c1c;',
  partial: 'background:#fef9c3; color:#a16207;',
  sent:    'background:#dbeafe; color:#1d4ed8;',
  draft:   'background:#f3f4f6; color:#374151;',
};

// ─── MAIN TEMPLATE ────────────────────────────────────────────
export function buildInvoiceHTML(
  invoice:  PrintInvoice,
  store:    StoreInfo,
  tenant:   TenantConfig = {}
): string {

  // Merge store info with tenant config (tenant config takes priority)
  const companyName = tenant.company_name || store.store_name;
  const currency    = tenant.currency_symbol || 'Rs.';
  const accentColor = tenant.primary_color   || '#1f2937';
  const taxLabel    = tenant.tax_name        || 'Tax';
  const showTax     = tenant.show_tax_on_receipt !== false;
  const showLogo    = tenant.show_logo_on_receipt !== false;
  const showNtn     = tenant.show_ntn_on_receipt  !== false;

  // Item rows
  const itemRows = invoice.items.map((item, idx) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding:10px 8px; font-size:13px; color:#6b7280;">${idx + 1}</td>
      <td style="padding:10px 8px; font-size:13px; color:#1f2937;">${item.description || item.product_name || 'Item'}</td>
      <td style="padding:10px 8px; font-size:13px; color:#1f2937; text-align:right;">${item.quantity}</td>
      <td style="padding:10px 8px; font-size:13px; color:#1f2937; text-align:right;">${currency} ${Number(item.unit_price).toFixed(0)}</td>
      <td style="padding:10px 8px; font-size:13px; color:#1f2937; text-align:right; font-weight:600;">${currency} ${Number(item.total_price).toFixed(0)}</td>
    </tr>
  `).join('');

  const statusStyle = STATUS_STYLES[invoice.status] || STATUS_STYLES.draft;

  // Logo section
  const logoHtml = (showLogo && tenant.logo_url) ? `
    <img src="${tenant.logo_url}"
         alt="${companyName}"
         style="max-height:70px; max-width:200px; margin-bottom:10px; object-fit:contain;" />
    <br/>
  ` : '';

  // NTN / STRN section
  const ntnHtml = (showNtn && (tenant.ntn || tenant.strn)) ? `
    <p style="font-size:12px; color:#6b7280; margin:2px 0;">
      ${tenant.ntn  ? `NTN: ${tenant.ntn}`   : ''}
      ${tenant.ntn && tenant.strn ? '&nbsp;|&nbsp;' : ''}
      ${tenant.strn ? `STRN: ${tenant.strn}` : ''}
    </p>
  ` : '';

  // Custom receipt header
  const headerHtml = tenant.receipt_header ? `
    <p style="font-size:13px; color:#374151; margin:6px 0; font-style:italic;">
      ${tenant.receipt_header}
    </p>
  ` : '';

  // Custom receipt footer
  const footerText = tenant.receipt_footer || 'Thank you for your business!';

  // Tax row (only shown if tax > 0 AND not tax-exempt AND showTax is on)
  const taxRowHtml = (showTax && !tenant.is_tax_exempt && Number(invoice.tax_amount) > 0) ? `
    <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:13px; border-bottom:1px solid #e5e7eb;">
      <span style="color:#6b7280;">${taxLabel}</span>
      <span style="color:#1f2937; font-weight:500;">${currency} ${Number(invoice.tax_amount).toFixed(0)}</span>
    </div>
  ` : '';

  return `
    <div style="max-width:720px; margin:0 auto; font-family:'Segoe UI',Arial,sans-serif; color:#1f2937;">

      <!-- ═══ HEADER ══════════════════════════════════════════ -->
      <div style="text-align:center; padding-bottom:24px; margin-bottom:24px; border-bottom:3px solid ${accentColor};">
        ${logoHtml}
        <h1 style="font-size:26px; font-weight:800; margin:0 0 4px; color:${accentColor};">
          ${companyName}
        </h1>
        ${headerHtml}
        ${store.address ? `<p style="font-size:13px; color:#6b7280; margin:2px 0;">${store.address}</p>` : ''}
        <p style="font-size:13px; color:#6b7280; margin:2px 0;">
          ${store.phone ? `Tel: ${store.phone}` : ''}
          ${store.phone && store.email ? '&nbsp;|&nbsp;' : ''}
          ${store.email ? `Email: ${store.email}` : ''}
        </p>
        ${ntnHtml}
      </div>

      <!-- ═══ INVOICE TITLE ═══════════════════════════════════ -->
      <div style="text-align:center; margin-bottom:28px;">
        <h2 style="font-size:24px; font-weight:700; letter-spacing:4px; text-transform:uppercase; margin:0; color:${accentColor};">
          INVOICE
        </h2>
      </div>

      <!-- ═══ BILL TO + INVOICE DETAILS ═══════════════════════ -->
      <table style="width:100%; margin-bottom:28px; border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top; width:50%;">
            <p style="font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin:0 0 8px;">Bill To</p>
            <p style="font-size:16px; font-weight:700; color:#1f2937; margin:0;">${invoice.customer_name}</p>
            ${invoice.customer_phone   ? `<p style="font-size:13px; color:#6b7280; margin:3px 0 0;">${invoice.customer_phone}</p>`   : ''}
            ${invoice.customer_email   ? `<p style="font-size:13px; color:#6b7280; margin:3px 0 0;">${invoice.customer_email}</p>`   : ''}
            ${invoice.customer_address ? `<p style="font-size:13px; color:#6b7280; margin:3px 0 0;">${invoice.customer_address}</p>` : ''}
          </td>
          <td style="vertical-align:top; width:50%; text-align:right;">
            <p style="font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin:0 0 8px;">Invoice Details</p>
            <p style="font-size:16px; font-weight:700; color:#1f2937; margin:0;">${invoice.invoice_number}</p>
            <p style="font-size:13px; color:#6b7280; margin:3px 0 0;">Date: ${new Date(invoice.created_at).toLocaleDateString()}</p>
            ${invoice.due_date ? `<p style="font-size:13px; color:#6b7280; margin:3px 0 0;">Due: ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
            <p style="margin:8px 0 0;">
              <span style="display:inline-block; padding:3px 12px; border-radius:4px; font-size:11px; font-weight:700; text-transform:uppercase; ${statusStyle}">
                ${invoice.status}
              </span>
            </p>
          </td>
        </tr>
      </table>

      <!-- ═══ ITEMS TABLE ══════════════════════════════════════ -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
        <thead>
          <tr style="border-bottom:2px solid ${accentColor}; background:#f9fafb;">
            <th style="padding:12px 8px; text-align:left;  font-size:12px; font-weight:700; color:#374151; width:36px;">#</th>
            <th style="padding:12px 8px; text-align:left;  font-size:12px; font-weight:700; color:#374151;">Description</th>
            <th style="padding:12px 8px; text-align:right; font-size:12px; font-weight:700; color:#374151; width:55px;">Qty</th>
            <th style="padding:12px 8px; text-align:right; font-size:12px; font-weight:700; color:#374151; width:120px;">Unit Price</th>
            <th style="padding:12px 8px; text-align:right; font-size:12px; font-weight:700; color:#374151; width:120px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- ═══ TOTALS ═══════════════════════════════════════════ -->
      <div style="display:flex; justify-content:flex-end; margin-bottom:28px;">
        <div style="width:290px;">
          <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:13px; border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;">Subtotal</span>
            <span style="color:#1f2937; font-weight:500;">${currency} ${Number(invoice.subtotal).toFixed(0)}</span>
          </div>

          ${taxRowHtml}

          ${Number(invoice.discount) > 0 ? `
          <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:13px; border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;">Discount</span>
            <span style="color:#dc2626; font-weight:500;">- ${currency} ${Number(invoice.discount).toFixed(0)}</span>
          </div>` : ''}

          <div style="display:flex; justify-content:space-between; padding:14px 0 8px; border-top:2px solid ${accentColor}; margin-top:4px;">
            <span style="font-size:17px; font-weight:800; color:${accentColor};">Grand Total</span>
            <span style="font-size:17px; font-weight:800; color:${accentColor};">${currency} ${Number(invoice.total_amount).toFixed(0)}</span>
          </div>
        </div>
      </div>

      <!-- ═══ PAYMENT TERMS & NOTES ════════════════════════════ -->
      ${(invoice.payment_terms || invoice.notes) ? `
      <div style="border-top:1px solid #e5e7eb; padding-top:20px; margin-bottom:24px;">
        ${invoice.payment_terms ? `
        <div style="margin-bottom:12px;">
          <h4 style="font-size:13px; font-weight:700; color:#374151; margin:0 0 4px;">Payment Terms</h4>
          <p  style="font-size:13px; color:#6b7280; margin:0;">${invoice.payment_terms}</p>
        </div>` : ''}
        ${invoice.notes ? `
        <div>
          <h4 style="font-size:13px; font-weight:700; color:#374151; margin:0 0 4px;">Notes</h4>
          <p  style="font-size:13px; color:#6b7280; margin:0;">${invoice.notes}</p>
        </div>` : ''}
      </div>` : ''}

      <!-- ═══ FOOTER ═══════════════════════════════════════════ -->
      <div style="text-align:center; padding-top:20px; border-top:1px solid #e5e7eb;">
        <p style="font-size:13px; color:#9ca3af; margin:0;">${footerText}</p>
      </div>

    </div>
  `;
}
