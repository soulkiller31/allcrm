import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const PLANS = {
  // ₹1 paid trial — 7 days full access, then pick a paid plan
  trial_paid: { label: '7-Day Trial', price: 1, days: 7 },
  // Paid plans (trial_paid users must upgrade to one of these after 7 days)
  monthly:    { label: 'Monthly',  price: 2499,  days: 30  },
  halfyearly: { label: '6 Months', price: 13999, days: 180 },
  yearly:     { label: 'Yearly',   price: 26999, days: 365 },
};

export const SubscriptionModel = {
  async findByTenantId(tenantId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError('Database error', 500);
    return data;
  },

  // createPending — called on signup; user has no active subscription yet.
  // They must pay ₹1 to start the 7-day trial before accessing the CRM.
  async createPending(tenantId) {
    const { data, error } = await supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan: 'trial_paid',
      status: 'pending',
    }).select().single();
    if (error) throw new AppError('Failed to create subscription record', 500);
    return data;
  },

  // createTrial — activated after ₹1 payment succeeds
  async createTrial(tenantId, { cashfreeOrderId, cashfreePaymentId } = {}) {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Cancel any existing subscriptions
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled');

    const { data, error } = await supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan: 'trial_paid',
      status: 'trial',
      trial_ends_at: trialEndsAt,
      cashfree_order_id: cashfreeOrderId || null,
      cashfree_payment_id: cashfreePaymentId || null,
      amount_paid: 1,
    }).select().single();
    if (error) throw new AppError('Failed to create trial', 500);
    return data;
  },

  async activate(tenantId, { plan, cashfreeOrderId, cashfreePaymentId, amountPaid }) {
    const days = PLANS[plan]?.days || 30;
    const paidFrom = new Date().toISOString();
    const paidUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    // Upsert — deactivate old subscription first
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled');

    const { data, error } = await supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan,
      status: 'active',
      paid_from: paidFrom,
      paid_until: paidUntil,
      cashfree_order_id: cashfreeOrderId,
      cashfree_payment_id: cashfreePaymentId,
      amount_paid: amountPaid,
    }).select().single();
    if (error) throw new AppError('Failed to activate subscription', 500);
    return data;
  },

  async findActiveTenants() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('tenant_id, status, trial_ends_at, paid_until')
      .in('status', ['trial', 'active']);
    if (error) throw new AppError('Failed to fetch subscriptions', 500);
    return (data || []).filter((s) => this.isActive(s)).map((s) => s.tenant_id);
  },

  async isAlreadyActivatedForOrder(orderId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('cashfree_order_id', orderId)
      .in('status', ['active', 'trial'])
      .maybeSingle();
    if (error) throw new AppError('Database error', 500);
    return data;
  },

  isActive(subscription) {
    if (!subscription) return false;
    const now = new Date();
    if (subscription.status === 'trial') {
      return subscription.trial_ends_at && new Date(subscription.trial_ends_at) > now;
    }
    if (subscription.status === 'active') {
      return subscription.paid_until && new Date(subscription.paid_until) > now;
    }
    return false;
  },

  daysLeft(subscription) {
    if (!subscription) return 0;
    const now = new Date();
    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      return Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - now) / 86400000));
    }
    if (subscription.status === 'active' && subscription.paid_until) {
      return Math.max(0, Math.ceil((new Date(subscription.paid_until) - now) / 86400000));
    }
    return 0;
  },
};
