import { Cashfree, CFEnvironment } from 'cashfree-pg';
import config from '../config/index.js';
import { SubscriptionModel, PLANS } from '../models/Subscription.js';
import { PaymentModel } from '../models/Payment.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const getCashfree = () => {
  const { appId, secretKey, env } = config.cashfree;
  const isPlaceholder = (v) => !v || /^(replace-with|REPLACE_ON_VPS)/.test(v);
  if (isPlaceholder(appId) || isPlaceholder(secretKey)) {
    const where = env === 'production' ? 'LIVE/PRODUCTION mode keys' : 'TEST/SANDBOX mode keys';
    throw new AppError(`Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY with ${where} from Cashfree Merchant Dashboard.`, 500);
  }
  const cfEnv = env === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  return new Cashfree(cfEnv, appId, secretKey);
};

const wrapCfError = (err, fallback = 'Payment gateway request failed') => {
  const data = err?.response?.data || err?.response?.body || err?.data;
  if (data) {
    const code = data.code || data.error_code || '';
    const message = data.message || data.error_message || '';
    const type = data.type || '';
    const detail = [code, type, message].filter(Boolean).join(' — ');
    if (detail) {
      console.warn('[Cashfree Error]', detail, JSON.stringify(data).slice(0, 400));
      return new AppError(`Payment failed: ${detail}`, 400);
    }
  }
  if (err?.message) {
    console.warn('[Cashfree Error]', err.message);
    return new AppError(`${fallback}: ${err.message}`, 400);
  }
  return new AppError(fallback, 500);
};

const activateFromPayment = async (payment, { paymentId, amount } = {}) => {
  const already = await SubscriptionModel.isAlreadyActivatedForOrder(payment.cashfree_order_id);
  if (already) return already;

  const subscription = await SubscriptionModel.activate(payment.tenant_id, {
    plan: payment.plan,
    cashfreeOrderId: payment.cashfree_order_id,
    cashfreePaymentId: paymentId || payment.cashfree_payment_id,
    amountPaid: amount || payment.amount,
  });

  await PaymentModel.markPaid(payment.cashfree_order_id, {
    paymentId: paymentId || payment.cashfree_payment_id,
  });

  return subscription;
};

export const createOrder = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const tenant = req.tenant;

  // Validate plan — block unknown plans and the free trial plan
  if (!PLANS[plan] || plan === 'trial') {
    throw new AppError('Invalid plan. Choose monthly, halfyearly, or yearly.', 400);
  }

  const planInfo = PLANS[plan];
  const orderId = `ORD_${tenant.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
  const returnBase = config.frontendUrl.replace(/\/$/, '');
  const backendBase = (config.backendUrl || returnBase).replace(/\/$/, '');
  const isProductionCf = config.cashfree.env === 'production';

  if (isProductionCf) {
    const needsHttps = (url) => url && !url.toLowerCase().startsWith('https://');
    if (needsHttps(returnBase)) throw new AppError('Cashfree production requires FRONTEND_URL to be HTTPS for return_url. Use CASHFREE_ENV=sandbox with sandbox keys for local development.', 400);
    if (needsHttps(backendBase)) throw new AppError('Cashfree production requires BACKEND_URL to be HTTPS for webhook notify_url. Use CASHFREE_ENV=sandbox with sandbox keys for local development.', 400);
  }

  const orderRequest = {
    order_id: orderId,
    order_amount: Number(planInfo.price).toFixed(2),
    order_currency: 'INR',
    customer_details: {
      customer_id: tenant.id.replace(/-/g, '').slice(0, 50),
      customer_email: tenant.owner_email,
      customer_name: tenant.owner_name || tenant.name,
      customer_phone: (tenant.phone || '9999999999').replace(/\D/g, '').slice(-10).padStart(10, '9'),
    },
    order_meta: {
      return_url: `${returnBase}/billing?order_id={order_id}&plan=${plan}`,
      notify_url: `${backendBase}/api/payment/webhook`,
    },
    order_tags: {
      tenant_id: String(tenant.id),
      plan: String(plan),
    },
    order_note: `${planInfo.label} subscription for ${tenant.name}`,
  };

  const cf = getCashfree();
  let response;
  try {
    response = await cf.PGCreateOrder(orderRequest);
  } catch (err) {
    throw wrapCfError(err, 'Failed to create payment order');
  }

  const orderData = response.data || response;
  const resolvedOrderId = orderData.order_id || orderId;
  const resolvedSessionId = orderData.payment_session_id || orderData.paymentGatewaySessionId || '';

  await PaymentModel.createPending({
    tenantId: tenant.id,
    orderId: resolvedOrderId,
    plan,
    amount: planInfo.price,
  });

  res.json({
    success: true,
    data: {
      orderId: resolvedOrderId,
      paymentSessionId: resolvedSessionId,
      amount: planInfo.price,
      plan,
      planLabel: planInfo.label,
    },
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, plan } = req.body;
  const tenant = req.tenant;

  if (!orderId) throw new AppError('orderId is required', 400);

  const payment = await PaymentModel.findByOrderId(orderId);
  if (!payment || payment.tenant_id !== tenant.id) {
    throw new AppError('Payment order not found', 404);
  }

  const cf = getCashfree();
  let response;
  try {
    response = await cf.PGOrderFetchPayments(orderId);
  } catch (err) {
    throw wrapCfError(err, 'Failed to fetch payment status');
  }
  const payments = response.data || response;

  const paymentList = Array.isArray(payments)
    ? payments
    : (payments?.payments || (payments?.payment_status ? [payments] : []));

  const successPayment = paymentList.find((p) =>
    (p.payment_status === 'SUCCESS') || (p.status === 'SUCCESS')
  );

  if (!successPayment) {
    throw new AppError('Payment not successful. Please try again.', 400);
  }

  const subscription = await activateFromPayment(payment, {
    paymentId: successPayment.cf_payment_id || successPayment.payment_id || successPayment.pgId || orderId,
    amount: successPayment.payment_amount || successPayment.amount || payment.amount,
  });

  res.json({
    success: true,
    message: `${PLANS[subscription.plan]?.label || plan || 'Paid'} subscription activated!`,
    data: {
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        trialEndsAt: subscription.trial_ends_at,
        paidUntil: subscription.paid_until,
        daysLeft: SubscriptionModel.daysLeft(subscription),
        isActive: SubscriptionModel.isActive(subscription),
      },
    },
  });
});

export const webhook = asyncHandler(async (req, res) => {
  const rawBody   = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  // Step 1 — verify HMAC signature BEFORE any processing.
  // A forged request must be rejected here; never fall through to activation.
  if (signature && timestamp) {
    try {
      const cf = getCashfree();
      cf.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch (sigErr) {
      console.warn('[Webhook] Invalid signature — request rejected:', sigErr.message);
      return res.status(403).json({ success: false, message: 'Invalid webhook signature' });
    }
  } else {
    // Cashfree always sends signature headers in production.
    // In sandbox they may be absent — log a warning but allow.
    console.warn('[Webhook] Missing signature headers — proceeding (sandbox/test only)');
  }

  // Step 2 — process the event
  try {
    const payload = req.body;
    const type    = payload.type;
    const data    = payload.data;

    if (type === 'PAYMENT_SUCCESS_WEBHOOK' && data?.payment?.payment_status === 'SUCCESS') {
      const orderId    = data.order?.order_id;
      const cfPaymentId = data.payment?.cf_payment_id;
      const amount     = data.payment?.payment_amount;
      if (orderId) {
        const payment = await PaymentModel.findByOrderId(orderId);
        if (payment) {
          await activateFromPayment(payment, { paymentId: cfPaymentId, amount });
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Processing error:', err.message);
    // Return 400 so Cashfree retries — but do NOT activate anything on error
    res.status(400).json({ success: false, message: 'Webhook processing failed' });
  }
});

export const getPlans = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: Object.entries(PLANS)
      .filter(([key]) => key !== 'trial')
      .map(([key, val]) => ({ key, ...val })),
  });
});
