import React, { useState } from 'react';
import FraudDashboard from './FraudDashboard';
import AnalyticsCharts from './AnalyticsCharts';
import AutoNegotiationSettings from './AutoNegotiationSettings';
import NegotiationHistory from './NegotiationHistory';
import PriorityDashboard from './PriorityDashboard';
import MeetingReminders from './MeetingReminders';
import DealPipelineBoard from './DealPipelineBoard';
import EmailSettingsPanel from './EmailSettingsPanel';

interface AutomationControlsProps {
  onNavigate?: (view: string) => void;
}

const AutomationControls: React.FC<AutomationControlsProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'fraud' | 'analytics' | 'priority' | 'pipeline' | 'meetings' | 'negotiation' | 'history' | 'email' | 'settings'>('fraud');
  const [autoFollowUpEnabled, setAutoFollowUpEnabled] = useState(true);
  const [autoFraudDetectionEnabled, setAutoFraudDetectionEnabled] = useState(true);
  const [autoNegotiationEnabled, setAutoNegotiationEnabled] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-sky-400">🤖 Automation Controls</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('fraud')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'fraud' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            🚨 Fraud Detection
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            📊 Analytics
          </button>
          <button
            onClick={() => setActiveTab('priority')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'priority' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            🎯 Priority
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pipeline' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            📋 Pipeline
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'meetings' ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            📅 Předání
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'email' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            📧 Email
          </button>
          <button
            onClick={() => setActiveTab('negotiation')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'negotiation' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            💰 Vyjednávání
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            💬 Historie
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'settings' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            ⚙️ Nastavení
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'fraud' && (
        <FraudDashboard />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsCharts period={30} />
      )}

      {activeTab === 'priority' && (
        <PriorityDashboard />
      )}

      {activeTab === 'pipeline' && (
        <DealPipelineBoard />
      )}

      {activeTab === 'meetings' && (
        <MeetingReminders />
      )}

      {activeTab === 'email' && (
        <EmailSettingsPanel />
      )}

      {activeTab === 'negotiation' && (
        <AutoNegotiationSettings />
      )}

      {activeTab === 'history' && (
        <NegotiationHistory />
      )}

      {activeTab === 'settings' && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
          <h3 className="text-lg font-semibold text-slate-200">Automatizace</h3>

          {/* Auto Follow-up */}
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
            <div>
              <div className="font-medium text-slate-200">📧 Auto Follow-up</div>
              <div className="text-sm text-slate-400">Automatické připomínky po 24/48 hodinách</div>
            </div>
            <button
              onClick={() => setAutoFollowUpEnabled(!autoFollowUpEnabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                autoFollowUpEnabled ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  autoFollowUpEnabled ? 'left-8' : 'left-1'
                }`}
              ></div>
            </button>
          </div>

          {/* Auto Fraud Detection */}
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
            <div>
              <div className="font-medium text-slate-200">🚨 Auto Fraud Detection</div>
              <div className="text-sm text-slate-400">AI analýza inzerátů na podvody</div>
            </div>
            <button
              onClick={() => setAutoFraudDetectionEnabled(!autoFraudDetectionEnabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                autoFraudDetectionEnabled ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  autoFraudDetectionEnabled ? 'left-8' : 'left-1'
                }`}
              ></div>
            </button>
          </div>

          {/* Auto Negotiation */}
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
            <div>
              <div className="font-medium text-slate-200">💰 Auto Negotiation</div>
              <div className="text-sm text-slate-400">AI vyjednávání cen a counter-offers</div>
            </div>
            <button
              onClick={() => setAutoNegotiationEnabled(!autoNegotiationEnabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                autoNegotiationEnabled ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  autoNegotiationEnabled ? 'left-8' : 'left-1'
                }`}
              ></div>
            </button>
          </div>

          {/* Additional Settings */}
          <div className="border-t border-slate-700 pt-6 space-y-4">
            <h4 className="font-medium text-slate-300">Pokročilá nastavení</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Minimální zisk (Kč)</label>
                <input
                  type="number"
                  defaultValue={1000}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Fraud threshold</label>
                <select
                  defaultValue={50}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={30}>Low (30)</option>
                  <option value={50}>Medium (50)</option>
                  <option value={70}>High (70)</option>
                  <option value={80}>Critical (80)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Watchlist expirace (dny)</label>
              <input
                type="number"
                defaultValue={90}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => alert('Nastavení uloženo!')}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
            >
              Uložit nastavení
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationControls;
