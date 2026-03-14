import React, { useEffect, useState } from 'react';

interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  from_email: string;
  from_name: string;
  enabled: boolean;
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  variables?: string;
}

const EmailSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: false,
    from_email: '',
    from_name: 'Inzerty Bot',
    enabled: false,
  });

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTemplates();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/email/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('http://localhost:3001/email/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:3001/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('✅ Nastavení uloženo!');
      }
    } catch (error) {
      alert('❌ Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Načítám nastavení emailu...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sky-400 flex items-center gap-2">
          <span>📧</span>
          Email Notifications
        </h3>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showTemplates ? '📧 Nastavení' : '📄 Šablony'}
        </button>
      </div>

      {showTemplates ? (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-300">Email šablony</h4>
          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((template) => (
                <div key={template.id} className="p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="font-medium text-slate-200">{template.name}</div>
                  <div className="text-sm text-slate-400">{template.subject}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Žádné šablony k dispozici</div>
          )}
        </div>
      ) : (
        <>
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
            <div>
              <div className="font-medium text-slate-200">Povolit email notifikace</div>
              <div className="text-sm text-slate-400">Odesílat upozornění na critical fraud risk</div>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative w-16 h-8 rounded-full transition-colors ${
                settings.enabled ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  settings.enabled ? 'left-9' : 'left-1'
                }`}
              ></div>
            </button>
          </div>

          {/* SMTP Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">SMTP Host</label>
              <input
                type="text"
                value={settings.smtp_host}
                onChange={(e) => setSettings(s => ({ ...s, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com"
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">SMTP Port</label>
              <input
                type="number"
                value={settings.smtp_port}
                onChange={(e) => setSettings(s => ({ ...s, smtp_port: Number(e.target.value) }))}
                placeholder="587"
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">SMTP User</label>
              <input
                type="text"
                value={settings.smtp_user}
                onChange={(e) => setSettings(s => ({ ...s, smtp_user: e.target.value }))}
                placeholder="your@email.com"
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">SMTP Password</label>
              <input
                type="password"
                value={settings.smtp_pass}
                onChange={(e) => setSettings(s => ({ ...s, smtp_pass: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">From Email</label>
              <input
                type="email"
                value={settings.from_email}
                onChange={(e) => setSettings(s => ({ ...s, from_email: e.target.value }))}
                placeholder="noreply@inzerty.cz"
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">From Name</label>
              <input
                type="text"
                value={settings.from_name}
                onChange={(e) => setSettings(s => ({ ...s, from_name: e.target.value }))}
                placeholder="Inzerty Bot"
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtp_secure"
              checked={settings.smtp_secure}
              onChange={(e) => setSettings(s => ({ ...s, smtp_secure: e.target.checked }))}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600"
            />
            <label htmlFor="smtp_secure" className="text-sm text-slate-300">
              Použít SSL/TLS encryption
            </label>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-slate-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? 'Ukládám...' : '💾 Uložit nastavení'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default EmailSettingsPanel;
