// src/lib/types.ts
import { SheetTab } from './config'

export interface Settings {
  sheetUrl: string
  currency: string
  selectedCampaign?: string
  campaigns?: Campaign[]
  activeTab?: SheetTab
  optimizationStrategy: 'profit' | 'revenue'
  costMetric: number
}

export interface Campaign {
  id: string
  name: string
  totalCost: number
}

// Daily campaign metrics
export interface AdMetric {
  campaign: string
  campaignId: string
  clicks: number
  value: number
  conv: number
  cost: number
  impr: number
  date: string
}

// Search term metrics
export interface SearchTermMetric {
  searchTerm: string
  campaign: string
  adGroup: string
  impr: number
  clicks: number
  cost: number
  conv: number
  value: number
  cpc: number
  ctr: number
  convRate: number
  cpa: number
  roas: number
  aov: number
}

// Calculated metrics for daily data
export interface DailyMetrics extends AdMetric {
  CTR: number
  CvR: number
  CPA: number
  ROAS: number
  CPC: number
}

// Regular metrics excluding metadata fields
export type MetricKey = keyof Omit<AdMetric, 'campaign' | 'campaignId' | 'date'>

// Search term metrics excluding metadata
export type SearchTermMetricKey = keyof Omit<SearchTermMetric, 'searchTerm' | 'campaign' | 'adGroup'>

// All possible metrics (regular + calculated)
export type AllMetricKeys = MetricKey | keyof Omit<DailyMetrics, keyof AdMetric> | SearchTermMetricKey

export interface MetricOption {
  label: string
  format: (val: number) => string
}

export interface MetricOptions {
  [key: string]: MetricOption
}

export interface TabConfig {
  metrics: MetricOptions
}

export interface TabConfigs {
  [key: string]: TabConfig
}

// Add the new AdGroupMetric interface
export interface AdGroupMetric {
  campaign: string;
  campaignId: string;
  adGroup: string;
  adGroupId: string;
  impr: number;
  clicks: number;
  value: number;
  conv: number;
  cost: number;
  date: string;
}

// Type guard for search term data
export function isSearchTermMetric(data: any): data is SearchTermMetric {
  return 'searchTerm' in data && 'adGroup' in data
}

// Type guard for daily metrics
export function isAdMetric(data: any): data is AdMetric {
  return 'campaignId' in data && 'impr' in data
}

// Add a type guard for AdGroupMetric
export function isAdGroupMetric(data: any): data is AdGroupMetric {
  return 'adGroup' in data && 'adGroupId' in data;
}

// Combined tab data type
export type TabData = {
  daily: AdMetric[]
  searchTerms: SearchTermMetric[]
  adGroups: AdGroupMetric[]
}

// Helper type to get numeric values from metrics
export type MetricValue<T> = T extends number ? T : never 