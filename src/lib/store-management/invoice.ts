import { InvoiceData } from '@/types/store-management';

/**
 * Escapes HTML characters to prevent XSS in rendered invoice output.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates an accessible, print-ready, styled HTML invoice document.
 */
export function generateInvoiceHtml(data: InvoiceData): string {
  const storeName = escapeHtml(data.store.name);
  const storeSlug = escapeHtml(data.store.slug);
  const orderNumber = escapeHtml(data.invoice_number);
  const invoiceDate = escapeHtml(data.invoice_date);
  const customerName = escapeHtml(data.customer.name);
  const customerPhone = escapeHtml(data.customer.phone);
  const customerEmail = data.customer.email ? escapeHtml(data.customer.email) : '';
  const shippingAddress = escapeHtml(data.customer.shipping_address);
  const city = escapeHtml(data.customer.city);
  const paymentMethod = escapeHtml(data.payment_method.toUpperCase());
  const paymentStatus = escapeHtml(data.payment_status.toUpperCase());
  const notes = data.notes ? escapeHtml(data.notes) : '';

  const itemsRows = data.items
    .map(
      (item, idx) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 12px; font-size: 13px; color: #374151;">${idx + 1}</td>
      <td style="padding: 10px 12px; font-size: 13px; font-weight: 500; color: #111827;">
        ${escapeHtml(item.name)}
        ${item.sku ? `<div style="font-size: 11px; color: #6b7280; font-family: monospace;">SKU: ${escapeHtml(item.sku)}</div>` : ''}
      </td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #374151;">${item.quantity}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; color: #374151;">Rs. ${Number(item.unit_price_pkr).toLocaleString()}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-weight: 600; color: #111827;">Rs. ${Number(item.total_price_pkr).toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${orderNumber} — ${storeName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 30px;
      background: #ffffff;
      color: #1f2937;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 36px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    @media print {
      body { padding: 0; background: none; }
      .invoice-card { border: none; box-shadow: none; padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 24px;">
      <div>
        <h1 style="margin: 0; font-size: 24px; color: #065f46; font-weight: 700;">${storeName}</h1>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">storefront: ${storeSlug}.platform.pk</div>
        <div style="font-size: 12px; color: #6b7280;">Official Commercial Invoice</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: 700; color: #111827;">INVOICE</div>
        <div style="font-size: 13px; font-weight: 600; color: #059669; margin-top: 2px;">#${orderNumber}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Date: ${invoiceDate}</div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; gap: 20px;">
      <div style="flex: 1;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #9ca3af; letter-spacing: 0.05em; margin-bottom: 6px;">Billed &amp; Shipped To:</div>
        <div style="font-size: 14px; font-weight: 600; color: #111827;">${customerName}</div>
        <div style="font-size: 13px; color: #4b5563; margin-top: 2px;">Phone: ${customerPhone}</div>
        ${customerEmail ? `<div style="font-size: 13px; color: #4b5563;">Email: ${customerEmail}</div>` : ''}
        <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">${shippingAddress}, ${city}</div>
      </div>
      <div style="flex: 1; text-align: right;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #9ca3af; letter-spacing: 0.05em; margin-bottom: 6px;">Payment Information:</div>
        <div style="font-size: 13px; color: #111827;"><span style="font-weight: 600;">Method:</span> ${paymentMethod}</div>
        <div style="font-size: 13px; color: #111827; margin-top: 2px;"><span style="font-weight: 600;">Status:</span> ${paymentStatus}</div>
        <div style="font-size: 13px; color: #111827; margin-top: 2px;"><span style="font-weight: 600;">Currency:</span> PKR (Rs.)</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
          <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; text-align: left; width: 40px;">#</th>
          <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; text-align: left;">Item Description</th>
          <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; text-align: center; width: 70px;">Qty</th>
          <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; text-align: right; width: 110px;">Unit Price</th>
          <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; text-align: right; width: 120px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
      <div style="width: 280px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #4b5563; margin-bottom: 6px;">
          <span>Subtotal:</span>
          <span>Rs. ${Number(data.subtotal_pkr).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #4b5563; margin-bottom: 6px;">
          <span>Delivery / Shipping Fee:</span>
          <span>Rs. ${Number(data.shipping_fee_pkr).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #4b5563; margin-bottom: 8px;">
          <span>Sales Tax (GST):</span>
          <span>Rs. ${Number(data.tax_pkr).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #111827; border-top: 2px solid #111827; padding-top: 8px;">
          <span>Grand Total:</span>
          <span>Rs. ${Number(data.total_pkr).toLocaleString()}</span>
        </div>
      </div>
    </div>

    ${notes ? `
    <div style="background: #f9fafb; border-left: 3px solid #10b981; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 12px; color: #4b5563;">
      <span style="font-weight: 600; color: #111827;">Customer Notes:</span> ${notes}
    </div>` : ''}

    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
      Thank you for your business! This is a system-generated electronic invoice.
    </div>

    <div class="no-print" style="margin-top: 24px; text-align: center;">
      <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
        Print / Save as PDF
      </button>
    </div>
  </div>
</body>
</html>`;
}
