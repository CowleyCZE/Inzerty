import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlertsPanel } from './AlertsPanel';

describe('AlertsPanel Component', () => {
  const defaultAlertsConfig = {
    telegramBotToken: '',
    telegramChatId: '',
    emailWebhookUrl: '',
    discordWebhookUrl: '',
    minProfit: 0,
    minScore: 0,
    enabled: false,
    autoSendAfterCompare: false,
  };

  it('renders default controls correctly', () => {
    render(
      <AlertsPanel
        alertsConfig={defaultAlertsConfig}
        setAlertsConfig={vi.fn()}
        showAlertsConfig={false}
        setShowAlertsConfig={vi.fn()}
        alertsStatus=""
        testAlerts={vi.fn()}
        saveAlertsConfig={vi.fn()}
      />
    );

    expect(screen.getByText('🔔 Konfigurace alertů')).toBeDefined();
    expect(screen.getByText('Zobrazit konfiguraci')).toBeDefined();
    expect(screen.getByText('🧪 Test')).toBeDefined();
    expect(screen.getByText('💾 Uložit')).toBeDefined();
  });

  it('calls testAlerts and saveAlertsConfig on button clicks', () => {
    const testAlerts = vi.fn();
    const saveAlertsConfig = vi.fn();

    render(
      <AlertsPanel
        alertsConfig={defaultAlertsConfig}
        setAlertsConfig={vi.fn()}
        showAlertsConfig={false}
        setShowAlertsConfig={vi.fn()}
        alertsStatus=""
        testAlerts={testAlerts}
        saveAlertsConfig={saveAlertsConfig}
      />
    );

    fireEvent.click(screen.getByText('🧪 Test'));
    expect(testAlerts).toHaveBeenCalled();

    fireEvent.click(screen.getByText('💾 Uložit'));
    expect(saveAlertsConfig).toHaveBeenCalled();
  });

  it('displays config fields when showAlertsConfig is true', () => {
    render(
      <AlertsPanel
        alertsConfig={defaultAlertsConfig}
        setAlertsConfig={vi.fn()}
        showAlertsConfig={true}
        setShowAlertsConfig={vi.fn()}
        alertsStatus=""
        testAlerts={vi.fn()}
        saveAlertsConfig={vi.fn()}
      />
    );

    expect(screen.getByText('Skrýt konfiguraci')).toBeDefined();
    expect(screen.getAllByPlaceholderText(/Bot token/i).length).toBe(2);
    expect(screen.getAllByPlaceholderText(/Chat ID/i).length).toBe(2);
    expect(screen.getByText('Povolit automatické alerty')).toBeDefined();
  });

  it('updates state when input changes', () => {
    const Wrapper = () => {
      const [config, setConfig] = React.useState(defaultAlertsConfig);
      return (
        <AlertsPanel
          alertsConfig={config}
          setAlertsConfig={setConfig}
          showAlertsConfig={true}
          setShowAlertsConfig={vi.fn()}
          alertsStatus=""
          testAlerts={vi.fn()}
          saveAlertsConfig={vi.fn()}
        />
      );
    };
    
    render(<Wrapper />);

    const botTokenInput = screen.getAllByPlaceholderText(/Telegram bot token/i)[0] as HTMLInputElement;
    fireEvent.change(botTokenInput, { target: { value: '12345:TOKEN' } });

    expect(botTokenInput.value).toBe('12345:TOKEN');
  });

  it('shows alerts status message when provided', () => {
    render(
      <AlertsPanel
        alertsConfig={defaultAlertsConfig}
        setAlertsConfig={vi.fn()}
        showAlertsConfig={false}
        setShowAlertsConfig={vi.fn()}
        alertsStatus="Test message successfully sent"
        testAlerts={vi.fn()}
        saveAlertsConfig={vi.fn()}
      />
    );

    expect(screen.getByText('Test message successfully sent')).toBeDefined();
  });
});
