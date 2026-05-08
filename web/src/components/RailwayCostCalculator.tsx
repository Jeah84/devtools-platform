import { useState } from 'react';
import { api } from '../lib/api';

interface Service {
  type: string;
  ramMb: number;
  vcpu: number;
  hoursPerMonth: number;
  instances: number;
}

interface CostResult {
  lineItems: { label: string; monthlyCost: number; breakdown: string }[];
  totalMonthly: number;
  totalAnnual: number;
  optimizationTips: { title: string; description: string; estimatedSaving: string }[];
  summary: string;
  calculatedAt: string;
}

const DEFAULT_SERVICE: Service = {
  type: 'Web server',
  ramMb: 512,
  vcpu: 0.5,
  hoursPerMonth: 744,
  instances: 1,
};

export default function RailwayCostCalculator() {
  const [services, setServices] = useState<Service[]>([{ ...DEFAULT_SERVICE }]);
  const [egressGb, setEgressGb] = useState(1);
  const [buildMinutes, setBuildMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CostResult | null>(null);
  const [error, setError] = useState('');
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const addService = () => setServices(s => [...s, { ...DEFAULT_SERVICE }]);
  const removeService = (i: number) => setServices(s => s.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof Service, value: any) =>
    setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: value } : svc));

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api<CostResult>('/railway/calculate', {
        method: 'POST',
        body: { services, databases: [], egressGb, buildMinutes },
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to calculate costs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Cost Calculator</h3>
        <p className="text-xs text-gray-500 mb-5">
          Configure your services to get an AI-powered monthly cost estimate with optimization tips.
        </p>

        {/* Services */}
        <div className="space-y-3 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Services</p>
          {services.map((svc, i) => (
            <div key={i} className="rounded-lg border border-gray-700 bg-gray-950 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service {i + 1}</span>
                {services.length > 1 && (
                  <button onClick={() => removeService(i)} className="text-xs text-red-500 hover:text-red-400 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-3">
                  <label className="mb-1 block text-xs text-gray-500">Type</label>
                  <select
                    value={svc.type}
                    onChange={e => updateService(i, 'type', e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600"
                  >
                    {['Web server', 'Background worker', 'Cron job', 'API server', 'Static site', 'Other'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">RAM</label>
                  <select value={svc.ramMb} onChange={e => updateService(i, 'ramMb', Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600">
                    {[256, 512, 1024, 2048, 4096, 8192].map(v => (
                      <option key={v} value={v}>{v < 1024 ? `${v}MB` : `${v / 1024}GB`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">vCPU</label>
                  <select value={svc.vcpu} onChange={e => updateService(i, 'vcpu', Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600">
                    {[0.25, 0.5, 1, 2, 4, 8].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Hours/month</label>
                  <select value={svc.hoursPerMonth} onChange={e => updateService(i, 'hoursPerMonth', Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600">
                    {[24, 72, 168, 336, 500, 744].map(v => (
                      <option key={v} value={v}>{v} hrs{v === 744 ? ' (24/7)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Replicas</label>
                  <select value={svc.instances} onChange={e => updateService(i, 'instances', Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600">
                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addService}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            + Add service
          </button>
        </div>

        {/* Network + Build */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Outbound traffic (GB/mo)</label>
            <select value={egressGb} onChange={e => setEgressGb(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600">
              {[0, 1, 5, 10, 50, 100, 500].map(v => <option key={v} value={v}>{v === 0 ? 'Minimal' : `${v}GB`}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Build minutes/mo</label>
            <select value={buildMinutes} onChange={e => setBuildMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600">
              {[30, 60, 120, 250, 500, 1000].map(v => <option key={v} value={v}>{v} min</option>)}
            </select>
          </div>
        </div>

        <button onClick={handleCalculate} disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors">
          {loading ? <><span className="animate-spin">⟳</span> Calculating…</> : <>💰 Estimate Cost</>}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Total */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-3xl font-bold text-white">${result.totalMonthly.toFixed(2)}</span>
              <span className="text-gray-400 text-sm">/month</span>
              <span className="text-gray-600 text-sm ml-auto">${result.totalAnnual.toFixed(2)}/yr</span>
            </div>
            <p className="text-sm text-gray-400">{result.summary}</p>
          </div>

          {/* Line items */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Cost Breakdown</p>
            <div className="space-y-2">
              {result.lineItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{item.label}</span>
                      <span className="text-sm font-semibold text-white tabular-nums">${item.monthlyCost.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{item.breakdown}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimization tips */}
          {result.optimizationTips.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">💡 Optimization Tips</p>
              <div className="space-y-2">
                {result.optimizationTips.map((tip, i) => (
                  <div key={i} className="rounded-lg border border-gray-700 bg-gray-950">
                    <button onClick={() => setExpandedTip(expandedTip === i ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left">
                      <span className="text-sm font-medium text-gray-200">{tip.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400 font-semibold">{tip.estimatedSaving}</span>
                        <span className="text-gray-600">{expandedTip === i ? '▴' : '▾'}</span>
                      </div>
                    </button>
                    {expandedTip === i && (
                      <div className="px-4 pb-3 border-t border-gray-800 pt-2">
                        <p className="text-sm text-gray-400">{tip.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
