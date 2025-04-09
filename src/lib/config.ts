// src/lib/config.ts
import type { MetricOptions } from './types'

export const COLORS = {
    primary: '#3b82f6',   // blue-500
    secondary: '#f97316' // orange
} as const

export const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwZIy8HCnFRb4GrXCg-UG6nFsjl4kL08kuiNg4Rr4vAxHRINuMe03dXzeM_N1ClRCpUCw/exec'

export const SHEET_TABS = ['Daily', 'AdGroups', 'SearchTerms'] as const
export type SheetTab = typeof SHEET_TABS[number]

export const MAX_RECOMMENDED_INSIGHT_ROWS = 50;

// Gemini Configuration
export const GEMINI_MODEL = 'gemini-2.0-flash'; // -2.5-pro-preview-03-25';


export interface TabConfig {
    // Define structure for tab configurations if needed
}

// If you have specific configurations per tab, you can define them like this:
// export const TABS_CONFIG: Record<SheetTab, TabConfig> = {
//     Daily: { /* config for Daily */ },
//     AdGroups: { /* config for AdGroups */ },
//     SearchTerms: { /* config for SearchTerms */ },
// };