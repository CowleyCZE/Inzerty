import { useState } from 'react';
import { MatchItem } from '../types';

export const useAutomation = (getMatchKey: (offer: any, demand: any) => string) => {
  const [runningAutomation, setRunningAutomation] = useState<Set<string>>(new Set());
  const [automationResults, setAutomationResults] = useState<Record<string, any>>({});

  const runAutonomousProcess = async (match: MatchItem) => {
    const matchKey = getMatchKey(match.offer, match.demand);
    
    setRunningAutomation((prev) => new Set(prev).add(matchKey));
    setAutomationResults((prev) => ({ ...prev, [matchKey]: { status: 'running', message: 'Spouštím autonomní proces...' } }));

    try {
      console.log('[AUTOMATION] Starting automation for matchKey:', matchKey);
      
      const requestBody = {
        matchKey,
        match: {
          offer: {
            title: match.offer.title,
            price: match.offer.price,
            location: match.offer.location || '',
            url: match.offer.url,
          },
          demand: {
            title: match.demand.title,
            price: match.demand.price,
            location: match.demand.location || '',
            url: match.demand.url,
          },
          arbitrageScore: match.arbitrageScore,
          similarityScore: match.similarity,
          realOpportunityScore: match.realOpportunityScore,
        },
      };

      const response = await fetch(`http://localhost:3001/automation/run-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server vrátil neočekávanou odpověď. Status: ${response.status}. Náhled: ${text.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Autonomní proces selhal');
      }

      const result = await response.json();
      
      setAutomationResults((prev) => ({ 
        ...prev, 
        [matchKey]: { 
          status: 'success', 
          message: `Dokončeno: ${result.summary.success}/${result.summary.total} kroků`,
          data: result 
        } 
      }));

      const successSteps = result.results
        .filter((r: any) => r.success)
        .map((r: any) => `✅ ${r.step}: ${r.message}`)
        .join('\n');
      
      const failedSteps = result.results
        .filter((r: any) => !r.success)
        .map((r: any) => `❌ ${r.step}: ${r.error || r.message}`)
        .join('\n');

      alert(`🚀 Autonomní proces dokončen!\n\n${successSteps}${failedSteps ? '\n\n' + failedSteps : ''}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Neznámá chyba';
      console.error('[AUTOMATION] Error:', error);
      setAutomationResults((prev) => ({ 
        ...prev, 
        [matchKey]: { 
          status: 'error', 
          message: errorMessage 
        } 
      }));
      alert(`❌ Autonomní proces selhal: ${errorMessage}`);
    } finally {
      setRunningAutomation((prev) => {
        const next = new Set(prev);
        next.delete(matchKey);
        return next;
      });
    }
  };

  return {
    runningAutomation,
    automationResults,
    runAutonomousProcess,
  };
};
