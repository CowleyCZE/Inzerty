import { useState, useEffect } from 'react';
import { MatchItem } from '../types';

const ALERTS_KEY = 'inzerty_alerts_config_v1';

export const useAlertsConfig = () => {
  const [alertsConfig, setAlertsConfig] = useState({
    telegramBotToken: '',
    telegramChatId: '',
    emailWebhookUrl: '',
    discordWebhookUrl: '',
    minProfit: 1500,
    minScore: 70,
    enabled: false,
    autoSendAfterCompare: true,
  });
  const [showAlertsConfig, setShowAlertsConfig] = useState(false);
  const [alertsStatus, setAlertsStatus] = useState<string>('');

  useEffect(() => {
    try {
      const alertRaw = localStorage.getItem(ALERTS_KEY);
      if (alertRaw) setAlertsConfig(JSON.parse(alertRaw));
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alertsConfig));
  }, [alertsConfig]);

  useEffect(() => {
    const loadAlertsConfig = async () => {
      try {
        const res = await fetch('http://localhost:3001/alerts/config');
        if (res.ok) {
          const data = await res.json();
          setAlertsConfig((prev) => ({ ...prev, ...data.config }));
        }
      } catch {
        // Server may not have alerts config endpoint
      }
    };
    loadAlertsConfig();
  }, []);

  const sendTopAlerts = async (filteredMatches: MatchItem[]) => {
    setAlertsStatus('Odesílám alerty...');
    try {
      await fetch('http://localhost:3001/alerts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...alertsConfig, 
          matches: filteredMatches,
        }),
      });
      setAlertsStatus('✅ Alerty úspěšně odeslány!');
      setTimeout(() => setAlertsStatus(''), 3000);
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const saveAlertsConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertsConfig),
      });
      if (res.ok) {
        setAlertsStatus('✅ Konfigurace uložena!');
        setTimeout(() => setAlertsStatus(''), 3000);
      }
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  const testAlerts = async () => {
    setAlertsStatus('Posílám testovací alert...');
    try {
      const res = await fetch('http://localhost:3001/alerts/test', { method: 'POST' });
      if (res.ok) {
        setAlertsStatus('✅ Testovací alert odeslán!');
        setTimeout(() => setAlertsStatus(''), 3000);
      } else {
        setAlertsStatus('❌ Test selhal');
        setTimeout(() => setAlertsStatus(''), 5000);
      }
    } catch (error) {
      setAlertsStatus(`❌ Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      setTimeout(() => setAlertsStatus(''), 5000);
    }
  };

  return {
    alertsConfig,
    setAlertsConfig,
    showAlertsConfig,
    setShowAlertsConfig,
    alertsStatus,
    setAlertsStatus,
    sendTopAlerts,
    saveAlertsConfig,
    testAlerts,
  };
};
