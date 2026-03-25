import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MatchCard } from './MatchCard';
import { MatchItem, MatchMeta } from '../../types';

// Mock child components to keep the test focused on MatchCard logic
vi.mock('./MatchCardInfo', () => ({ MatchCardInfo: () => <div data-testid="match-card-info" /> }));
vi.mock('./StatusControls', () => ({ StatusControls: () => <div data-testid="status-controls" /> }));
vi.mock('./DueDiligenceChecklist', () => ({ DueDiligenceChecklist: () => <div data-testid="due-diligence-checklist" /> }));
vi.mock('./MatchActions', () => ({ 
  MatchActions: ({ onToggleResolved }: any) => (
    <div data-testid="match-actions">
      <button data-testid="btn-resolve" onClick={onToggleResolved}>Resolve</button>
    </div>
  ) 
}));

describe('MatchCard Component', () => {
  const mockMatch: MatchItem = {
    offer: { id: 'o1', title: 'Offer 1', price: '1000' } as any,
    demand: { id: 'd1', title: 'Demand 1', price: '2000' } as any,
    arbitrageScore: 1000,
    realOpportunityScore: 90,
    similarity: 80,
    expectedNetProfit: 600,
    locationScore: 50,
    priceTrustScore: 60,
  };

  const mockMeta: MatchMeta = {
    status: 'new',
    priority: 'high',
    note: '',
    checklist: {
      imeiVerified: false,
      batteryHealthChecked: false,
      displayChecked: false,
      accessoriesChecked: false,
      warrantyProofChecked: false
    },
    resolved: false,
    lastActionAt: new Date().toISOString(),
    followUpAt: '',
    followUpState: 'none',
  };

  const statusLabel = {
    new: 'Nový',
    analyzing: 'Analyzuji',
    review: 'K revizi',
    contacted: 'Kontaktováno',
    negotiating: 'Vyjednávání',
    negotiation: 'Vyjednávání',
    deal_closed: 'Uzavřeno',
    closed: 'Uzavřeno',
    rejected: 'Zamítnuto',
  };

  it('renders correctly with given props', () => {
    const toggleSelectMatch = vi.fn();
    const updateMatchMeta = vi.fn();
    const runAutonomousProcess = vi.fn();

    render(
      <MatchCard
        matchKey="o1__d1"
        match={mockMatch}
        meta={mockMeta}
        selectedMatches={new Set()}
        toggleSelectMatch={toggleSelectMatch}
        statusLabel={statusLabel}
        updateMatchMeta={updateMatchMeta}
        runAutonomousProcess={runAutonomousProcess}
        runningAutomation={new Set()}
        automationResults={{}}
      />
    );

    expect(screen.getByText('Nový')).toBeDefined();
    expect(screen.getByText('high')).toBeDefined();
    expect(screen.getByText('+1 000 Kč')).toBeDefined();
    expect(screen.getByText('90')).toBeDefined(); // realOpportunityScore

    expect(screen.getByTestId('match-card-info')).toBeDefined();
    expect(screen.getByTestId('status-controls')).toBeDefined();
    expect(screen.getByTestId('due-diligence-checklist')).toBeDefined();
    expect(screen.getByTestId('match-actions')).toBeDefined();
  });

  it('calls toggleSelectMatch when checkbox is clicked', () => {
    const toggleSelectMatch = vi.fn();
    
    render(
      <MatchCard
        matchKey="o1__d1"
        match={mockMatch}
        meta={mockMeta}
        selectedMatches={new Set(['o1__d1'])}
        toggleSelectMatch={toggleSelectMatch}
        statusLabel={statusLabel}
        updateMatchMeta={vi.fn()}
        runAutonomousProcess={vi.fn()}
        runningAutomation={new Set()}
        automationResults={{}}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    
    fireEvent.click(checkbox);
    expect(toggleSelectMatch).toHaveBeenCalledWith('o1__d1');
  });

  it('updates note correctly via textarea', () => {
    const updateMatchMeta = vi.fn();
    
    render(
      <MatchCard
        matchKey="o1__d1"
        match={mockMatch}
        meta={mockMeta}
        selectedMatches={new Set()}
        toggleSelectMatch={vi.fn()}
        statusLabel={statusLabel}
        updateMatchMeta={updateMatchMeta}
        runAutonomousProcess={vi.fn()}
        runningAutomation={new Set()}
        automationResults={{}}
      />
    );

    const textarea = screen.getByPlaceholderText(/Přidat interní/i);
    fireEvent.change(textarea, { target: { value: 'Nová poznámka' } });

    expect(updateMatchMeta).toHaveBeenCalledWith('o1__d1', { note: 'Nová poznámka' });
  });

  it('toggles resolved state correctly via actions', () => {
    const updateMatchMeta = vi.fn();
    
    render(
      <MatchCard
        matchKey="o1__d1"
        match={mockMatch}
        meta={mockMeta}
        selectedMatches={new Set()}
        toggleSelectMatch={vi.fn()}
        statusLabel={statusLabel}
        updateMatchMeta={updateMatchMeta}
        runAutonomousProcess={vi.fn()}
        runningAutomation={new Set()}
        automationResults={{}}
      />
    );

    const resolveBtn = screen.getByTestId('btn-resolve');
    fireEvent.click(resolveBtn);

    expect(updateMatchMeta).toHaveBeenCalledWith('o1__d1', { resolved: true });
  });
});
