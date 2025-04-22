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
  cpc: number;
  ctr: number;
  convRate: number;
  cpa: number;
  roas: number;
}

// Add new interfaces for Negative Keywords
export interface NegativeKeywordList {
  listName: string;
  listId: string;
  listType: string;
  appliedToCampaignName: string;
  appliedToCampaignId: string;
}

export interface CampaignNegative {
  campaignName: string;
  campaignId: string;
  criterionId: string;
  keywordText: string;
  matchType: string;
}

export interface AdGroupNegative {
  campaignName: string;
  campaignId: string;
  adGroupName: string;
  adGroupId: string;
  criterionId: string;
  keywordText: string;
  matchType: string;
}

// Add new interface for Campaign Status
export interface CampaignStatus {
  campaignId: string;
  campaignName: string;
  status: string; // e.g., ENABLED, PAUSED, REMOVED
  channelType: string; // e.g., SEARCH, DISPLAY, SHOPPING
}

// Add new interface for keywords within Shared Lists
export interface SharedListKeyword {
  listId: string;
  criterionId: string;
  keywordText: string;
  matchType: string;
  type: string; // Should be KEYWORD
}

// Add the new LandingPageMetric interface
export interface LandingPageMetric {
  url: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  value: number;
  ctr: number;
  cvr: number;
  cpa: number;
  roas: number;
}

// Update the TabData type to include the new properties
export type TabData = {
  daily: AdMetric[];
  searchTerms: SearchTermMetric[];
  adGroups: AdGroupMetric[];
  negativeKeywordLists: NegativeKeywordList[];
  campaignNegatives: CampaignNegative[];
  adGroupNegatives: AdGroupNegative[];
  campaignStatus: CampaignStatus[];
  sharedListKeywords: SharedListKeyword[];
  landingPages: LandingPageMetric[];
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

// Add type guards for Negative Keywords
export function isNegativeKeywordList(data: any): data is NegativeKeywordList {
  return 'listName' in data && 'listId' in data && 'appliedToCampaignId' in data;
}

export function isCampaignNegative(data: any): data is CampaignNegative {
  return 'campaignName' in data && 'criterionId' in data && 'keywordText' in data && !('adGroupName' in data);
}

export function isAdGroupNegative(data: any): data is AdGroupNegative {
  return 'adGroupName' in data && 'adGroupId' in data && 'criterionId' in data && 'keywordText' in data;
}

// Add type guard for Campaign Status
export function isCampaignStatus(data: any): data is CampaignStatus {
  return 'campaignId' in data && 'campaignName' in data && 'status' in data;
}

// Add type guard for Shared List Keywords
export function isSharedListKeyword(data: any): data is SharedListKeyword {
  return 'listId' in data && 'criterionId' in data && 'keywordText' in data;
}

// Add a type guard for LandingPageMetric
export function isLandingPageMetric(data: any): data is LandingPageMetric {
  return 'url' in data && 'ctr' in data && 'cvr' in data;
}

// Helper type to get numeric values from metrics
export type MetricValue<T> = T extends number ? T : never 