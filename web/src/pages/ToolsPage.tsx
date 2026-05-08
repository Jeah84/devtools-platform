//   import RailwayMigrationAssistant from '../components/RailwayMigrationAssistant';
// ============================================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import JsonYamlFormatter from '../components/JsonYamlFormatter';
import RegexTester from '../components/RegexTester';
import CodeReviewer from '../components/CodeReviewer';
import RailwayConfigValidator from '../components/RailwayConfigValidator';
import RailwayCostCalculator from '../components/RailwayCostCalculator';
import RailwayMigrationAssistant from '../components/RailwayMigrationAssistant';

type Tab = 'jsonyaml' | 'regex' | 'review' | 'validator' | 'calculator' | 'migration';

interface TabDef {
  id: Tab;
  label: string;
  icon: string;
  description: string;
  section?: 'dev' | 'railway';
}

const TABS: TabDef[] = [
  // ── Existing dev tools ──────────────────────────────────
  {
    id: 'jsonyaml',
    label: 'JSON / YAML',
    icon: '{ }',
    description: 'Format and convert between JSON and YAML',
    section: 'dev',
  },
  {
    id: 'regex',
    label: 'Regex Tester',
    icon: '.*',
    description: 'Test and debug regular expressions',
    section: 'dev',
  },
  {
    id: 'review',
    label: 'Code Review',
    icon: '◈',
    description: 'AI-powered code review and suggestions',
    section: 'dev',
  },
  // ── Railway DevTools ────────────────────────────────────
  {
    id: 'validator',
    label: 'Config Validator',
    icon: '⚡',
    description: 'Validate railway.json, Dockerfiles, nixpacks.toml and more',
    section: 'railway',
  },
  {
    id: 'calculator',
    label: 'Cost Calculator',
    icon: '💰',
    description: 'Estimate your monthly Railway infrastructure cost',
    section: 'railway',
  },
  {
    id: 'migration',
    label: 'DB Migration',
    icon: '🚂',
    description: 'Step-by-step guide to migrate your database to Railway',
    section: 'railway',
  },
];

export default function ToolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) ?? 'jsonyaml';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const isPro = user?.plan === 'PRO';

  // Railway tools require at least 1 credit or Pro plan
  const canUseRailway = isPro || (user?.credits ?? 0) > 0;

  const devTabs     = TABS.filter(t => t.section === 'dev');
  const railwayTabs = TABS.filter(t => t.section === 'railway');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-3"
          >
            <span>←</span> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white mb-1">Developer Tools</h1>
          <p className="text-sm text-gray-500">
            AI-powered tools for developers — code translation, config validation, cost estimation, and more.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="mb-6 space-y-3">
          {/* Dev tools row */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2 px-1">Dev Tools</p>
            <div className="flex flex-wrap gap-2">
              {devTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}
                >
                  <span className="font-mono text-xs opacity-70">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Railway tools row */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2 px-1">
              Railway DevTools
              {!canUseRailway && (
                <span className="ml-2 text-yellow-600 normal-case tracking-normal font-normal">
                  — requires credits
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {railwayTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (!canUseRailway) {
                      navigate('/buy-credits');
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : canUseRailway
                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                      : 'bg-gray-800/50 text-gray-600 cursor-pointer'
                  }`}
                >
                  <span className="text-base leading-none">{tab.icon}</span>
                  {tab.label}
                  {!canUseRailway && (
                    <span className="text-xs bg-yellow-900/40 text-yellow-500 border border-yellow-800/50 px-1.5 py-0.5 rounded">
                      1 credit
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Credits / upgrade nudge for free users */}
        {!isPro && (user?.credits ?? 0) === 0 && (
          <div className="mb-5 rounded-lg border border-yellow-800/40 bg-yellow-900/10 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-yellow-400">
              You have no credits. Railway DevTools cost 1 credit per use.
            </p>
            <button
              onClick={() => navigate('/buy-credits')}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
            >
              Get credits →
            </button>
          </div>
        )}

        {!isPro && (user?.credits ?? 0) > 0 && ['validator', 'calculator', 'migration'].includes(activeTab) && (
          <div className="mb-5 rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              {user?.credits} credit{user?.credits !== 1 ? 's' : ''} remaining — 1 used per Railway tool call
            </p>
            <button
              onClick={() => navigate('/buy-credits')}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
            >
              Top up →
            </button>
          </div>
        )}

        {/* Active tool panel */}
        <div>
          {activeTab === 'jsonyaml'    && <JsonYamlFormatter />}
          {activeTab === 'regex'       && <RegexTester />}
          {activeTab === 'review'      && <CodeReviewer />}
          {activeTab === 'validator'   && <RailwayConfigValidator />}
          {activeTab === 'calculator'  && <RailwayCostCalculator />}
          {activeTab === 'migration'   && <RailwayMigrationAssistant />}
        </div>
      </div>
    </div>
  );
}
