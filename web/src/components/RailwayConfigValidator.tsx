import { useState } from 'react';
import { api } from '../lib/api';

type Severity = 'critical' | 'warning' | 'info';

interface Issue {
  severity: Severity;
  category: string;
  title: string;
  description: string;
  fix: string;
}

interface ValidationResult {
  issues: Issue[];
  summary: string;
  configFormat: string;
  score: number;
  checkedAt: string;
}

const SEVERITY_STYLES: Record<Severity, { bar: string; badge: string; label: string }> = {
  critical: { bar: 'border-l-red-500',    badge: 'bg-red-900/40 text-red-400 border-red-700/50',    label: 'Critical' },
  warning:  { bar: 'border-l-yellow-500', badge: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50', label: 'Warning' },
  info:     { bar: 'border-l-blue-500',   badge: 'bg-blue-900/40 text-blue-400 border-blue-700/50',  label: 'Info' },
};

const SCORE_COLOR = (score: number) =>
  score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

const FORMAT_LABELS: Record<string, string> = {
  'railway-json': 'railway.json', 'railway-toml': 'railway.toml',
  dockerfile: 'Dockerfile', nixpacks: 'nixpacks.toml',
  railpack: 'railpack.json', procfile: 'Procfile', unknown: 'Auto-detected',
};

const SAMPLE_CONFIG = `{
  "services": [
    {
      "name": "web",
      "build": { "builder": "nixpacks" },
      "deploy": {
        "startCommand": "node server.js",
        "restartPolicyType": "ON_FAILURE"
      },
      "variables": { "PORT": "3000" }
    }
  ]
}`;

export default function RailwayConfigValidator() {
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const handleValidate = async () => {
    if (!config.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setExpanded({});
    try {
      const data = await api<ValidationResult>('/railway/validate', {
        method: 'POST',
        body: { config },
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Validation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const critical = result?.issues.filter(i => i.severity === 'critical') ?? [];
  const warnings  = result?.issues.filter(i => i.severity === 'warning') ?? [];
  const infos     = result?.issues.filter(i => i.severity === 'info') ?? [];

  return (
    <div className="space-y-5">
      {/* Input area */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Config Validator</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Supports railway.json · railway.toml · Dockerfile · nixpacks.toml · railpack.json · Procfile
            </p>
          </div>
          <button
            onClick={() => setConfig(SAMPLE_CONFIG)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Load sample →
          </button>
        </div>

        <textarea
          value={config}
          onChange={e => setConfig(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleValidate(); }}
          placeholder="Paste any Railway config — we'll detect the format automatically…"
          rows={14}
          className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-600 transition-colors"
          spellCheck={false}
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleValidate}
            disabled={loading || !config.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors"
          >
            {loading ? (
              <><span className="animate-spin">⟳</span> Analyzing…</>
            ) : (
              <>⚡ Validate Config</>
            )}
          </button>
          {config && (
            <button onClick={() => { setConfig(''); setResult(null); setError(''); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-600 hidden sm:block">⌘+Enter to validate</span>
        </div>
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
          {/* Score card */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex items-start gap-5">
            <div className="text-center shrink-0">
              <div className={`text-4xl font-bold tabular-nums ${SCORE_COLOR(result.score)}`}>
                {result.score}
              </div>
              <div className="text-xs text-gray-500 mt-1">/ 100</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 leading-relaxed">{result.summary}</p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded">
                  Format: {FORMAT_LABELS[result.configFormat] ?? result.configFormat}
                </span>
                {critical.length > 0 && <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded">{critical.length} critical</span>}
                {warnings.length > 0 && <span className="bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded">{warnings.length} warnings</span>}
                {infos.length > 0 && <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded">{infos.length} info</span>}
                {result.issues.length === 0 && <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded">✓ No issues found</span>}
              </div>
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              {result.issues.map((issue, i) => {
                const styles = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
                const open = expanded[i];
                return (
                  <div key={i} className={`rounded-lg border border-gray-800 bg-gray-900 border-l-4 ${styles.bar}`}>
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${styles.badge} shrink-0`}>
                        {styles.label}
                      </span>
                      <span className="text-sm font-medium text-gray-200 flex-1">{issue.title}</span>
                      <span className="text-xs text-gray-600 shrink-0">{issue.category}</span>
                      <span className="text-gray-600 ml-2">{open ? '▴' : '▾'}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                        <p className="text-sm text-gray-400 leading-relaxed">{issue.description}</p>
                        {issue.fix && (
                          <div className="bg-gray-950 rounded-lg p-3">
                            <p className="text-xs text-green-400 font-semibold mb-1">✓ Fix</p>
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{issue.fix}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
