export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export type FulfillmentStatus = 'unfulfilled' | 'fulfilled' | 'cancelled' | 'returned';

export type PaymentMethodType = 'cod' | 'stripe' | 'paypal' | 'card_mock';

export type InventoryAdjustmentReason =
  | 'manual_adjustment'
  | 'order_placed'
  | 'order_cancelled'
  | 'restock'
  | 'damage'
  | 'initial_setup';

export interface ProductVariantOption {
  name: string;
  sku?: string;
  price_pkr: number;
  stock: number;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  options: ProductVariantOption[];
}

export interface ProductSEO {
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  sku?: string;
  description?: string;
  price_pkr: number;
  compare_at_price_pkr?: number | null;
  cost_price_pkr?: number | null;
  stock: number;
  low_stock_threshold: number;
  category?: string;
  images: string[];
  variants: ProductVariantGroup[];
  seo: ProductSEO;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  name: string;
  sku?: string;
  unit_price_pkr: number;
  quantity: number;
  total_price_pkr: number;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  changed_at: string;
  actor: string;
  notes?: string;
}

export interface Order {
  id: string;
  store_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address: string;
  city: string;
  payment_method: PaymentMethodType;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  subtotal_pkr: number;
  shipping_fee_pkr: number;
  tax_pkr: number;
  total_pkr: number;
  status: OrderStatus;
  status_history: OrderStatusHistoryItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface Customer {
  id: string;
  store_id: string;
  full_name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  total_orders: number;
  total_spend_pkr: number;
  last_order_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryLog {
  id: string;
  store_id: string;
  product_id: string;
  delta: number;
  previous_stock: number;
  new_stock: number;
  reason: InventoryAdjustmentReason;
  actor_id?: string | null;
  created_at: string;
  product_name?: string;
}

export interface StorePaymentSettings {
  id: string;
  store_id: string;
  cod_enabled: boolean;
  stripe_enabled: boolean;
  stripe_account_id?: string | null;
  paypal_enabled: boolean;
  paypal_email?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreOverviewKPIs {
  store: {
    id: string;
    name: string;
    slug: string;
    status: 'draft' | 'published' | 'suspended';
    currency: string;
    custom_domain?: string | null;
  };
  total_orders: number;
  total_revenue_pkr: number;
  active_products: number;
  low_stock_count: number;
  unfulfilled_orders_count: number;
  recent_orders: Order[];
  low_stock_products: Product[];
  is_sandbox: boolean;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  store: {
    name: string;
    slug: string;
    currency: string;
  };
  customer: {
    name: string;
    phone: string;
    email?: string;
    shipping_address: string;
    city: string;
  };
  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    unit_price_pkr: number;
    total_price_pkr: number;
  }>;
  subtotal_pkr: number;
  shipping_fee_pkr: number;
  tax_pkr: number;
  total_pkr: number;
  payment_method: string;
  payment_status: string;
  notes?: string;
}
