'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Product, Order, OrderStatus, Customer, InventoryLog, StorePaymentSettings, StoreOverviewKPIs } from '@/types/store-management';
import { getOrderStatusMeta, ALLOWED_STATUS_TRANSITIONS } from '@/lib/store-management/orders';
import { getStorePaymentProviders } from '@/lib/store-management/payments';

type ActiveTab = 'overview' | 'products' | 'inventory' | 'orders' | 'customers' | 'payments';

export default function StoreManagementPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store & Data States
  const [store, setStore] = useState<any>(null);
  const [kpis, setKpis] = useState<StoreOverviewKPIs | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings | null>(null);

  // Filters & Search
  const [productSearch, setProductSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [inventoryLowOnly, setInventoryLowOnly] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Modals & Drawers
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [orderDetailModalOpen, setOrderDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceHtml, setInvoiceHtml] = useState<string>('');

  // Form States
  const [productForm, setProductForm] = useState({
    name: '',
    slug: '',
    sku: '',
    description: '',
    price_pkr: 0,
    compare_at_price_pkr: '',
    stock: 10,
    low_stock_threshold: 5,
    category: 'Fashion',
    images: '',
    is_active: true,
  });
  const [adjustStockForm, setAdjustStockForm] = useState({
    new_stock: 0,
    reason: 'manual_adjustment',
  });
  const [transitionNotes, setTransitionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Resolve store for this project
  const loadStoreData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      // Step A: Resolve or provision store for project
      const storeRes = await fetch(`/api/projects/${projectId}/store`);
      if (storeRes.status === 401) {
        router.push(`/login?redirectTo=/projects/${projectId}/store`);
        return;
      }
      if (!storeRes.ok) {
        const errData = await storeRes.json();
        throw new Error(errData.error || 'Failed to load store for this project.');
      }
      const { store: resolvedStore } = await storeRes.json();
      setStore(resolvedStore);

      const storeId = resolvedStore.id;

      // Step B: Load overview KPIs
      const kpisRes = await fetch(`/api/stores/${storeId}/overview`);
      if (kpisRes.ok) {
        const kpisData = await kpisRes.json();
        setKpis(kpisData.kpis);
      }

      // Step C: Load products
      const prodRes = await fetch(`/api/stores/${storeId}/products`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }

      // Step D: Load orders
      const ordersRes = await fetch(`/api/stores/${storeId}/orders`);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }

      // Step E: Load customers
      const custRes = await fetch(`/api/stores/${storeId}/customers`);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.customers || []);
      }

      // Step F: Load inventory & logs
      const invRes = await fetch(`/api/stores/${storeId}/inventory`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventoryLogs(invData.recent_logs || []);
      }

      // Step G: Load payments
      const payRes = await fetch(`/api/stores/${storeId}/payments`);
      if (payRes.ok) {
        const payData = await payRes.json();
        setPaymentSettings(payData.settings);
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred loading the store dashboard.');
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  // Flash action notification
  const notifySuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // ─── Product Handlers ────────────────────────────────────────────────────────
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      slug: '',
      sku: '',
      description: '',
      price_pkr: 2500,
      compare_at_price_pkr: '',
      stock: 15,
      low_stock_threshold: 5,
      category: store?.name ? 'Retail' : 'Apparel',
      images: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
      is_active: true,
    });
    setProductModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      slug: p.slug,
      sku: p.sku || '',
      description: p.description || '',
      price_pkr: p.price_pkr,
      compare_at_price_pkr: p.compare_at_price_pkr ? String(p.compare_at_price_pkr) : '',
      stock: p.stock,
      low_stock_threshold: p.low_stock_threshold,
      category: p.category || 'General',
      images: p.images.join(', '),
      is_active: p.is_active,
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    try {
      setActionLoading(true);
      const payload = {
        name: productForm.name,
        slug: productForm.slug || undefined,
        sku: productForm.sku || undefined,
        description: productForm.description || undefined,
        price_pkr: Number(productForm.price_pkr),
        compare_at_price_pkr: productForm.compare_at_price_pkr ? Number(productForm.compare_at_price_pkr) : undefined,
        stock: Number(productForm.stock),
        low_stock_threshold: Number(productForm.low_stock_threshold),
        category: productForm.category,
        images: productForm.images ? productForm.images.split(',').map((s) => s.trim()).filter(Boolean) : [],
        is_active: productForm.is_active,
      };

      if (editingProduct) {
        const res = await fetch(`/api/stores/${store.id}/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        notifySuccess(`Product "${productForm.name}" updated successfully.`);
      } else {
        const res = await fetch(`/api/stores/${store.id}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        notifySuccess(`New product "${productForm.name}" created.`);
      }

      setProductModalOpen(false);
      loadStoreData();
    } catch (err: any) {
      alert(`Save Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveProduct = async (productId: string, name: string) => {
    if (!confirm(`Are you sure you want to archive product "${name}"? It will be removed from your catalog.`)) return;
    if (!store?.id) return;
    try {
      const res = await fetch(`/api/stores/${store.id}/products/${productId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      notifySuccess(`Product "${name}" archived.`);
      loadStoreData();
    } catch (e: any) {
      alert(`Error archiving product: ${e.message}`);
    }
  };

  // ─── Inventory Handlers ──────────────────────────────────────────────────────
  const openAdjustStock = (p: Product) => {
    setAdjustingProduct(p);
    setAdjustStockForm({
      new_stock: p.stock,
      reason: 'manual_adjustment',
    });
    setStockModalOpen(true);
  };

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id || !adjustingProduct) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/stores/${store.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjustingProduct.id,
          new_stock: Number(adjustStockForm.new_stock),
          reason: adjustStockForm.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notifySuccess(data.message || 'Stock updated.');
      setStockModalOpen(false);
      loadStoreData();
    } catch (err: any) {
      alert(`Stock Adjustment Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Order Handlers ──────────────────────────────────────────────────────────
  const handleTransitionStatus = async (orderId: string, targetStatus: OrderStatus) => {
    if (!store?.id) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/stores/${store.id}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          notes: transitionNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notifySuccess(data.message || `Order updated to ${targetStatus}`);
      setSelectedOrder(data.order);
      setTransitionNotes('');
      loadStoreData();
    } catch (err: any) {
      alert(`Transition Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewInvoice = async (orderId: string) => {
    if (!store?.id) return;
    try {
      const res = await fetch(`/api/stores/${store.id}/orders/${orderId}/invoice`);
      if (!res.ok) throw new Error('Failed to render invoice');
      const html = await res.text();
      setInvoiceHtml(html);
      setInvoiceModalOpen(true);
    } catch (e: any) {
      alert(`Invoice error: ${e.message}`);
    }
  };

  // Seed Sandbox Sample Order
  const handleCreateSampleOrder = async () => {
    if (!store?.id || products.length === 0) {
      alert('Please add at least one product before generating a sample order.');
      return;
    }
    const sampleProduct = products[0];
    try {
      setActionLoading(true);
      const res = await fetch(`/api/stores/${store.id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Muhammad Usman',
          customer_phone: '+92 300 1234567',
          customer_email: 'usman.buyer@example.pk',
          shipping_address: 'House #42, Street 7, Sector F-8/2',
          city: 'Islamabad',
          payment_method: 'cod',
          shipping_fee_pkr: 250,
          items: [
            {
              product_id: sampleProduct.id,
              name: sampleProduct.name,
              sku: sampleProduct.sku || 'SKU-001',
              unit_price_pkr: sampleProduct.price_pkr,
              quantity: 1,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notifySuccess(`Sample sandbox order #${data.order_number} created.`);
      loadStoreData();
    } catch (e: any) {
      alert(`Sample Order Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center text-[#dae2fd]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[13px] font-mono text-[#bbcabf]">Loading Store Control Panel...</span>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col justify-between p-8">
        <div className="max-w-md mx-auto p-8 text-center flex flex-col items-center gap-4 bg-[#131b2e] rounded-2xl border border-[#2d3449]">
          <span className="material-symbols-outlined text-[48px] text-[#ffb4ab]">store_mall_directory</span>
          <h1 className="text-[20px] font-bold">Store Not Initialized</h1>
          <p className="text-[13px] text-[#bbcabf]">{error || 'Store record could not be loaded.'}</p>
          <Link
            href={`/projects/${projectId}`}
            className="bg-[#4edea3] text-[#003824] px-4 py-2 rounded-xl text-[13px] font-bold"
          >
            Return to Project
          </Link>
        </div>
      </div>
    );
  }

  const isSandbox = store.status === 'draft';
  const paymentProviders = getStorePaymentProviders(paymentSettings || undefined);

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans flex flex-col selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0b1326]/90 backdrop-blur-xl border-b border-[#2d3449]/60 shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}`}
              className="text-[#bbcabf] hover:text-[#dae2fd] flex items-center gap-1 text-[13px] font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">Project</span>
            </Link>
            <span className="text-[#2d3449]">/</span>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4edea3] text-[20px]">storefront</span>
              <h1 className="text-[16px] font-bold text-[#dae2fd]">{store.name}</h1>
            </div>
            {isSandbox && (
              <span className="bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Sandbox Mode (Draft)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] font-mono text-[#bbcabf] bg-[#131b2e] px-3 py-1.5 rounded-lg border border-[#2d3449]">
              <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span>
              {store.slug}.platform.pk
            </span>
            <Link
              href={`/projects/${projectId}/storefront-wizard`}
              className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-3 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1 border border-[#2d3449]"
            >
              <span className="material-symbols-outlined text-[16px]">palette</span>
              <span>Theme Configurator</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Action Notification Banner */}
      {actionSuccess && (
        <div className="bg-[#10b981] text-[#003824] px-6 py-2.5 text-[13px] font-bold text-center flex items-center justify-center gap-2 shadow-md animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 w-full flex-1 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#2d3449]/60 pb-3 overflow-x-auto">
          {(
            [
              { key: 'overview', label: 'Overview', icon: 'dashboard' },
              { key: 'products', label: `Products (${products.length})`, icon: 'inventory_2' },
              { key: 'inventory', label: 'Inventory & Stock', icon: 'warehouse' },
              { key: 'orders', label: `Orders (${orders.length})`, icon: 'receipt_long' },
              { key: 'customers', label: `Customers (${customers.length})`, icon: 'group' },
              { key: 'payments', label: 'Payment Methods', icon: 'payments' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-[#4edea3] text-[#003824] shadow-[0_0_15px_rgba(78,222,163,0.25)]'
                  : 'bg-[#131b2e] hover:bg-[#1a233b] text-[#bbcabf] hover:text-[#dae2fd] border border-[#2d3449]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ─── TAB 1: OVERVIEW ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Actionable Alerts Banner */}
            {kpis && kpis.low_stock_count > 0 && (
              <div className="bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#ef4444] text-[24px]">warning</span>
                  <div>
                    <h4 className="text-[14px] font-bold text-[#fca5a5]">
                      Low Stock Alert: {kpis.low_stock_count} item(s) are critically low
                    </h4>
                    <p className="text-[12px] text-[#bbcabf]">
                      Some products have reached their minimum threshold and risk overselling.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-[12px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                >
                  Restock Items
                </button>
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[#bbcabf] text-[12px]">
                  <span>Total Revenue</span>
                  <span className="material-symbols-outlined text-[#4edea3]">payments</span>
                </div>
                <div className="text-[24px] font-bold text-[#4edea3]">
                  Rs. {Number(kpis?.total_revenue_pkr || 0).toLocaleString()}
                </div>
                <span className="text-[11px] text-[#86948a]">Across fulfilled orders</span>
              </div>

              <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[#bbcabf] text-[12px]">
                  <span>Total Orders</span>
                  <span className="material-symbols-outlined text-[#4cd7f6]">shopping_bag</span>
                </div>
                <div className="text-[24px] font-bold text-[#dae2fd]">{kpis?.total_orders || 0}</div>
                <span className="text-[11px] text-[#4cd7f6]">{kpis?.unfulfilled_orders_count || 0} pending fulfilment</span>
              </div>

              <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[#bbcabf] text-[12px]">
                  <span>Active Products</span>
                  <span className="material-symbols-outlined text-[#a855f7]">inventory_2</span>
                </div>
                <div className="text-[24px] font-bold text-[#dae2fd]">{kpis?.active_products || 0}</div>
                <span className="text-[11px] text-[#bbcabf]">Catalog health normal</span>
              </div>

              <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[#bbcabf] text-[12px]">
                  <span>Stock Alerts</span>
                  <span className="material-symbols-outlined text-[#f59e0b]">notification_important</span>
                </div>
                <div className={`text-[24px] font-bold ${(kpis?.low_stock_count || 0) > 0 ? 'text-[#ef4444]' : 'text-[#4edea3]'}`}>
                  {kpis?.low_stock_count || 0}
                </div>
                <span className="text-[11px] text-[#bbcabf]">Below restock limit</span>
              </div>
            </div>

            {/* Quick Actions & Sandbox Tools */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Store Management Quick Actions</h3>
                <p className="text-[13px] text-[#bbcabf]">
                  Manage products, process mock customer orders, and test fulfillment workflows safely in sandbox.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={openCreateProduct}
                  className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-4 py-2 rounded-xl text-[13px] font-bold flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add Product</span>
                </button>
                <button
                  onClick={handleCreateSampleOrder}
                  disabled={actionLoading}
                  className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1 border border-[#2d3449]"
                >
                  <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  <span>Create Sandbox Order</span>
                </button>
              </div>
            </div>

            {/* Recent Orders Overview */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Recent Orders</h3>
                <button onClick={() => setActiveTab('orders')} className="text-[#4edea3] hover:underline text-[12px] font-semibold">
                  View All Orders →
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-8 text-[#bbcabf] text-[13px]">
                  No customer orders placed yet. Click &quot;Create Sandbox Order&quot; above to simulate checkout.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#2d3449] text-[#bbcabf] text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">City</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3449]/60">
                      {orders.slice(0, 5).map((o) => {
                        const meta = getOrderStatusMeta(o.status);
                        return (
                          <tr key={o.id} className="hover:bg-[#171f33]">
                            <td className="py-3 px-3 font-mono font-bold text-[#dae2fd]">{o.order_number}</td>
                            <td className="py-3 px-3 font-medium text-[#dae2fd]">{o.customer_name}</td>
                            <td className="py-3 px-3 text-[#bbcabf]">{o.city}</td>
                            <td className="py-3 px-3 font-bold text-[#4edea3]">Rs. {Number(o.total_pkr).toLocaleString()}</td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                                style={{ background: meta.bg, color: meta.text }}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setOrderDetailModalOpen(true);
                                }}
                                className="text-[#4cd7f6] hover:underline text-[12px] font-semibold"
                              >
                                View Order
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: PRODUCTS ───────────────────────────────────────────────── */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#bbcabf] text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Search products by title, SKU, category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl pl-9 pr-4 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                />
              </div>
              <button
                onClick={openCreateProduct}
                className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-4 py-2 rounded-xl text-[13px] font-bold flex items-center gap-1 shadow-sm w-full md:w-auto justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Product</span>
              </button>
            </div>

            {/* Products Table */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-[#171f33] border-b border-[#2d3449] text-[#bbcabf] text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price (PKR)</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3449]/60">
                    {products
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
                          (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
                      )
                      .map((p) => {
                        const low = p.stock <= p.low_stock_threshold;
                        return (
                          <tr key={p.id} className="hover:bg-[#171f33]/60">
                            <td className="py-3 px-4 flex items-center gap-3">
                              {p.images[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-10 h-10 object-cover rounded-lg border border-[#2d3449]"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-[#222a3d] rounded-lg flex items-center justify-center text-[#bbcabf]">
                                  <span className="material-symbols-outlined text-[20px]">image</span>
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-[#dae2fd]">{p.name}</div>
                                {p.sku && <div className="text-[11px] text-[#bbcabf] font-mono">SKU: {p.sku}</div>}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="bg-[#222a3d] text-[#bbcabf] px-2.5 py-0.5 rounded-full text-[11px]">
                                {p.category || 'General'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-[#4edea3]">
                              Rs. {Number(p.price_pkr).toLocaleString()}
                              {p.compare_at_price_pkr && (
                                <span className="text-[11px] text-[#86948a] line-through ml-1.5">
                                  Rs. {Number(p.compare_at_price_pkr).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  low
                                    ? 'bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/30'
                                    : 'bg-[#10b981]/20 text-[#4edea3]'
                                }`}
                              >
                                {p.stock} units {low && '(Low)'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  p.is_active ? 'text-[#4edea3]' : 'text-[#86948a]'
                                }`}
                              >
                                {p.is_active ? 'Active' : 'Draft'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() => openAdjustStock(p)}
                                className="text-[#f59e0b] hover:underline text-[12px] font-semibold"
                              >
                                Stock
                              </button>
                              <button
                                onClick={() => openEditProduct(p)}
                                className="text-[#4cd7f6] hover:underline text-[12px] font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleArchiveProduct(p.id, p.name)}
                                className="text-[#ef4444] hover:underline text-[12px] font-semibold"
                              >
                                Archive
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-[#bbcabf]">
                          No products found. Click &quot;Add Product&quot; to build your catalog.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: INVENTORY ──────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Inventory &amp; Stock Levels</h3>
                <p className="text-[13px] text-[#bbcabf]">
                  Atomic stock adjustments with auditable reason logs and automated low-stock warnings.
                </p>
              </div>
              <button
                onClick={() => setInventoryLowOnly(!inventoryLowOnly)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${
                  inventoryLowOnly
                    ? 'bg-[#ef4444] text-white border-[#ef4444]'
                    : 'bg-[#131b2e] text-[#bbcabf] border-[#2d3449]'
                }`}
              >
                {inventoryLowOnly ? 'Showing Low Stock Only' : 'Filter Low Stock Items'}
              </button>
            </div>

            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#171f33] border-b border-[#2d3449] text-[#bbcabf] text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Available Stock</th>
                    <th className="py-3 px-4">Low Stock Limit</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3449]/60">
                  {products
                    .filter((p) => (!inventoryLowOnly ? true : p.stock <= p.low_stock_threshold))
                    .map((p) => {
                      const low = p.stock <= p.low_stock_threshold;
                      return (
                        <tr key={p.id} className="hover:bg-[#171f33]/60">
                          <td className="py-3 px-4 font-bold text-[#dae2fd]">{p.name}</td>
                          <td className="py-3 px-4 font-mono text-[#bbcabf]">{p.sku || '—'}</td>
                          <td className="py-3 px-4 font-bold text-[#dae2fd]">{p.stock} units</td>
                          <td className="py-3 px-4 text-[#bbcabf]">{p.low_stock_threshold} units</td>
                          <td className="py-3 px-4">
                            {low ? (
                              <span className="bg-[#ef4444]/20 text-[#fca5a5] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[#ef4444]/40">
                                Critical / Low
                              </span>
                            ) : (
                              <span className="bg-[#10b981]/20 text-[#4edea3] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                Healthy
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => openAdjustStock(p)}
                              className="bg-[#222a3d] hover:bg-[#2d3449] text-[#4edea3] px-3 py-1 rounded-lg text-[12px] font-semibold border border-[#2d3449]"
                            >
                              Update Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Audit Logs */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-5 flex flex-col gap-3">
              <h4 className="text-[14px] font-bold text-[#dae2fd]">Recent Inventory Audit Logs</h4>
              {inventoryLogs.length === 0 ? (
                <p className="text-[12px] text-[#bbcabf]">No inventory change logs recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#2d3449]/60 text-[12px]">
                  {inventoryLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold ${
                            log.delta > 0 ? 'text-[#4edea3]' : log.delta < 0 ? 'text-[#ef4444]' : 'text-[#bbcabf]'
                          }`}
                        >
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </span>
                        <span className="text-[#dae2fd]">Stock adjusted ({log.reason.replace('_', ' ')})</span>
                      </div>
                      <div className="text-[#bbcabf] text-[11px] font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 4: ORDERS & FULFILMENT ────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                {['all', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold capitalize whitespace-nowrap ${
                      orderStatusFilter === st
                        ? 'bg-[#4edea3] text-[#003824]'
                        : 'bg-[#131b2e] text-[#bbcabf] hover:text-[#dae2fd] border border-[#2d3449]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#bbcabf] text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Search order #, customer, phone..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl pl-9 pr-4 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                />
              </div>
            </div>

            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#171f33] border-b border-[#2d3449] text-[#bbcabf] text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer &amp; City</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3449]/60">
                  {orders
                    .filter((o) => (orderStatusFilter === 'all' ? true : o.status === orderStatusFilter))
                    .filter(
                      (o) =>
                        o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
                        o.customer_name.toLowerCase().includes(orderSearch.toLowerCase()) ||
                        o.customer_phone.includes(orderSearch)
                    )
                    .map((o) => {
                      const meta = getOrderStatusMeta(o.status);
                      return (
                        <tr key={o.id} className="hover:bg-[#171f33]/60">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-[#dae2fd]">{o.order_number}</div>
                            <div className="text-[11px] text-[#bbcabf]">
                              {new Date(o.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#dae2fd]">{o.customer_name}</div>
                            <div className="text-[11px] text-[#bbcabf]">
                              {o.city} • {o.customer_phone}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-[#222a3d] text-[#bbcabf] px-2 py-0.5 rounded text-[11px] font-mono uppercase">
                              {o.payment_method}
                            </span>
                            <div className="text-[11px] text-[#86948a] capitalize mt-0.5">{o.payment_status}</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-[#4edea3]">
                            Rs. {Number(o.total_pkr).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                              style={{ background: meta.bg, color: meta.text }}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedOrder(o);
                                setOrderDetailModalOpen(true);
                              }}
                              className="text-[#4edea3] hover:underline text-[12px] font-semibold"
                            >
                              Manage
                            </button>
                            <button
                              onClick={() => handleViewInvoice(o.id)}
                              className="text-[#4cd7f6] hover:underline text-[12px] font-semibold"
                            >
                              Invoice
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#bbcabf]">
                        No orders recorded matching your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 5: CUSTOMERS ──────────────────────────────────────────────── */}
        {activeTab === 'customers' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Customer Profiles &amp; Lifetime Value</h3>
                <p className="text-[13px] text-[#bbcabf]">
                  Aggregated directory of customers who placed orders on your store.
                </p>
              </div>
              <div className="relative w-72">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#bbcabf] text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl pl-9 pr-4 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                />
              </div>
            </div>

            <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#171f33] border-b border-[#2d3449] text-[#bbcabf] text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">City / Area</th>
                    <th className="py-3 px-4">Total Orders</th>
                    <th className="py-3 px-4 text-right">Lifetime Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3449]/60">
                  {customers
                    .filter(
                      (c) =>
                        c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        c.phone.includes(customerSearch) ||
                        (c.city && c.city.toLowerCase().includes(customerSearch.toLowerCase()))
                    )
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-[#171f33]/60">
                        <td className="py-3 px-4 font-bold text-[#dae2fd]">{c.full_name}</td>
                        <td className="py-3 px-4">
                          <div className="text-[#dae2fd]">{c.phone}</div>
                          {c.email && <div className="text-[11px] text-[#bbcabf]">{c.email}</div>}
                        </td>
                        <td className="py-3 px-4 text-[#bbcabf]">{c.city || '—'}</td>
                        <td className="py-3 px-4 font-semibold text-[#dae2fd]">{c.total_orders} orders</td>
                        <td className="py-3 px-4 text-right font-bold text-[#4edea3]">
                          Rs. {Number(c.total_spend_pkr).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-[#bbcabf]">
                        No customer accounts aggregated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 6: PAYMENT METHODS ────────────────────────────────────────── */}
        {activeTab === 'payments' && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-[16px] font-bold text-[#dae2fd]">Payment Method Configuration</h3>
              <p className="text-[13px] text-[#bbcabf]">
                Truthful status of local and international payment methods for your storefront.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentProviders.map((prov) => (
                <div
                  key={prov.id}
                  className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 flex flex-col justify-between gap-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[16px] font-bold text-[#dae2fd]">{prov.name}</h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          prov.status === 'active'
                            ? 'bg-[#10b981]/20 text-[#4edea3] border border-[#10b981]/40'
                            : prov.status === 'unsupported'
                            ? 'bg-[#6b7280]/20 text-[#9ca3af]'
                            : 'bg-[#d97706]/20 text-[#f59e0b]'
                        }`}
                      >
                        {prov.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#bbcabf] leading-relaxed">{prov.description}</p>
                    {prov.notes && (
                      <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] text-[12px] text-[#4cd7f6] mt-2">
                        {prov.notes}
                      </div>
                    )}
                  </div>

                  {prov.setupInstructions && (
                    <div className="border-t border-[#2d3449] pt-3">
                      <span className="text-[11px] font-bold text-[#bbcabf] uppercase tracking-wider block mb-1">
                        Configuration Guide:
                      </span>
                      <ul className="text-[11px] text-[#86948a] space-y-0.5">
                        {prov.setupInstructions.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── MODAL: ADD / EDIT PRODUCT ─────────────────────────────────────── */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2d3449] pb-3">
              <h3 className="text-[16px] font-bold text-[#dae2fd]">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-[#bbcabf] hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex flex-col gap-3 text-[13px]">
              <div>
                <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Classic Embroidered Kurti"
                  className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Selling Price (PKR) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={productForm.price_pkr}
                    onChange={(e) => setProductForm({ ...productForm, price_pkr: Number(e.target.value) })}
                    className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Original Price (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Compare-at price"
                    value={productForm.compare_at_price_pkr}
                    onChange={(e) => setProductForm({ ...productForm, compare_at_price_pkr: e.target.value })}
                    className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">SKU / Code</label>
                  <input
                    type="text"
                    placeholder="PRD-001"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Stock Count</label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                    className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Low Alert Limit</label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.low_stock_threshold}
                    onChange={(e) => setProductForm({ ...productForm, low_stock_threshold: Number(e.target.value) })}
                    className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Apparel, Footwear, Handicrafts"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={productForm.images}
                  onChange={(e) => setProductForm({ ...productForm, images: e.target.value })}
                  className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Marketing Description</label>
                <textarea
                  rows={3}
                  placeholder="Compelling description of the product and sizing details..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={productForm.is_active}
                  onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                  className="rounded text-[#4edea3] focus:ring-[#4edea3]"
                />
                <label htmlFor="is_active" className="text-[12px] text-[#dae2fd]">
                  Active for customer purchase on storefront
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#2d3449]">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#bbcabf] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-5 py-2 rounded-xl font-bold shadow-md"
                >
                  {actionLoading ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADJUST STOCK ───────────────────────────────────────────── */}
      {stockModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-[16px] font-bold text-[#dae2fd]">Update Inventory</h3>
            <p className="text-[12px] text-[#bbcabf]">
              Product: <span className="text-[#4edea3] font-bold">{adjustingProduct.name}</span>
              <br />
              Current Available Stock: <span className="font-bold">{adjustingProduct.stock} units</span>
            </p>

            <form onSubmit={handleSaveStockAdjustment} className="flex flex-col gap-3 text-[13px]">
              <div>
                <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">New Total Stock *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={adjustStockForm.new_stock}
                  onChange={(e) => setAdjustStockForm({ ...adjustStockForm, new_stock: Number(e.target.value) })}
                  className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none font-bold text-[16px]"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-[#bbcabf] mb-1">Reason for Audit Log *</label>
                <select
                  value={adjustStockForm.reason}
                  onChange={(e) => setAdjustStockForm({ ...adjustStockForm, reason: e.target.value })}
                  className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                >
                  <option value="manual_adjustment">Manual Inventory Count</option>
                  <option value="restock">Batch Restock / Delivery</option>
                  <option value="damage">Damaged / Expired Stock</option>
                  <option value="order_cancelled">Return Restock</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setStockModalOpen(false)}
                  className="px-3 py-1.5 text-[#bbcabf]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#4edea3] text-[#003824] px-4 py-1.5 rounded-xl font-bold"
                >
                  {actionLoading ? 'Updating...' : 'Save Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ORDER DETAILS & TRANSITIONS ────────────────────────────── */}
      {orderDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-[13px]">
            <div className="flex items-center justify-between border-b border-[#2d3449] pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Order #{selectedOrder.order_number}</h3>
                <span className="text-[11px] text-[#bbcabf]">
                  Placed on {new Date(selectedOrder.created_at).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setOrderDetailModalOpen(false)} className="text-[#bbcabf] hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#171f33] p-4 rounded-xl border border-[#2d3449]">
              <div>
                <span className="text-[11px] text-[#bbcabf] uppercase font-bold block mb-1">Customer Details</span>
                <div className="font-bold text-[#dae2fd]">{selectedOrder.customer_name}</div>
                <div className="text-[#bbcabf]">{selectedOrder.customer_phone}</div>
                {selectedOrder.customer_email && <div className="text-[#bbcabf]">{selectedOrder.customer_email}</div>}
              </div>
              <div>
                <span className="text-[11px] text-[#bbcabf] uppercase font-bold block mb-1">Delivery Address</span>
                <div className="text-[#dae2fd] leading-snug">{selectedOrder.shipping_address}</div>
                <div className="font-semibold text-[#4edea3] mt-1">{selectedOrder.city}</div>
              </div>
            </div>

            {/* Line items list */}
            <div>
              <span className="text-[11px] text-[#bbcabf] uppercase font-bold block mb-2">Ordered Items</span>
              <div className="divide-y divide-[#2d3449]/60 border border-[#2d3449] rounded-xl overflow-hidden">
                {(selectedOrder.items || []).map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#171f33] flex justify-between items-center">
                    <div>
                      <div className="font-bold text-[#dae2fd]">{item.name}</div>
                      <div className="text-[11px] text-[#bbcabf]">
                        Qty: {item.quantity} × Rs. {Number(item.unit_price_pkr).toLocaleString()}
                      </div>
                    </div>
                    <div className="font-bold text-[#4edea3]">
                      Rs. {Number(item.total_price_pkr).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Transition Control */}
            <div className="bg-[#171f33] p-4 rounded-xl border border-[#2d3449] flex flex-col gap-2">
              <span className="text-[11px] text-[#bbcabf] uppercase font-bold">Fulfilment Pipeline Step</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#bbcabf]">Current Status:</span>
                <span className="font-bold capitalize text-[#4edea3]">{selectedOrder.status}</span>
              </div>

              {ALLOWED_STATUS_TRANSITIONS[selectedOrder.status]?.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-[12px] text-[#bbcabf]">Advance to:</span>
                  {ALLOWED_STATUS_TRANSITIONS[selectedOrder.status].map((target) => (
                    <button
                      key={target}
                      onClick={() => handleTransitionStatus(selectedOrder.id, target)}
                      disabled={actionLoading}
                      className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-3 py-1 rounded-lg text-[12px] font-bold capitalize transition-all"
                    >
                      Mark as {target}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#86948a] italic">
                  This order has reached its final state ({selectedOrder.status}).
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => handleViewInvoice(selectedOrder.id)}
                className="bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] px-4 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1 border border-[#2d3449]"
              >
                <span className="material-symbols-outlined text-[16px]">receipt</span>
                <span>Generate Official Invoice</span>
              </button>
              <button
                onClick={() => setOrderDetailModalOpen(false)}
                className="bg-[#222a3d] text-[#dae2fd] px-4 py-2 rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: INVOICE VIEWER ─────────────────────────────────────────── */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#0b1326] px-6 py-3 flex items-center justify-between text-white">
              <span className="text-[13px] font-bold">Printable Tax Invoice Preview</span>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <iframe
                title="Invoice Document"
                srcDoc={invoiceHtml}
                className="w-full h-[650px] border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
