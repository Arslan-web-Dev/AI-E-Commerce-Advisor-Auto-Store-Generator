export interface PaymentProviderStatus {
  id: string;
  name: string;
  type: 'cash_on_delivery' | 'card_gateway' | 'digital_wallet';
  status: 'active' | 'not_configured' | 'unsupported';
  isDefault: boolean;
  currency: string;
  description: string;
  setupInstructions?: string[];
  notes?: string;
}

export function getStorePaymentProviders(settings?: {
  cod_enabled?: boolean;
  stripe_enabled?: boolean;
  stripe_account_id?: string | null;
  paypal_enabled?: boolean;
}): PaymentProviderStatus[] {
  const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && settings?.stripe_account_id);

  return [
    {
      id: 'cod',
      name: 'Cash on Delivery (COD)',
      type: 'cash_on_delivery',
      status: settings?.cod_enabled !== false ? 'active' : 'not_configured',
      isDefault: true,
      currency: 'PKR',
      description: 'Collect payment in cash when the order is physically delivered to the customer door.',
      notes: 'Dominant e-commerce payment method in Pakistan (SRS GEO-5). Fully operational in sandbox & draft stores.',
    },
    {
      id: 'stripe',
      name: 'Stripe Gateway (Credit / Debit Card)',
      type: 'card_gateway',
      status: isStripeConfigured && settings?.stripe_enabled ? 'active' : 'not_configured',
      isDefault: false,
      currency: 'USD / Multi-currency',
      description: 'Accept Visa, MasterCard, and international debit cards online.',
      setupInstructions: [
        '1. Create a registered business account on Stripe.',
        '2. Obtain server STRIPE_SECRET_KEY and webhook secret.',
        '3. Connect Stripe Account ID in merchant store settings.',
      ],
      notes: 'Not configured in current workspace environment. Requires external merchant account credentials.',
    },
    {
      id: 'paypal',
      name: 'PayPal Checkout',
      type: 'card_gateway',
      status: 'unsupported',
      isDefault: false,
      currency: 'USD',
      description: 'Direct PayPal wallet and express checkout.',
      notes: 'Unsupported for domestic Pakistani Rupee (PKR) transactions without international entity.',
    },
    {
      id: 'easypaisa_jazzcash',
      name: 'Mobile Wallets (JazzCash / EasyPaisa)',
      type: 'digital_wallet',
      status: 'not_configured',
      isDefault: false,
      currency: 'PKR',
      description: 'Local Pakistani mobile micro-finance account integration.',
      notes: 'Planned for future local gateway module (SRS §2.2). Direct API keys required for merchant sandbox.',
    },
  ];
}
