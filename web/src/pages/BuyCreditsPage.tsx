import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';
// @ts-ignore
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
  popular: boolean;
}

interface SolanaPaymentResponse {
  reference: string;
  solanaPayUrl: string;
  merchant: string;
  amountUsdc: number;
  credits: number;
  expiresAt: string;
}

const SOLANA_PACKS = [
  { id: 'starter', name: 'Starter Pack', credits: 50,  amountUsdc: 2.99,  popular: false },
  { id: 'builder', name: 'Builder Pack', credits: 200, amountUsdc: 7.99,  popular: true  },
  { id: 'power',   name: 'Power Pack',   credits: 500, amountUsdc: 14.99, popular: false },
];

const BuyCreditsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'stripe' | 'solana'>('stripe');

  // Solana modal state
  const [solanaModal, setSolanaModal] = useState<SolanaPaymentResponse | null>(null);
  const [solanaStatus, setSolanaStatus] = useState<'waiting' | 'confirmed' | 'expired'>('waiting');
  const [solanaLoading, setSolanaLoading] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(900);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<CreditPack[]>('/payment/credit-packs').then(p => setPacks(p));
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  // ── Stripe flow ─────────────────────────────────────────────────────────────
  const handleStripeBuy = async (packId: string) => {
    setLoading(true);
    setSelectedPack(packId);
    try {
      const res = await api<{ url: string }>('/payment/buy-credits', { method: 'POST', body: { packId } });
      window.location.href = res.url;
    } catch {
      setLoading(false);
      setSelectedPack(null);
    }
  };

  // ── Solana flow ─────────────────────────────────────────────────────────────
  const handleSolanaBuy = async (packId: string) => {
    setSolanaLoading(true);
    setSelectedPack(packId);
    try {
      const res = await api<SolanaPaymentResponse>('/payment/create-solana-payment', {
        method: 'POST',
        body: { packId },
      });
      setSolanaModal(res);
      setSolanaStatus('waiting');
      setSecondsLeft(900);
      startPolling(res.reference);
      startTimer();
    } catch {
      // ignore
    } finally {
      setSolanaLoading(false);
    }
  };

  const startPolling = (reference: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api<{ confirmed: boolean; expired?: boolean; credits?: number }>(
          '/payment/verify-solana-payment',
          { method: 'POST', body: { reference } }
        );
        if (res.confirmed) {
          stopPolling();
          setSolanaStatus('confirmed');
          setTimeout(() => navigate('/dashboard?credits_added=true&method=solana'), 2500);
        } else if (res.expired) {
          stopPolling();
          setSolanaStatus('expired');
        }
      } catch { /* keep polling */ }
    }, 5000);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current!); setSolanaStatus('expired'); stopPolling(); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const closeModal = () => {
    stopPolling();
    setSolanaModal(null);
    setSolanaStatus('waiting');
    setSelectedPack(null);
  };

  const copyWallet = async () => {
    if (!solanaModal) return;
    await navigator.clipboard.writeText(solanaModal.merchant);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const currentPacks = payMethod === 'solana' ? SOLANA_PACKS : packs;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</Link>
            <Link to="/settings" className="text-gray-400 hover:text-white text-sm">Settings</Link>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Buy Credits</h1>
          <p className="text-gray-400">Each credit = one AI tool use. Credits never expire.</p>
          {user?.plan === 'FREE' && (
            <p className="text-sm text-indigo-400 mt-2">
              Want unlimited?{' '}
              <Link to="/pricing" className="underline hover:text-indigo-300">Upgrade to Pro →</Link>
            </p>
          )}
        </div>

        {/* Payment method toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setPayMethod('stripe')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                payMethod === 'stripe'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              💳 Pay with Card
            </button>
            <button
              onClick={() => setPayMethod('solana')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                payMethod === 'solana'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ◎ Pay with USDC
            </button>
          </div>
        </div>

        {/* Packs grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {currentPacks.map(pack => {
            const price = payMethod === 'solana'
              ? `$${(pack as typeof SOLANA_PACKS[0]).amountUsdc.toFixed(2)} USDC`
              : `$${((pack as CreditPack).price / 100).toFixed(2)}`;
            return (
              <div
                key={pack.id}
                className={`relative rounded-xl border bg-gray-900 p-6 flex flex-col gap-4 transition-colors cursor-pointer ${
                  pack.popular
                    ? 'border-indigo-500'
                    : 'border-gray-700 hover:border-indigo-500 hover:bg-indigo-900/20'
                }`}
                onClick={() => setSelectedPack(pack.id)}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold">{pack.name}</h2>
                  <p className="text-gray-400 text-sm mt-1">{pack.credits} credits</p>
                </div>
                <div className="text-3xl font-bold">
                  {price}
                  <span className="text-sm font-normal text-gray-400 ml-1">one-time</span>
                </div>
                <ul className="text-sm text-gray-400 list-disc list-inside">
                  <li>No subscription required</li>
                  <li>Works for all AI tools</li>
                </ul>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    payMethod === 'stripe' ? handleStripeBuy(pack.id) : handleSolanaBuy(pack.id);
                  }}
                  disabled={(loading || solanaLoading) && selectedPack === pack.id}
                  className={`w-full py-2 rounded-lg font-semibold transition ${
                    pack.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  } disabled:opacity-50`}
                >
                  {(loading || solanaLoading) && selectedPack === pack.id
                    ? '...'
                    : payMethod === 'solana'
                    ? `Pay ${price}`
                    : `Buy ${pack.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-center text-sm text-gray-500">
          {payMethod === 'stripe'
            ? 'Payments processed securely by Stripe. Credits added instantly.'
            : 'Pay with USDC on Solana. Credits added automatically once confirmed on-chain.'}
        </div>
      </div>

      {/* Solana payment modal */}
      {solanaModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-sm w-full p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 text-xl leading-none"
            >
              ✕
            </button>

            {solanaStatus === 'waiting' && (
              <>
                <h2 className="text-lg font-bold text-white mb-1">Pay with USDC</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Send <span className="text-white font-semibold">{solanaModal.amountUsdc} USDC</span> to receive{' '}
                  <span className="text-white font-semibold">{solanaModal.credits} credits</span>
                </p>

                {/* QR code */}
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCodeSVG value={solanaModal.solanaPayUrl} size={180} />
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center mb-3">
                  Scan with Phantom, Solflare, or any Solana Pay wallet
                </p>

                {/* Wallet address */}
                <div className="bg-gray-950 rounded-lg px-3 py-2 flex items-center gap-2 mb-4">
                  <code className="text-xs text-gray-300 flex-1 truncate">{solanaModal.merchant}</code>
                  <button
                    onClick={copyWallet}
                    className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0 transition-colors"
                  >
                    {copiedWallet ? '✓' : 'Copy'}
                  </button>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Watching for payment…
                  </span>
                  <span className={secondsLeft < 120 ? 'text-red-400' : ''}>{fmt(secondsLeft)}</span>
                </div>
              </>
            )}

            {solanaStatus === 'confirmed' && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <h2 className="text-xl font-bold text-white mb-1">Payment confirmed!</h2>
                <p className="text-gray-400 text-sm">{solanaModal.credits} credits added to your account.</p>
                <p className="text-xs text-gray-600 mt-2">Redirecting to dashboard…</p>
              </div>
            )}

            {solanaStatus === 'expired' && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">⏱</div>
                <h2 className="text-xl font-bold text-white mb-1">Payment expired</h2>
                <p className="text-gray-400 text-sm mb-4">The 15-minute window closed. Please try again.</p>
                <button
                  onClick={closeModal}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold text-white"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyCreditsPage;
