import React from 'react';
import { WorkflowStepValue } from './types';

// This file contains constants that require JSX and re-exports all other constants.
// This allows React components to import everything from a single `.tsx` file.

export * from './constants.ts';

const IconWrapper = ({children}) => <span className="mr-2 text-sky-400">{children}</span>;

export const WORKFLOW_STEPS_CONFIG = [
  { id: WorkflowStepValue.CONFIG, name: 'Konfigurace', icon: <IconWrapper>⚙️</IconWrapper> },
  { id: WorkflowStepValue.INIT_ANTI_DETECTION, name: 'Anti-Detection', icon: <IconWrapper>🛡️</IconWrapper> },
  { id: WorkflowStepValue.SCRAPING, name: 'Scrapování', icon: <IconWrapper>🔍</IconWrapper> },
  { id: WorkflowStepValue.PARSING, name: 'Parsování', icon: <IconWrapper>📄</IconWrapper> },
  { id: WorkflowStepValue.SAVING, name: 'Ukládání Dat', icon: <IconWrapper>💾</IconWrapper> },
  { id: WorkflowStepValue.DISPLAYING_RESULTS, name: 'Zobrazení Výsledků', icon: <IconWrapper>📊</IconWrapper> },
  { id: WorkflowStepValue.MONITORING, name: 'Monitoring', icon: <IconWrapper>📈</IconWrapper> },
];
