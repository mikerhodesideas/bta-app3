// src/lib/config.ts
import type { MetricOptions } from './types'

export const COLORS = {
    primary: '#3b82f6',   // blue-500
    secondary: '#10b981' // emerald-500
} as const

export const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxlj8_wOmzv_4X4AHoeqWl-SFbl4vEO8QMehv39P0wv8f6IffZeqvTJ53niQHXjyjlAYw/exec'

export const SHEET_TABS = ['Daily', 'AdGroups', 'SearchTerms'] as const
export type SheetTab = typeof SHEET_TABS[number]

export const MAX_RECOMMENDED_INSIGHT_ROWS = 500;

// Gemini Configuration
export const GEMINI_MODEL = 'gemini-2.5-pro-preview-03-25';
// IMPORTANT: Store your Gemini API Key securely.
// It's recommended to use environment variables (e.g., process.env.GEMINI_API_KEY)
// and access it server-side, NOT directly in client-side code.
// Add GEMINI_API_KEY='YOUR_API_KEY_HERE' to your .env.local file

export interface TabConfig {
    // Define structure for tab configurations if needed
}

// If you have specific configurations per tab, you can define them like this:
// export const TABS_CONFIG: Record<SheetTab, TabConfig> = {
//     Daily: { /* config for Daily */ },
//     AdGroups: { /* config for AdGroups */ },
//     SearchTerms: { /* config for SearchTerms */ },
// };