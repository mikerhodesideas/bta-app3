// src/lib/config.ts
import type { MetricOptions } from './types';

export const COLORS = {
    primary: '#3b82f6',   // blue-500
    secondary: '#f97316' // orange
} as const

export const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwZIy8HCnFRb4GrXCg-UG6nFsjl4kL08kuiNg4Rr4vAxHRINuMe03dXzeM_N1ClRCpUCw/exec'

export const SHEET_TABS = ['daily', 'searchTerms', 'adGroups', 'negativeKeywordLists', 'campaignNegatives', 'adGroupNegatives', 'campaignStatus', 'sharedListKeywords'] as const

export type SheetTab = typeof SHEET_TABS[number]

export const MAX_RECOMMENDED_INSIGHT_ROWS = 500;

export interface TabConfig {
    // Define structure for tab configurations if needed
}

export const TAB_CONFIGS: Record<SheetTab, TabConfig> = {
    daily: {
        // Existing config...
    },
    searchTerms: {
        // Existing config...
    },
    adGroups: {
        // Existing config...
    },
    negativeKeywordLists: {
        name: 'negativeKeywordLists',
        metrics: {} // No specific metrics needed for display yet
    },
    campaignNegatives: {
        name: 'campaignNegatives',
        metrics: {} // No specific metrics needed for display yet
    },
    adGroupNegatives: {
        name: 'adGroupNegatives',
        metrics: {} // No specific metrics needed for display yet
    },
    campaignStatus: {
        name: 'campaignStatus',
        metrics: {} // No specific metrics needed for display yet
    },
    sharedListKeywords: {
        name: 'sharedListKeywords',
        metrics: {} // No specific metrics needed for display yet
    }
};
