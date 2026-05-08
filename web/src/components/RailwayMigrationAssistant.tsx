import { useState } from 'react';
import { api } from '../lib/api';

interface MigrationStep {
  stepNumber: number;
  title: string;
  description: string;
  commands: string[];
  warnings: string[];
}

interface MigrationResult {
  overview: string;
  estimatedDowntime: string;
  steps: MigrationStep[];
  rollbackPlan: string;
  additionalNotes: string[];
  generatedAt: string;
}

const DB_ENGINES = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL / MariaDB' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'redis', label: 'Redis' },
  { value: 'planetscale', label: 'PlanetScale (MySQL)' },
  { value: 'other', label: 'Other' },
];

const CURRENT_HOSTS = [
  { value: 'heroku', label: 'Heroku' },
  { value: 'aws-rds', label: 'AWS RDS' },
  { value: 'aws-aurora', label: 'AWS Aurora' },
  { value: 'digitalocean', label: 'DigitalOcean Managed DB' },
  { value: 'planetscale', label: 'PlanetScale' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'render', label: 'Render' },
  { value: 'local', label: 'Local / Self-hosted' },
  { value: 'other', label: 'Other' },
];

const SIZE_OPTIONS = [
  { value: 'tiny', label: 'Tiny (< 100MB)' },
  { value: 'small', label: 'Small (100MB – 1GB)' },
  { value: 'medium', label: 'Medium (1GB – 10GB)' },
  { value: 'large', label: 'Large (10GB – 100GB)' },
  { value: 'xlarge', label: 'XL (100GB+)' },
  { value: 'unknown', label: "I'm not sure" },
];

const DOWNTIME_COLOR = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('zero') || lower.includes('no downtime')) return 'text-green-400';
  if (lower.includes('minute')) return 'text-yellow-400';
  return 'text-orange-400';
};

export default function RailwayMigrationAssistant() {
  const [engine, setEngine] = useState('postgresql');
  const [currentHost, setCurrentHost] = useState('heroku');
  const [sizeEstimate, setSizeEstimate] = useState('small');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState('');
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setExpandedStep(0);
    try {
      const data = await api<MigrationResult>('/railway/migrate', {
        method: 'POST',
        body: { engine, currentHost, sizeEstimate, notes },
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate migration guide. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback silently
    }
  };

  return (
    <div className="space-y-5">
      {/* Input form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-1">DB Migration Assistant</h3>
        <p className="text-xs text-gray-500 mb-5">
          Get a step-by-step guide for migrating your database to Railway, including CLI commands and a rollback plan.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Database engine</label>
            <select
              value={engine}
              onChange={e => setEngine(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600"
            >
              {DB_ENGINES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Currently hosted on</label>
            <select
              value={currentHost}
              onChange={e => setCurrentHost(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600"
            >
              {CURRENT_HOSTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Database size</label>
            <select
              value={sizeEstimate}
              onChange={e => setSizeEstimate(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-600"
            >
              {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-gray-500">Special requirements or notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. zero-downtime required, custom extensions, replication setup…"
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-600 transition-colors"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors"
        >
          {loading
            ? <><span className="animate-spin">⟳</span> Generating guide…</>
            : <>🚂 Generate Migration Guide</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Overview */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{result.overview}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded">
                    {result.steps.length} steps
                  </span>
                  <span className={`bg-gray-800 px-2 py-1 rounded font-semibold ${DOWNTIME_COLOR(result.estimatedDowntime)}`}>
                    ⏱ {result.estimatedDowntime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 px-1">Migration Steps</p>
            {result.steps.map((step, i) => {
              const open = expandedStep === i;
              const allCommands = step.commands.join('\n');
              const copyId = `step-${i}`;
              return (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800">
                  <button
                    onClick={() => setExpandedStep(open ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-600/40 text-indigo-400 text-xs font-bold flex items-center justify-center">
                      {step.stepNumber}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-200">{step.title}</span>
                    {step.commands.length > 0 && (
                      <span className="text-xs text-gray-600 shrink-0 hidden sm:block">
                        {step.commands.length} cmd{step.commands.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-gray-600 ml-2">{open ? '▴' : '▾'}</span>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                      <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>

                      {step.commands.length > 0 && (
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 font-mono">commands</span>
                            <button
                              onClick={() => copyToClipboard(allCommands, copyId)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              {copied === copyId ? '✓ Copied' : 'Copy all'}
                            </button>
                          </div>
                          <div className="bg-gray-950 rounded-lg p-3 space-y-1.5">
                            {step.commands.map((cmd, ci) => (
                              <pre key={ci} className="text-xs text-green-300 font-mono whitespace-pre-wrap break-all">
                                <span className="text-gray-600 select-none mr-2">$</span>{cmd}
                              </pre>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.warnings.length > 0 && (
                        <div className="space-y-1">
                          {step.warnings.map((w, wi) => (
                            <div key={wi} className="flex gap-2 text-xs text-yellow-400 bg-yellow-900/10 border border-yellow-900/30 rounded px-3 py-2">
                              <span className="shrink-0">⚠</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rollback plan */}
          {result.rollbackPlan && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">🔄 Rollback Plan</p>
              <p className="text-sm text-gray-400 leading-relaxed">{result.rollbackPlan}</p>
            </div>
          )}

          {/* Additional notes */}
          {result.additionalNotes.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">💡 Additional Notes</p>
              <ul className="space-y-2">
                {result.additionalNotes.map((note, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-400">
                    <span className="text-indigo-500 shrink-0 mt-0.5">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
