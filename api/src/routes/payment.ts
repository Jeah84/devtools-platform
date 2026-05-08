import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types/express';
import { env } from '../config/env';

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) {
    console.log('STRIPE DEBUG:', {
      hasKey: !!env.stripeSecretKey,
      keyLength: env.stripeSecretKey?.length,
      keyPrefix: env.stripeSecretKey?.substring(0, 7),
    });
    _stripe = new Stripe(env.stripeSecretKey);
  }
  return _stripe;
}

// Credit packs configuration
export const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 50,
    price: 299, // $2.99 in cents
    stripePriceId: env.stripeCreditsStarterPriceId,
    description: '50 translations',
    popular: false,
  },
  {
    id: 'builder',
    name: 'Builder Pack',
    credits: 200,
    price: 799, // $7.99 in cents
    stripePriceId: env.stripeCreditsBuilderPriceId,
    description: '200 translations',
    popular: true,
  },
  {
    id: 'power',
    name: 'Power Pack',
    credits: 500,
    price: 1499, // $14.99 in cents
    stripePriceId: env.stripesCreditsPowerPriceId,
    description: '500 translations',
    popular: false,
  },
];

const router = Router();

// GET /api/payment/credit-packs - return available packs
router.get('/credit-packs', (_req: Request, res: Response) => {
  res.json(CREDIT_PACKS.map(({ id, name, credits, price, description, popular }) => ({
    id, name, credits, price, description, popular,
  })));
});

// POST /api/payment/create-checkout-session - Pro subscription
router.post('/create-checkout-session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { subscription: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.plan === 'PRO') {
      res.status(400).json({ error: 'Already on Pro plan' });
      return;
    }

    let customerId = user.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await getStripe().customers.create({ email: user.email });
      customerId = customer.id;
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price: env.stripePriceIdMonthly,
          quantity: 1,
        },
      ],
      success_url: `${env.frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.frontendUrl}/pricing`,
      metadata: { userId: user.id, type: 'subscription' },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/payment/buy-credits - Credit pack purchase
router.post('/buy-credits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { packId } = req.body;
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) {
      res.status(400).json({ error: 'Invalid credit pack' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { subscription: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let customerId = user.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await getStripe().customers.create({ email: user.email });
      customerId = customer.id;
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price: pack.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${env.frontendUrl}/dashboard?credits_added=true`,
      cancel_url: `${env.frontendUrl}/pricing`,
      metadata: {
        userId: user.id,
        type: 'credits',
        packId: pack.id,
        credits: String(pack.credits),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Buy credits error:', err);
    res.status(500).json({ error: 'Failed to create credits checkout session' });
  }
});

// POST /api/payment/portal
router.post('/portal', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { subscription: true },
    });
    if (!user?.subscription?.stripeCustomerId) {
      res.status(400).json({ error: 'No active subscription' });
      return;
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${env.frontendUrl}/settings`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /api/payment/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const type = session.metadata?.type;

        if (!userId) break;

        if (type === 'credits') {
          // Handle credit pack purchase
          const credits = parseInt(session.metadata?.credits || '0', 10);
          await prisma.$transaction([
            prisma.user.update({
              where: { id: userId },
              data: { credits: { increment: credits } },
            }),
            prisma.purchase.create({
              data: {
                userId,
                stripeSessionId: session.id,
                credits,
                amount: session.amount_total || 0,
              },
            }),
          ]);
          console.log(`Added ${credits} credits to user ${userId}`);

        } else if (type === 'subscription') {
          // Handle Pro subscription
          const subscriptionId = session.subscription as string;
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await prisma.$transaction([
            prisma.subscription.upsert({
              where: { userId },
              create: {
                userId,
                plan: 'PRO',
                active: true,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscriptionId,
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              },
              update: {
                plan: 'PRO',
                active: true,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscriptionId,
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              },
            }),
            prisma.user.update({
              where: { id: userId },
              data: { plan: 'PRO' },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (!sub) break;
        const active = subscription.status === 'active';
        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: sub.id },
            data: {
              active,
              plan: active ? 'PRO' : 'FREE',
              currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            },
          }),
          prisma.user.update({
            where: { id: sub.userId },
            data: { plan: active ? 'PRO' : 'FREE' },
          }),
        ]);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (!sub) break;
        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: sub.id },
            data: { active: false, plan: 'FREE' },
          }),
          prisma.user.update({
            where: { id: sub.userId },
            data: { plan: 'FREE' },
          }),
        ]);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// SOLANA USDC PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT_DEVNET  = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

function getSolanaConnection() {
  return new Connection(env.solanaRpcUrl, 'confirmed');
}

// Credit packs with USDC prices (mirrors Stripe packs)
export const SOLANA_CREDIT_PACKS = [
  { id: 'starter', name: 'Starter Pack', credits: 50,  amountUsdc: 2.99, popular: false },
  { id: 'builder', name: 'Builder Pack', credits: 200, amountUsdc: 7.99, popular: true  },
  { id: 'power',   name: 'Power Pack',   credits: 500, amountUsdc: 14.99, popular: false },
];

// POST /api/payment/create-solana-payment
router.post('/create-solana-payment', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { packId } = req.body;
    const pack = SOLANA_CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) {
      res.status(400).json({ error: 'Invalid credit pack' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate a unique reference keypair — this is what we track on-chain
    const referenceKeypair = Keypair.generate();
    const reference = referenceKeypair.publicKey.toBase58();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.solanaPayment.create({
      data: {
        userId: user.id,
        reference,
        packId: pack.id,
        credits: pack.credits,
        amountUsdc: pack.amountUsdc,
        status: 'pending',
        expiresAt,
      },
    });

    // Build Solana Pay URL
    const merchant = env.solanaMerchantWallet;
    const usdcMint = env.solanaRpcUrl.includes('devnet') ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
    const memo = `transpiler-credits-${pack.id}`;
    const solanaPayUrl =
      `solana:${merchant}` +
      `?amount=${pack.amountUsdc}` +
      `&spl-token=${usdcMint}` +
      `&reference=${reference}` +
      `&label=Transpiler.us` +
      `&message=${encodeURIComponent(`${pack.credits} credits`)}` +
      `&memo=${encodeURIComponent(memo)}`;

    res.json({
      reference,
      solanaPayUrl,
      merchant,
      amountUsdc: pack.amountUsdc,
      credits: pack.credits,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('create-solana-payment error:', err);
    res.status(500).json({ error: 'Failed to create Solana payment' });
  }
});

// POST /api/payment/verify-solana-payment
router.post('/verify-solana-payment', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      res.status(400).json({ error: 'Missing reference' });
      return;
    }

    const payment = await prisma.solanaPayment.findUnique({ where: { reference } });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    if (payment.userId !== req.userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    if (payment.status === 'confirmed') {
      res.json({ confirmed: true, credits: payment.credits });
      return;
    }
    if (new Date() > payment.expiresAt) {
      await prisma.solanaPayment.update({ where: { reference }, data: { status: 'expired' } });
      res.json({ confirmed: false, expired: true });
      return;
    }

    // Check Solana blockchain for a transaction with this reference
    const connection = getSolanaConnection();
    const referencePubkey = new PublicKey(reference);
    const signatures = await connection.getSignaturesForAddress(referencePubkey, { limit: 5 });

    if (signatures.length === 0) {
      res.json({ confirmed: false });
      return;
    }

    const txSig = signatures[0].signature;

    // Mark confirmed + credit user atomically
    await prisma.$transaction([
      prisma.solanaPayment.update({
        where: { reference },
        data: { status: 'confirmed', txSignature: txSig },
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: { credits: { increment: payment.credits } },
      }),
    ]);

    res.json({ confirmed: true, credits: payment.credits, txSignature: txSig });
  } catch (err) {
    console.error('verify-solana-payment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

export default router;
