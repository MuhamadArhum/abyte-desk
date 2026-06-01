import api from './api';

interface ReceiptSale {
  sale_id: number;
  total_amount: number | string;
  discount: number | string;
  tax_percent: number | string;
  tax_amount: number | string;
  additional_charges_percent: number | string;
  additional_charges_amount: number | string;
  payment_method: string;
  amount_paid: number | string;
  sale_date?: string;
  note?: string;
  token_no?: string;
  invoice_no?: string;
  order_type?: string;
  table_name?: string;
  cashier_name?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number | string;
    discount?: number | string;
    subtotal?: number | string;
    variant_name?: string;
  }>;
}

interface ReceiptSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  receipt_footer?: string;
  tax_number?: string;
  currency_symbol?: string;
  show_logo?: boolean;
  logo_url?: string;
  header_note?: string;
}

interface PrintOptions {
  showPrintDialog?: boolean;
  printTimeout?: number;
  copyToClipboard?: boolean;
  openInNewWindow?: boolean;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatCurrency(amount: number, currencySymbol: string = '$'): string {
  return `${currencySymbol}${amount.toFixed(2)}`;
}

function parseNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatDate(date: Date): { dateStr: string; timeStr: string } {
  return {
    dateStr: date.toLocaleDateString(),
    timeStr: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function generateReceiptHTML(
  sale: ReceiptSale,
  settings: ReceiptSettings | null = null,
  cashierName: string,
  customerName?: string,
  options?: {
    includeQrCode?: boolean;
    qrCodeData?: string;
    showItemDiscounts?: boolean;
  }
): string {
  const storeName = escapeHtml(settings?.store_name || 'AByte ERP');
  const storeAddress = escapeHtml(settings?.address || '');
  const storePhone = escapeHtml(settings?.phone || '');
  const storeEmail = escapeHtml(settings?.email || '');
  const storeWebsite = escapeHtml(settings?.website || '');
  const taxNumber = escapeHtml(settings?.tax_number || '');
  const footer = escapeHtml(settings?.receipt_footer || 'Thank you for shopping!');
  const headerNote = escapeHtml(settings?.header_note || '');
  const cashier = escapeHtml(cashierName || 'Staff');
  const customer = customerName ? escapeHtml(customerName) : '';
  const currencySymbol = settings?.currency_symbol || '$';
  const showLogo = settings?.show_logo || false;
  const logoUrl = settings?.logo_url || '';

  // Parse amounts
  const totalAmount = parseNumber(sale.total_amount);
  const discount = parseNumber(sale.discount);
  const taxAmount = parseNumber(sale.tax_amount);
  const taxPercent = parseNumber(sale.tax_percent);
  const chargesAmount = parseNumber(sale.additional_charges_amount);
  const chargesPercent = parseNumber(sale.additional_charges_percent);
  const amountPaid = parseNumber(sale.amount_paid);
  const changeDue = Math.max(0, amountPaid - totalAmount);
  const subtotal = totalAmount - taxAmount - chargesAmount + discount;

  // Date handling
  const saleDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const { dateStr, timeStr } = formatDate(saleDate);

  // Order type label
  const orderTypeMap: Record<string, string> = {
    dine_in: 'DINE-IN', takeaway: 'TAKEAWAY', delivery: 'DELIVERY', on_spot: 'WALK-IN'
  };
  const orderTypeLabel = sale.order_type ? (orderTypeMap[sale.order_type] || sale.order_type.toUpperCase()) : '';
  const tableName = escapeHtml(sale.table_name || '');

  // Generate item rows
  const itemRows = (sale.items || []).map((item) => {
    const qty = item.quantity;
    const price = parseNumber(item.unit_price);
    const itemDiscount = parseNumber(item.discount || 0);
    const lineSubtotal = (qty * price) - itemDiscount;
    const variantNote = item.variant_name ? `<div class="item-variant">${escapeHtml(item.variant_name)}</div>` : '';

    return `<tr>
      <td class="col-item">
        <div class="item-name">${escapeHtml(item.product_name)}</div>
        ${variantNote}
        ${itemDiscount > 0 ? `<div class="item-discount">-${formatCurrency(itemDiscount, currencySymbol)}</div>` : ''}
      </td>
      <td class="col-qty">${qty}</td>
      <td class="col-price">${formatCurrency(price, currencySymbol)}</td>
      <td class="col-total">${formatCurrency(lineSubtotal, currencySymbol)}</td>
    </tr>`;
  }).join('');

  // Generate QR Code HTML if enabled
  const qrCodeHTML = options?.includeQrCode && options?.qrCodeData ? `
    <div class="qr-container">
      <div class="qr-code">
        <!-- QR Code would be generated here -->
        <div style="text-align:center; padding:10px; border:1px dashed #ccc;">
          QR Code<br>(Data: ${escapeHtml(options.qrCodeData.substring(0, 20))}...)
        </div>
      </div>
      <div class="qr-note">Scan for digital receipt</div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt #${sale.sale_id}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { 
      size: 80mm auto; 
      margin: 0; 
    }
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    body {
      font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 3mm;
      background: white;
      color: #000;
      font-size: 12px;
      line-height: 1.2;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* Store Header */
    .store-header {
      text-align: center;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 2px solid #000;
    }
    .logo {
      max-width: 60mm;
      max-height: 20mm;
      margin: 0 auto 4px;
    }
    .logo img {
      max-width: 100%;
      max-height: 20mm;
      object-fit: contain;
    }
    .store-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .store-info {
      font-size: 10px;
      color: #444;
      margin-bottom: 2px;
    }
    .store-contact {
      font-size: 9px;
      color: #666;
    }
    
    /* Header Note */
    .header-note {
      background: #f8f8f8;
      padding: 3px;
      margin: 4px 0;
      font-size: 9px;
      text-align: center;
      border: 1px dashed #ccc;
    }
    
    /* Receipt Metadata */
    .receipt-meta {
      margin: 5px 0;
      padding: 4px 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin: 1px 0;
      font-size: 10px;
    }
    .meta-label {
      font-weight: bold;
      min-width: 40%;
    }
    
    /* Items Table */
    .items-container {
      margin: 6px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin: 2px 0;
    }
    .items-table th {
      text-align: left;
      border-bottom: 1px solid #000;
      padding: 3px 0;
      font-weight: bold;
      font-size: 9px;
    }
    .items-table td {
      padding: 2px 0;
      vertical-align: top;
      border-bottom: 1px dotted #ccc;
    }
    .col-item { width: 35%; }
    .col-qty { width: 15%; text-align: center; }
    .col-price { width: 25%; text-align: right; }
    .col-total { width: 25%; text-align: right; font-weight: bold; }
    
    .item-name {
      font-weight: bold;
    }
    .item-variant {
      font-size: 8px;
      color: #555;
      font-style: italic;
    }
    .item-discount {
      font-size: 8px;
      color: #d00;
      font-style: italic;
    }
    .order-type-banner {
      text-align: center;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 1px;
      padding: 4px;
      margin: 4px 0;
      border: 2px solid #000;
      background: #000;
      color: #fff;
    }
    .table-info {
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      margin: 2px 0 6px;
    }
    
    /* Totals Section */
    .totals-section {
      margin: 8px 0;
      padding: 4px 0;
      border-top: 2px solid #000;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      font-size: 11px;
    }
    .total-label {
      font-weight: normal;
    }
    .total-value {
      font-weight: bold;
    }
    .grand-total {
      font-size: 14px;
      font-weight: bold;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 2px solid #000;
    }
    .payment-info {
      background: #f0f0f0;
      padding: 4px;
      margin: 6px 0;
      border-radius: 2px;
    }
    
    /* Note Section */
    .note-section {
      margin: 6px 0;
      padding: 4px;
      background: #fff8dc;
      border: 1px dashed #ccc;
      font-size: 9px;
    }
    
    /* Footer */
    .receipt-footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px dashed #000;
      font-size: 9px;
      color: #555;
    }
    .footer-note {
      margin: 4px 0;
    }
    .software-by {
      font-size: 8px;
      color: #777;
      margin-top: 4px;
    }
    
    /* QR Code */
    .qr-container {
      text-align: center;
      margin: 8px 0;
      padding: 6px;
      border: 1px dashed #ccc;
    }
    .qr-code {
      margin: 0 auto;
      width: 40mm;
      height: 40mm;
      background: #f8f8f8;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-note {
      font-size: 8px;
      color: #666;
      margin-top: 2px;
    }
    
    /* Print Optimizations */
    @media print {
      body {
        width: 100%;
        padding: 1mm;
        margin: 0;
      }
      .no-print {
        display: none;
      }
      .store-header {
        break-inside: avoid;
      }
      .items-container {
        break-inside: avoid;
      }
    }
    
    /* Dark Mode for OLED displays */
    @media (prefers-color-scheme: dark) {
      body {
        background: #000;
        color: #fff;
      }
      .store-header,
      .receipt-meta,
      .items-table th {
        border-color: #fff;
      }
      .payment-info {
        background: #222;
      }
      .note-section {
        background: #333;
        color: #fff;
      }
    }
  </style>
</head>
<body>
  <!-- Store Header -->
  <div class="store-header">
    ${showLogo && logoUrl ? `
      <div class="logo">
        <img src="${escapeHtml(logoUrl)}" alt="${storeName}" onerror="this.style.display='none'">
      </div>
    ` : ''}
    <div class="store-name">${storeName}</div>
    ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
    ${storePhone ? `<div class="store-contact">📞 ${storePhone}</div>` : ''}
    ${storeEmail ? `<div class="store-contact">✉️ ${storeEmail}</div>` : ''}
    ${storeWebsite ? `<div class="store-contact">🌐 ${storeWebsite}</div>` : ''}
    ${taxNumber ? `<div class="store-contact">Tax #: ${taxNumber}</div>` : ''}
  </div>

  ${headerNote ? `<div class="header-note">${headerNote}</div>` : ''}

  ${orderTypeLabel ? `<div class="order-type-banner">${orderTypeLabel}</div>` : ''}
  ${tableName ? `<div class="table-info">Table: ${tableName}</div>` : ''}

  <!-- Receipt Metadata -->
  <div class="receipt-meta">
    ${sale.invoice_no ? `
    <div class="meta-row">
      <span class="meta-label" style="font-weight:bold;">Invoice:</span>
      <span style="font-weight:bold;">${escapeHtml(sale.invoice_no)}</span>
    </div>` : `
    <div class="meta-row">
      <span class="meta-label">Receipt #:</span>
      <span>${sale.sale_id}</span>
    </div>`}
    ${sale.token_no ? `
    <div class="meta-row">
      <span class="meta-label" style="font-weight:bold;">Token:</span>
      <span style="font-weight:bold; font-size:1.3em;">${escapeHtml(sale.token_no)}</span>
    </div>` : ''}
    <div class="meta-row">
      <span class="meta-label">Date:</span>
      <span>${dateStr} ${timeStr}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Order Taker:</span>
      <span>${cashier}</span>
    </div>
    ${customer ? `
    <div class="meta-row">
      <span class="meta-label">Customer:</span>
      <span>${customer}</span>
    </div>
    ` : ''}
    ${sale.payment_method ? `
    <div class="meta-row">
      <span class="meta-label">Payment:</span>
      <span style="text-transform:uppercase;">${escapeHtml(sale.payment_method)}</span>
    </div>
    ` : ''}
  </div>

  <!-- Items Table -->
  <div class="items-container">
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-item">Item</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Price</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <!-- Totals Section -->
  <div class="totals-section">
    <div class="total-row">
      <span class="total-label">Subtotal:</span>
      <span class="total-value">${formatCurrency(subtotal, currencySymbol)}</span>
    </div>
    
    ${taxAmount > 0 ? `
    <div class="total-row">
      <span class="total-label">Tax (${taxPercent}%):</span>
      <span class="total-value">${formatCurrency(taxAmount, currencySymbol)}</span>
    </div>
    ` : ''}
    
    ${chargesAmount > 0 ? `
    <div class="total-row">
      <span class="total-label">Charges (${chargesPercent}%):</span>
      <span class="total-value">${formatCurrency(chargesAmount, currencySymbol)}</span>
    </div>
    ` : ''}
    
    ${discount > 0 ? `
    <div class="total-row">
      <span class="total-label">Discount:</span>
      <span class="total-value">-${formatCurrency(discount, currencySymbol)}</span>
    </div>
    ` : ''}
    
    <div class="total-row grand-total">
      <span class="total-label">TOTAL:</span>
      <span class="total-value">${formatCurrency(totalAmount, currencySymbol)}</span>
    </div>
  </div>

  <!-- Payment Information -->
  <div class="payment-info">
    <div class="total-row">
      <span class="total-label">Paid via ${(sale.payment_method || 'cash').toUpperCase()}:</span>
      <span class="total-value">${formatCurrency(amountPaid, currencySymbol)}</span>
    </div>
    ${changeDue > 0 ? `
    <div class="total-row" style="color:#006400;">
      <span class="total-label">Change Due:</span>
      <span class="total-value">${formatCurrency(changeDue, currencySymbol)}</span>
    </div>
    ` : ''}
  </div>

  <!-- Note Section -->
  ${sale.note ? `
  <div class="note-section">
    <strong>Note:</strong> ${escapeHtml(sale.note)}
  </div>
  ` : ''}

  <!-- QR Code -->
  ${qrCodeHTML}

  <!-- Footer -->
  <div class="receipt-footer">
    <div class="footer-note">${footer}</div>
    <div style="margin: 4px 0; font-size: 8px;">
      Transaction ID: ${sale.sale_id}-${Date.now().toString(36).toUpperCase()}
    </div>
    <div class="software-by">
      Generated on ${dateStr} at ${timeStr} • Software by AByte ERP
    </div>
  </div>

  <script>
    // Auto-print after delay if enabled
    if (window.location.search.includes('autoprint=true')) {
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          if (window.opener) {
            window.close();
          }
        }, 500);
      }, 500);
    }
    
    // Copy receipt text to clipboard
    function copyReceiptText() {
      const receiptText = document.body.innerText;
      navigator.clipboard.writeText(receiptText).then(() => {
        console.log('Receipt copied to clipboard');
      });
    }
  </script>
</body>
</html>`;
}

export function printReceipt(
  sale: ReceiptSale,
  settings: ReceiptSettings | null = null,
  cashierName: string,
  customerName?: string,
  printOptions: PrintOptions = {}
): void {
  const {
    showPrintDialog = true,
    printTimeout = 400,
    copyToClipboard = false,
    openInNewWindow = false  // default: iframe (no popup window)
  } = printOptions;

  const html = generateReceiptHTML(sale, settings, cashierName, customerName);

  if (openInNewWindow) {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      // Fallback to iframe
      printUsingIframe(html, showPrintDialog, printTimeout);
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Add print styles
    const style = printWindow.document.createElement('style');
    style.textContent = `
      @media print {
        body { margin: 0; padding: 2mm; }
        button { display: none; }
      }
    `;
    printWindow.document.head.appendChild(style);

    // Add print button for testing
    const printButton = printWindow.document.createElement('button');
    printButton.textContent = 'Print Receipt';
    printButton.style.cssText = `
      position: fixed; 
      top: 10px; 
      right: 10px; 
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      z-index: 1000;
    `;
    printButton.onclick = () => printWindow.print();
    printWindow.document.body.appendChild(printButton);

    if (showPrintDialog) {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        // Optionally close after printing
        // printWindow.onafterprint = () => printWindow.close();
      }, printTimeout);
    }
  } else {
    printUsingIframe(html, showPrintDialog, printTimeout);
  }

  // Copy to clipboard if enabled
  if (copyToClipboard && navigator.clipboard) {
    setTimeout(() => {
      const plainText = generatePlainTextReceipt(sale, settings, cashierName, customerName);
      navigator.clipboard.writeText(plainText).catch(console.error);
    }, 100);
  }
}

function printUsingIframe(html: string, showPrintDialog: boolean, printTimeout: number): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.left = '-1000px';
  iframe.style.top = '-1000px';
  
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error('Unable to create print iframe');
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  if (showPrintDialog) {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Cleanup after print dialog closes
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 5000);
    }, printTimeout);
  }
}

export function generatePlainTextReceipt(
  sale: ReceiptSale,
  settings: ReceiptSettings | null = null,
  cashierName: string,
  customerName?: string
): string {
  const storeName = settings?.store_name || 'AByte ERP';
  const storeAddress = settings?.address || '';
  const storePhone = settings?.phone || '';
  const cashier = cashierName || 'Staff';
  
  const totalAmount = parseNumber(sale.total_amount);
  const discount = parseNumber(sale.discount);
  const taxAmount = parseNumber(sale.tax_amount);
  const taxPercent = parseNumber(sale.tax_percent);
  const chargesAmount = parseNumber(sale.additional_charges_amount);
  const amountPaid = parseNumber(sale.amount_paid);
  const changeDue = Math.max(0, amountPaid - totalAmount);
  const subtotal = totalAmount - taxAmount - chargesAmount + discount;
  
  const saleDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateStr = saleDate.toLocaleDateString();
  const timeStr = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  let text = `==============================\n`;
  text += `        ${storeName}\n`;
  if (storeAddress) text += `${storeAddress}\n`;
  if (storePhone) text += `Tel: ${storePhone}\n`;
  text += `==============================\n\n`;
  
  if (sale.invoice_no) {
    text += `Invoice: ${sale.invoice_no}\n`;
  } else {
    text += `Receipt #: ${sale.sale_id}\n`;
  }
  if (sale.token_no) text += `Token: ${sale.token_no}\n`;
  text += `Date: ${dateStr} ${timeStr}\n`;
  text += `Cashier: ${cashier}\n`;
  if (customerName) text += `Customer: ${customerName}\n`;
  text += `\n`;
  text += `Items:\n`;
  text += `------------------------------\n`;
  
  sale.items.forEach(item => {
    const qty = item.quantity;
    const price = parseNumber(item.unit_price);
    const lineTotal = (qty * price).toFixed(2);
    text += `${item.product_name}\n`;
    text += `  ${qty} x $${price.toFixed(2)} = $${lineTotal}\n`;
  });
  
  text += `------------------------------\n`;
  text += `Subtotal: $${subtotal.toFixed(2)}\n`;
  if (taxAmount > 0) text += `Tax (${taxPercent}%): $${taxAmount.toFixed(2)}\n`;
  if (chargesAmount > 0) text += `Charges: $${chargesAmount.toFixed(2)}\n`;
  if (discount > 0) text += `Discount: -$${discount.toFixed(2)}\n`;
  text += `TOTAL: $${totalAmount.toFixed(2)}\n\n`;
  
  text += `Paid (${sale.payment_method || 'cash'}): $${amountPaid.toFixed(2)}\n`;
  if (changeDue > 0) text += `Change: $${changeDue.toFixed(2)}\n\n`;
  
  if (sale.note) text += `Note: ${sale.note}\n\n`;
  
  text += `==============================\n`;
  text += `Thank you for shopping!\n`;
  text += `Software by AByte ERP\n`;
  text += `==============================\n`;
  
  return text;
}

// Utility function to download receipt as PDF/Text file
export function downloadReceipt(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName?: string,
  format: 'text' | 'html' = 'text'
): void {
  let content: string;
  let filename: string;
  let mimeType: string;
  
  if (format === 'html') {
    content = generateReceiptHTML(sale, settings, cashierName, customerName);
    filename = `receipt_${sale.sale_id}_${Date.now()}.html`;
    mimeType = 'text/html';
  } else {
    content = generatePlainTextReceipt(sale, settings, cashierName, customerName);
    filename = `receipt_${sale.sale_id}_${Date.now()}.txt`;
    mimeType = 'text/plain';
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Check if thermal printer is configured (backend-based)
export function isThermalPrinterAvailable(_settings: any): boolean {
  // Always try thermal path — agent check happens inside printToThermalPrinter
  return true;
}

// Send receipt to thermal printer.
// Strategy:
//   1. Local Printer Agent (localhost:3001) — runs on cashier PC, works everywhere
//   2. Backend API (localhost backend) — direct TCP from server to printer
//   3. QZ Tray — local agent for cloud deployments
//   4. Fallback — browser window.print() dialog
export async function printToThermalPrinter(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName?: string
): Promise<boolean> {
  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

  const totalAmount = parseNumber(sale.total_amount);
  const discount    = parseNumber(sale.discount);
  const taxAmount   = parseNumber(sale.tax_amount);
  const taxPercent  = parseNumber(sale.tax_percent);
  const chargesAmount = parseNumber(sale.additional_charges_amount);
  const amountPaid  = parseNumber(sale.amount_paid);

  const receiptData = {
    storeName:      settings?.store_name || 'AByte ERP',
    storeAddress:   settings?.address || '',
    storePhone:     settings?.phone || '',
    storeEmail:     settings?.email || '',
    saleId:         sale.sale_id,
    invoiceNo:      sale.invoice_no,
    tokenNo:        sale.token_no,
    date:           sale.sale_date ? new Date(sale.sale_date).toLocaleString() : new Date().toLocaleString(),
    cashierName,
    customerName:   customerName || '',
    currencySymbol: settings?.currency_symbol || 'Rs.',
    items: (sale.items || []).map(item => ({
      name:     item.product_name,
      quantity: item.quantity,
      price:    parseNumber(item.unit_price),
    })),
    subtotal:     totalAmount - taxAmount - chargesAmount + discount,
    discount,
    taxAmount,
    taxPercent,
    chargesAmount,
    totalAmount,
    amountPaid,
    changeDue:    Math.max(0, amountPaid - totalAmount),
    paymentMethod: sale.payment_method,
    footer:       settings?.receipt_footer || 'Thank you for shopping!',
  };

  // ── 1. Local Printer Agent — highest priority ──────────────────────
  const printerAgentUrl = import.meta.env.VITE_PRINTER_AGENT_URL || 'http://localhost:3001';
  try {
    const agentRes = await fetch(`${printerAgentUrl}/health`, { signal: AbortSignal.timeout(1000) });
    if (agentRes.ok) {
      const printRes = await fetch(`${printerAgentUrl}/print/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptData }),
      });
      if (printRes.ok) return true;
      const err = await printRes.json().catch(() => ({}));
      console.warn('Printer agent print failed:', err.error || err.message);
    }
  } catch {
    // Agent not running — try next method
  }

  // ── 2. Localhost: use backend API (server on same LAN as printer) ──
  if (isLocalhost) {
    try {
      await api.post('/settings/print-receipt', { receiptData });
      return true;
    } catch (err) {
      console.warn('Backend print failed, falling back to browser print:', err);
      printReceipt(sale, settings, cashierName, customerName);
      return false;
    }
  }

  // ── 3. Deployed: try QZ Tray (local agent on cashier PC) ────────────
  try {
    const { isQZAvailable, printViaQZ } = await import('./qzPrinter');
    const qzReady = await isQZAvailable();
    if (qzReady) {
      // Get printer IP/port from settings (stored as printer_ip / printer_port in DB)
      const printerIp   = (settings as any)?.printer_ip;
      const printerPort = (settings as any)?.printer_port || 9100;
      if (printerIp) {
        await printViaQZ(printerIp, printerPort, receiptData);
        return true;
      }
      // Printer IP not configured — try named printer as fallback
      const { printViaQZByName } = await import('./qzPrinter');
      const printerName = (settings as any)?.printer_name;
      if (printerName) {
        await printViaQZByName(printerName, receiptData);
        return true;
      }
    }
  } catch (err) {
    console.warn('QZ Tray print failed:', err);
  }

  // ── 4. Final fallback: browser print dialog ──────────────────────────
  printReceipt(sale, settings, cashierName, customerName);
  return false;
}

// ── Print Cash / Print Card Bill ─────────────────────────────────────────────
// Recalculates tax at the given rate and prints a clearly labelled bill.
// The stored sale data is never modified — this only affects the printed copy.
export function printBillWithTax(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName: string | undefined,
  taxType: 'cash' | 'card' | 'online',
  taxRate: number
): void {
  const parseNum = (v: any) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;

  const origTaxAmount     = parseNum(sale.tax_amount);
  const origChargesAmount = parseNum(sale.additional_charges_amount);
  const origDiscount      = parseNum(sale.discount);
  const origTotal         = parseNum(sale.total_amount);
  const subtotal          = origTotal - origTaxAmount - origChargesAmount + origDiscount;

  const newTaxAmount  = subtotal * taxRate / 100;
  const newTotal      = subtotal + newTaxAmount + origChargesAmount - origDiscount;
  const billLabel     = taxType === 'cash' ? 'CASH BILL' : taxType === 'card' ? 'CARD BILL' : 'ONLINE BILL';

  const modifiedSale: ReceiptSale = {
    ...sale,
    tax_percent: taxRate,
    tax_amount: newTaxAmount,
    total_amount: newTotal,
    amount_paid: newTotal,
    payment_method: taxType,
  };

  const modifiedSettings: ReceiptSettings = {
    ...(settings || {}),
    header_note: `★ ${billLabel} ★`,
  };

  printReceipt(modifiedSale, modifiedSettings, cashierName, customerName);
}