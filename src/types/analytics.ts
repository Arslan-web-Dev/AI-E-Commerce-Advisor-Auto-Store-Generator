/**
 * Module 9: Analytics Domain Types & Contracts
 * AI E-Commerce Advisor & Auto Store Generator
 */

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase';

export type AnalyticsDateRangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface StoreAnalyticsEvent {
  id: string;
  store_id: string;
  session_id: string;
  event_type: AnalyticsEventType;
  product_id?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface MetricDelta {
  grossSalesDeltaPercent: number;
  netRevenueDeltaPercent: number;
  ordersDeltaPercent: number;
  visitorsDeltaPercent: number;
  aovDeltaPercent: number;
}

export interface AnalyticsKpiSummary {
  grossSalesPkr: number;
  netRevenuePkr: number;
  totalOrders: number;
  averageOrderValuePkr: number;
  visitorsCount: number;
  pageViewsCount: number;
  conversionRatePercent: number;
  cartAbandonmentRatePercent: number;
  cancelledOrdersCount: number;
  cancelledOrdersAmountPkr: number;
  returnedOrdersCount: number;
  returnedOrdersAmountPkr: number;
  periodStart: string;
  periodEnd: string;
  delta?: MetricDelta;
  hasEventTracking: boolean;
}

export interface AnalyticsTimeSeriesPoint {
  date: string;
  label: string;
  grossSalesPkr: number;
  netRevenuePkr: number;
  orders: number;
  visitors: number;
  pageViews: number;
}

export interface ProductPerformanceItem {
  productId: string;
  productName: string;
  views: number;
  unitsSold: number;
  revenuePkr: number;
  conversionRatePercent: number;
}

export interface FunnelStageItem {
  stage: 'Visitors' | 'Product Views' | 'Added to Cart' | 'Checkout Started' | 'Purchased';
  key: AnalyticsEventType | 'visitors';
  count: number;
  conversionFromFirstPercent: number;
  dropoffPercent: number;
}

export interface TrafficSourceItem {
  source: string;
  count: number;
  percentage: number;
}

export interface CartAbandonmentAnalysis {
  cartsStarted: number;
  cartsPurchased: number;
  cartsAbandoned: number;
  abandonmentRatePercent: number;
  isAvailable: boolean;
  notes: string;
}

export interface StoreAnalyticsReport {
  storeId: string;
  storeName: string;
  currency: string;
  generatedAt: string;
  dateRange: {
    preset: AnalyticsDateRangePreset;
    startDate: string;
    endDate: string;
  };
  kpis: AnalyticsKpiSummary;
  trends: AnalyticsTimeSeriesPoint[];
  topProducts: ProductPerformanceItem[];
  funnel: FunnelStageItem[];
  trafficSources: TrafficSourceItem[];
  abandonment: CartAbandonmentAnalysis;
  dataLimitations: string[];
}
