// src/lib/config.ts
import type { MetricOptions } from './types'

export const COLORS = {
    primary: '#1e40af',
    secondary: '#ea580c'
} as const

export const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxlj8_wOmzv_4X4AHoeqWl-SFbl4vEO8QMehv39P0wv8f6IffZeqvTJ53niQHXjyjlAYw/exec'

export const SHEET_TABS = ['daily', 'searchTerms', 'adGroups'] as const
export type SheetTab = typeof SHEET_TABS[number]

export interface TabConfig {
    name: SheetTab
    metrics: MetricOptions
}

export const TAB_CONFIGS: Record<SheetTab, TabConfig> = {
    daily: {
        name: 'daily',
        metrics: {
            impr: { label: 'Impr', format: (val: number) => val.toLocaleString() },
            clicks: { label: 'Clicks', format: (val: number) => val.toLocaleString() },
            cost: { label: 'Cost', format: (val: number) => `$${val.toFixed(2)}` },
            conv: { label: 'Conv', format: (val: number) => val.toFixed(1) },
            value: { label: 'Value', format: (val: number) => `$${val.toFixed(2)}` }
        }
    },
    searchTerms: {
        name: 'searchTerms',
        metrics: {
            impressions: { label: 'Impr', format: (val: number) => val.toLocaleString() },
            clicks: { label: 'Clicks', format: (val: number) => val.toLocaleString() },
            cost: { label: 'Cost', format: (val: number) => `$${val.toFixed(2)}` },
            conversions: { label: 'Conv', format: (val: number) => val.toFixed(1) },
            conversion_value: { label: 'Value', format: (val: number) => `$${val.toFixed(2)}` },
            cpc: { label: 'CPC', format: (val: number) => `$${val.toFixed(2)}` },
            ctr: { label: 'CTR', format: (val: number) => `${(val * 100).toFixed(1)}%` },
            conv_rate: { label: 'CvR', format: (val: number) => `${(val * 100).toFixed(1)}%` },
            cpa: { label: 'CPA', format: (val: number) => `$${val.toFixed(2)}` },
            roas: { label: 'ROAS', format: (val: number) => `${val.toFixed(2)}x` },
            aov: { label: 'AOV', format: (val: number) => `$${val.toFixed(2)}` }
        }
    },
    adGroups: {
        name: 'adGroups',
        metrics: {
            impr: { label: 'Impr', format: (val: number) => val.toLocaleString() },
            clicks: { label: 'Clicks', format: (val: number) => val.toLocaleString() },
            cost: { label: 'Cost', format: (val: number) => `$${val.toFixed(2)}` },
            conv: { label: 'Conv', format: (val: number) => val.toFixed(1) },
            value: { label: 'Value', format: (val: number) => `$${val.toFixed(2)}` }
        }
    }
} 