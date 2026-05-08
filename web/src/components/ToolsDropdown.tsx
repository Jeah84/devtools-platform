import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Tool {
  id: string;
  label: string;
  icon: string;
  description: string;
  tab: string;
  section: 'dev' | 'railway';
  proOnly?: boolean;
}

const TOOLS: Tool[] = [
  // ── Existing dev tools ────────────────────────────────
  {
    id: 'jsonyaml',
    label: 'JSON / YAML',
    icon: '{ }',
    description: 'Format & convert',
    tab: 'jsonyaml',
    section: 'dev',
  },
  {
    id: 'regex',
    label: 'Regex Tester',
    icon: '.*',
    description: 'Test patterns',
    tab: 'regex',
    section: 'dev',
  },
  {
    id: 'review',
    label: 'Code Review',
    icon: '◈',
    description: 'AI code review',
    tab: 'review',
    section: 'dev',
    proOnly: true,
  },
  // ── Railway DevTools ──────────────────────────────────
  {
    id: 'validator',
    label: 'Config Validator',
    icon: '⚡',
    description: 'Validate Railway configs',
    tab: 'validator',
    section: 'railway',
  },
  {
    id: 'calculator',
    label: 'Cost Calculator',
    icon: '💰',
    description: 'Estimate Railway costs',
    tab: 'calculator',
    section: 'railway',
  },
  {
    id: 'migration',
    label: 'DB Migration',
    icon: '🚂',
    description: 'Migrate to Railway',
    tab: 'migration',
    section: 'railway',
  },
];

export default function ToolsDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isPro = user?.plan === 'PRO';
  const hasCredits = (user?.credits ?? 0) > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (tool: Tool) => {
    setOpen(false);
    if (tool.proOnly && !isPro) {
      navigate('/buy-credits');
      return;
    }
    // Railway tools need credits
    if (tool.section === 'railway' && !isPro && !hasCredits) {
      navigate('/buy-credits');
      return;
    }
    navigate(`/tools?tab=${tool.tab}`);
  };

  const devTools     = TOOLS.filter(t => t.section === 'dev');
  const railwayTools = TOOLS.filter(t => t.section === 'railway');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
      >
        Tools
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 rounded-xl border border-gray-800 bg-gray-900 shadow-xl z-50 overflow-hidden py-2">

          {/* Dev tools section */}
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-600">
            Dev Tools
          </p>
          {devTools.map(tool => (
            <button
              key={tool.id}
              onClick={() => handleSelect(tool)}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="w-7 h-7 rounded-md bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-mono shrink-0">
                {tool.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">{tool.label}</span>
                  {tool.proOnly && !isPro && (
                    <span className="text-xs bg-indigo-900/40 text-indigo-400 border border-indigo-800/50 px-1.5 py-0.5 rounded">
                      Pro
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
              </div>
            </button>
          ))}

          {/* Divider */}
          <div className="my-2 border-t border-gray-800" />

          {/* Railway tools section */}
          <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-600">
            Railway DevTools
          </p>
          {railwayTools.map(tool => {
            const locked = !isPro && !hasCredits;
            return (
              <button
                key={tool.id}
                onClick={() => handleSelect(tool)}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left"
              >
                <span className="w-7 h-7 rounded-md bg-gray-800 border border-gray-700 flex items-center justify-center text-base shrink-0">
                  {tool.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${locked ? 'text-gray-500' : 'text-gray-200'}`}>
                      {tool.label}
                    </span>
                    {!isPro && (
                      <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded">
                        1 credit
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                </div>
              </button>
            );
          })}

          {/* Bottom nudge for 0-credit users */}
          {!isPro && !hasCredits && (
            <div className="mx-2 mb-1 mt-2 rounded-lg bg-indigo-950/50 border border-indigo-900/40 px-3 py-2">
              <p className="text-xs text-indigo-400">
                Railway tools cost 1 credit each.{' '}
                <button
                  onClick={() => { setOpen(false); navigate('/buy-credits'); }}
                  className="underline hover:text-indigo-300 transition-colors"
                >
                  Get credits →
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
