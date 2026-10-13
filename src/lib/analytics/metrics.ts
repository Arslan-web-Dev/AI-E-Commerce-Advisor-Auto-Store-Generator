/**
 * Module 9: Analytics Metrics Calculation Engine
 * Strict, deterministic, zero-division safe formulas for E-Commerce analytics.
 */

import {
  AnalyticsKpiSummary,
  AnalyticsTimeSeriesPoint,
  ProductPerformanceItem,
  FunnelStageItem,
  TrafficSourceItem,
  CartAbandonmentAnalysis,
  MetricDelta,
} from '@/types/analytics';

export interface RawOrderRecord {
  id: string;
  total_pkr: number;
  status: string;
  created_at: string;
}

export interface RawOrderItemRecord {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  total_price_pkr: number;
}

export interface RawProductRecord {
  id: string;
  name: string;
  price_pkr: number;
}

export interface RawEventRecord {
  id: string;
  session_id: string;
  event_type: string;
  product_id?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  created_at: string;
}

/**
 * Computes percentage delta between current and previous period.
 * Returns 0 if previous is 0.
 */
export function calculateDeltaPercent(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta * 10) / 10;
}

/**
 * Calculates high-integrity sales KPIs from raw order records.
 * Rules:
 * - Gross Sales: sum of orders where status != 'cancelled'
 * - Net Revenue: sum of ('confirmed','packed','shipped','delivered') minus ('returned')
 * - AOV: Net Revenue / Eligible Orders count
 */
export function calculateOrderMetrics(
  currentOrders: RawOrderRecord[],
  prevOrders: RawOrderRecord[],
  events: RawEventRecord[],
  periodStart: string,
  periodEnd: string
): AnalyticsKpiSummary {
  // Current Period Orders
  let grossSalesPkr = 0;
  let netRevenuePkr = 0;
  let fulfilledCount = 0;
  let cancelledCount = 0;
  let cancelledAmountPkr = 0;
  let returnedCount = 0;
  let returnedAmountPkr = 0;

  for (const o of currentOrders) {
    const amount = Number(o.total_pkr || 0);

    if (o.status === 'cancelled') {
      cancelledCount += 1;
      cancelledAmountPkr += amount;
      continue;
    }

    grossSalesPkr += amount;

    if (o.status === 'returned') {
      returnedCount += 1;
      returnedAmountPkr += amount;
    } else if (['confirmed', 'packed', 'shipped', 'delivered'].includes(o.status)) {
      netRevenuePkr += amount;
      fulfilledCount += 1;
    }
  }

  // Deduct returns from net revenue
  netRevenuePkr = Math.max(0, netRevenuePkr - returnedAmountPkr);

  const averageOrderValuePkr =
    fulfilledCount > 0 ? Math.round(netRevenuePkr / fulfilledCount) : 0;

  // Telemetry event counts
  const distinctSessions = new Set<string>();
  let pageViewsCount = 0;

  for (const e of events) {
    if (e.session_id) distinctSessions.add(e.session_id);
    if (e.event_type === 'page_view') pageViewsCount += 1;
  }

  const visitorsCount = distinctSessions.size;
  const hasEventTracking = events.length > 0;

  // Conversion rate (orders / visitors)
  const conversionRatePercent =
    visitorsCount > 0
      ? Math.round((fulfilledCount / visitorsCount) * 1000) / 10
      : 0;

  // Cart abandonment rate
  const cartSessions = new Set<string>();
  const purchaseSessions = new Set<string>();

  for (const e of events) {
    if (e.event_type === 'add_to_cart') cartSessions.add(e.session_id);
    if (e.event_type === 'purchase') purchaseSessions.add(e.session_id);
  }

  let cartAbandonmentRatePercent = 0;
  if (cartSessions.size > 0) {
    let abandoned = 0;
    cartSessions.forEach((sid) => {
      if (!purchaseSessions.has(sid)) abandoned += 1;
    });
    cartAbandonmentRatePercent = Math.round((abandoned / cartSessions.size) * 1000) / 10;
  }

  // Calculate previous period for comparison delta
  let prevGross = 0;
  let prevNet = 0;
  let prevFulfilled = 0;
  for (const po of prevOrders) {
    const amt = Number(po.total_pkr || 0);
    if (po.status !== 'cancelled') prevGross += amt;
    if (['confirmed', 'packed', 'shipped', 'delivered'].includes(po.status)) {
      prevNet += amt;
      prevFulfilled += 1;
    }
  }
  const prevAov = prevFulfilled > 0 ? Math.round(prevNet / prevFulfilled) : 0;

  const delta: MetricDelta = {
    grossSalesDeltaPercent: calculateDeltaPercent(grossSalesPkr, prevGross),
    netRevenueDeltaPercent: calculateDeltaPercent(netRevenuePkr, prevNet),
    ordersDeltaPercent: calculateDeltaPercent(fulfilledCount, prevFulfilled),
    visitorsDeltaPercent: 0,
    aovDeltaPercent: calculateDeltaPercent(averageOrderValuePkr, prevAov),
  };

  return {
    grossSalesPkr,
    netRevenuePkr,
    totalOrders: currentOrders.length,
    averageOrderValuePkr,
    visitorsCount,
    pageViewsCount,
    conversionRatePercent,
    cartAbandonmentRatePercent,
    cancelledOrdersCount: cancelledCount,
    cancelledOrdersAmountPkr: cancelledAmountPkr,
    returnedOrdersCount: returnedCount,
    returnedOrdersAmountPkr: returnedAmountPkr,
    periodStart,
    periodEnd,
    delta,
    hasEventTracking,
  };
}

/**
 * Daily time series generator for trend visualizations.
 */
export function generateDailyTrends(
  orders: RawOrderRecord[],
  events: RawEventRecord[],
  daysCount = 7
): AnalyticsTimeSeriesPoint[] {
  const points: AnalyticsTimeSeriesPoint[] = [];
  const now = new Date();

  // Create date buckets (oldest to newest)
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });

    points.push({
      date: dateStr,
      label,
      grossSalesPkr: 0,
      netRevenuePkr: 0,
      orders: 0,
      visitors: 0,
      pageViews: 0,
    });
  }

  const pointMap = new Map<string, AnalyticsTimeSeriesPoint>();
  const sessionMap = new Map<string, Set<string>>();
  for (const pt of points) {
    pointMap.set(pt.date, pt);
    sessionMap.set(pt.date, new Set<string>());
  }

  // Populate orders
  for (const ord of orders) {
    const dateKey = ord.created_at.split('T')[0];
    const pt = pointMap.get(dateKey);
    if (!pt) continue;

    const amt = Number(ord.total_pkr || 0);
    if (ord.status !== 'cancelled') {
      pt.grossSalesPkr += amt;
    }
    if (['confirmed', 'packed', 'shipped', 'delivered'].includes(ord.status)) {
      pt.netRevenuePkr += amt;
      pt.orders += 1;
    }
  }

  // Populate events
  for (const evt of events) {
    const dateKey = evt.created_at.split('T')[0];
    const pt = pointMap.get(dateKey);
    if (!pt) continue;

    if (evt.event_type === 'page_view') {
      pt.pageViews += 1;
    }
    if (evt.session_id) {
      sessionMap.get(dateKey)?.add(evt.session_id);
    }
  }

  // Set visitor counts per day
  for (const pt of points) {
    pt.visitors = sessionMap.get(pt.date)?.size || 0;
  }

  return points;
}

/**
 * Aggregates product catalog performance (views, units sold, revenue, conversion rate).
 */
export function aggregateProductPerformance(
  products: RawProductRecord[],
  orderItems: RawOrderItemRecord[],
  events: RawEventRecord[]
): ProductPerformanceItem[] {
  const viewsMap = new Map<string, number>();
  const unitsMap = new Map<string, number>();
  const revenueMap = new Map<string, number>();

  // Count product views
  for (const evt of events) {
    if (evt.event_type === 'product_view' && evt.product_id) {
      viewsMap.set(evt.product_id, (viewsMap.get(evt.product_id) || 0) + 1);
    }
  }

  // Count items sold and revenue
  for (const item of orderItems) {
    if (item.product_id) {
      unitsMap.set(
        item.product_id,
        (unitsMap.get(item.product_id) || 0) + Number(item.quantity || 0)
      );
      revenueMap.set(
        item.product_id,
        (revenueMap.get(item.product_id) || 0) + Number(item.total_price_pkr || 0)
      );
    }
  }

  const items: ProductPerformanceItem[] = products.map((prod) => {
    const views = viewsMap.get(prod.id) || 0;
    const unitsSold = unitsMap.get(prod.id) || 0;
    const revenuePkr = revenueMap.get(prod.id) || 0;
    const conversionRatePercent =
      views > 0 ? Math.round((unitsSold / views) * 1000) / 10 : 0;

    return {
      productId: prod.id,
      productName: prod.name,
      views,
      unitsSold,
      revenuePkr,
      conversionRatePercent,
    };
  });

  // Sort descending by revenue, then units sold
  items.sort((a, b) => b.revenuePkr - a.revenuePkr || b.unitsSold - a.unitsSold);

  return items;
}

/**
 * Computes step-by-step conversion funnel.
 */
export function computeFunnel(
  events: RawEventRecord[],
  fulfilledOrdersCount: number
): FunnelStageItem[] {
  const sessions = new Set<string>();
  let productViewsCount = 0;
  let cartAddsCount = 0;
  let checkoutsCount = 0;

  for (const e of events) {
    if (e.session_id) sessions.add(e.session_id);
    if (e.event_type === 'product_view') productViewsCount += 1;
    if (e.event_type === 'add_to_cart') cartAddsCount += 1;
    if (e.event_type === 'begin_checkout') checkoutsCount += 1;
  }

  const visitorsCount = sessions.size;
  const baseCount = Math.max(1, visitorsCount);

  const stages: FunnelStageItem[] = [
    {
      stage: 'Visitors',
      key: 'visitors',
      count: visitorsCount,
      conversionFromFirstPercent: 100,
      dropoffPercent: 0,
    },
    {
      stage: 'Product Views',
      key: 'product_view',
      count: productViewsCount,
      conversionFromFirstPercent: Math.round((productViewsCount / baseCount) * 1000) / 10,
      dropoffPercent:
        visitorsCount > 0
          ? Math.max(0, Math.round(((visitorsCount - productViewsCount) / visitorsCount) * 1000) / 10)
          : 0,
    },
    {
      stage: 'Added to Cart',
      key: 'add_to_cart',
      count: cartAddsCount,
      conversionFromFirstPercent: Math.round((cartAddsCount / baseCount) * 1000) / 10,
      dropoffPercent:
        productViewsCount > 0
          ? Math.max(0, Math.round(((productViewsCount - cartAddsCount) / productViewsCount) * 1000) / 10)
          : 0,
    },
    {
      stage: 'Checkout Started',
      key: 'begin_checkout',
      count: checkoutsCount,
      conversionFromFirstPercent: Math.round((checkoutsCount / baseCount) * 1000) / 10,
      dropoffPercent:
        cartAddsCount > 0
          ? Math.max(0, Math.round(((cartAddsCount - checkoutsCount) / cartAddsCount) * 1000) / 10)
          : 0,
    },
    {
      stage: 'Purchased',
      key: 'purchase',
      count: fulfilledOrdersCount,
      conversionFromFirstPercent: Math.round((fulfilledOrdersCount / baseCount) * 1000) / 10,
      dropoffPercent:
        checkoutsCount > 0
          ? Math.max(0, Math.round(((checkoutsCount - fulfilledOrdersCount) / checkoutsCount) * 1000) / 10)
          : 0,
    },
  ];

  return stages;
}

/**
 * Computes traffic source breakdown from referrers and UTM parameters.
 */
export function computeTrafficSources(events: RawEventRecord[]): TrafficSourceItem[] {
  if (events.length === 0) {
    return [];
  }

  const counts: Record<string, number> = {
    'Direct / Internal': 0,
    'Google Search': 0,
    'Social Media (Instagram/TikTok)': 0,
    'Referral Link': 0,
    'Campaign / UTM': 0,
  };

  let totalTagged = 0;

  for (const evt of events) {
    if (evt.event_type !== 'page_view') continue;
    totalTagged += 1;

    if (evt.utm_source) {
      counts['Campaign / UTM'] += 1;
    } else if (!evt.referrer || evt.referrer === '' || evt.referrer.includes('localhost') || evt.referrer.includes('myshop')) {
      counts['Direct / Internal'] += 1;
    } else if (evt.referrer.includes('google') || evt.referrer.includes('bing')) {
      counts['Google Search'] += 1;
    } else if (
      evt.referrer.includes('instagram') ||
      evt.referrer.includes('facebook') ||
      evt.referrer.includes('tiktok') ||
      evt.referrer.includes('whatsapp')
    ) {
      counts['Social Media (Instagram/TikTok)'] += 1;
    } else {
      counts['Referral Link'] += 1;
    }
  }

  if (totalTagged === 0) totalTagged = 1;

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({
      source,
      count,
      percentage: Math.round((count / totalTagged) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Computes cart abandonment analysis with defensive flags.
 */
export function computeCartAbandonment(
  events: RawEventRecord[],
  fulfilledOrdersCount: number
): CartAbandonmentAnalysis {
  const cartSessions = new Set<string>();
  const purchaseSessions = new Set<string>();

  for (const e of events) {
    if (e.event_type === 'add_to_cart') cartSessions.add(e.session_id);
    if (e.event_type === 'purchase') purchaseSessions.add(e.session_id);
  }

  const cartsStarted = cartSessions.size;

  if (cartsStarted === 0) {
    return {
      cartsStarted: 0,
      cartsPurchased: fulfilledOrdersCount,
      cartsAbandoned: 0,
      abandonmentRatePercent: 0,
      isAvailable: false,
      notes: 'No add-to-cart events recorded in the selected period. Cart abandonment metric is unavailable.',
    };
  }

  let abandoned = 0;
  cartSessions.forEach((sid) => {
    if (!purchaseSessions.has(sid)) abandoned += 1;
  });

  const abandonmentRate = Math.round((abandoned / cartsStarted) * 1000) / 10;

  return {
    cartsStarted,
    cartsPurchased: purchaseSessions.size,
    cartsAbandoned: abandoned,
    abandonmentRatePercent: abandonmentRate,
    isAvailable: true,
    notes: `Derived from ${cartsStarted} cart sessions within the reporting window.`,
  };
}
