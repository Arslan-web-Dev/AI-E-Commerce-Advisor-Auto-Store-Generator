/**
 * Module 9: Executive Analytics Report Generator
 * Generates an XSS-safe, print-ready HTML/PDF executive analytics report.
 */

import { StoreAnalyticsReport } from '@/types/analytics';
import { escapeHtml } from '@/lib/store-management/invoice';

export function generateAnalyticsReportHtml(report: StoreAnalyticsReport): string {
  const storeName = escapeHtml(report.storeName || 'Generated Store');
  const dateRangeLabel = `${escapeHtml(report.dateRange.startDate)} to ${escapeHtml(report.dateRange.endDate)}`;
  const generatedAt = new Date(report.generatedAt).toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const kpis = report.kpis;

  const topProductsRows = report.topProducts.slice(0, 8).map((p, idx) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569;">#${idx + 1}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #1e293b;">${escapeHtml(p.productName)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #475569;">${p.views.toLocaleString()}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 600; color: #1e293b;">${p.unitsSold.toLocaleString()}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 700; color: #059669;">Rs. ${p.revenuePkr.toLocaleString()}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #475569;">${p.conversionRatePercent}%</td>
    </tr>
  `).join('');

  const funnelRows = report.funnel.map((f) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #1e293b;">${escapeHtml(f.stage)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 600; color: #1e293b;">${f.count.toLocaleString()}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #059669;">${f.conversionFromFirstPercent}%</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #dc2626;">${f.dropoffPercent}%</td>
    </tr>
  `).join('');

  const trafficRows = report.trafficSources.map((t) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">${escapeHtml(t.source)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 600;">${t.count.toLocaleString()}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #475569;">${t.percentage}%</td>
    </tr>
  `).join('');

  const limitationsList = report.dataLimitations.map((lim) => `
    <li style="margin-bottom: 6px; color: #64748b; font-size: 12px; line-height: 1.5;">${escapeHtml(lim)}</li>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Analytics Report - ${storeName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
    }
    .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 6px; }
    .kpi-value { font-size: 20px; font-weight: 700; color: #0f172a; }
    .section-title { font-size: 16px; font-weight: 700; margin-top: 24px; margin-bottom: 12px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    .no-print { margin-bottom: 20px; display: flex; gap: 10px; }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a;">${storeName}</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">E-Commerce Executive Performance & Analytics Report</p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Period: ${dateRangeLabel}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Generated: ${generatedAt} (PKR)</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Gross Sales</div>
      <div class="kpi-value" style="color: #059669;">Rs. ${kpis.grossSalesPkr.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Net Revenue</div>
      <div class="kpi-value" style="color: #0284c7;">Rs. ${kpis.netRevenuePkr.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Orders Placed</div>
      <div class="kpi-value">${kpis.totalOrders.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Average Order Value</div>
      <div class="kpi-value">Rs. ${kpis.averageOrderValuePkr.toLocaleString()}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Visitors</div>
      <div class="kpi-value">${kpis.visitorsCount.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Page Views</div>
      <div class="kpi-value">${kpis.pageViewsCount.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Conversion Rate</div>
      <div class="kpi-value">${kpis.conversionRatePercent}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Cart Abandonment</div>
      <div class="kpi-value">${report.abandonment.isAvailable ? `${kpis.cartAbandonmentRatePercent}%` : 'N/A'}</div>
    </div>
  </div>

  <div class="section-title">Top Performing Products</div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">Rank</th>
        <th>Product Name</th>
        <th style="text-align: right;">Views</th>
        <th style="text-align: right;">Units Sold</th>
        <th style="text-align: right;">Revenue (PKR)</th>
        <th style="text-align: right;">Conv. Rate</th>
      </tr>
    </thead>
    <tbody>
      ${topProductsRows || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No product transactions recorded in this period.</td></tr>'}
    </tbody>
  </table>

  <div class="two-col">
    <div>
      <div class="section-title">Customer Conversion Funnel</div>
      <table>
        <thead>
          <tr>
            <th>Stage</th>
            <th style="text-align: right;">Count</th>
            <th style="text-align: right;">Conv. %</th>
            <th style="text-align: right;">Dropoff %</th>
          </tr>
        </thead>
        <tbody>
          ${funnelRows}
        </tbody>
      </table>
    </div>

    <div>
      <div class="section-title">Traffic & Attribution Sources</div>
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th style="text-align: right;">Visits</th>
            <th style="text-align: right;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${trafficRows.length > 0 ? trafficRows : '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8;">No traffic telemetry captured yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section-title">Data Limitations & Compliance Notes</div>
  <ul style="padding-left: 18px; margin-top: 8px;">
    ${limitationsList}
  </ul>

  <div class="footer">
    Generated by AI E-Commerce Advisor & Auto Store Generator — Multi-Tenant Merchant Intelligence
  </div>
</body>
</html>`;
}
