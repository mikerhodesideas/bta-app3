// src/lib/contexts/SettingsContext.tsx
'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import type { Campaign, Settings } from '../types'
import { DEFAULT_SHEET_URL } from '../config'
import { useDataStore } from '@/store/dataStore'; // Import the Zustand store

export type SettingsContextType = {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  setSheetUrl: (url: string) => void
  setCurrency: (currency: string) => void
  setSelectedCampaign: (campaignId: string) => void
  setCampaigns: (campaigns: Campaign[]) => void
}

const defaultSettings: Settings = {
  sheetUrl: DEFAULT_SHEET_URL,
  currency: '$',
  selectedCampaign: undefined,
  campaigns: [],
  activeTab: 'Daily',
  optimizationStrategy: 'profit',
  costMetric: 0
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const fetchData = useDataStore(state => state.fetchData); // Get the fetch action from the store

  // Load settings from localStorage on initial mount
  useEffect(() => {
    const saved = localStorage.getItem('settings')
    let initialUrl = DEFAULT_SHEET_URL;
    if (saved) {
      try {
        const parsedSettings = { ...defaultSettings, ...JSON.parse(saved) };
        setSettings(parsedSettings);
        initialUrl = parsedSettings.sheetUrl || DEFAULT_SHEET_URL;
      } catch {
        setSettings(defaultSettings);
      }
    }
    // Trigger initial data fetch if URL exists
    if (initialUrl) {
      console.log(`[SettingsProvider] Triggering initial fetch with URL: ${initialUrl}`);
      fetchData(initialUrl);
    }
  }, [fetchData]); // Add fetchData to dependency array

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
  }, [settings])

  // Fetch data when sheetUrl changes *after* initial load
  useEffect(() => {
    // Avoid fetching immediately on mount again, wait for actual changes
    if (settings.sheetUrl && settings.sheetUrl !== DEFAULT_SHEET_URL) { // Basic check to avoid refetching default on load
      console.log(`[SettingsProvider] Sheet URL changed, triggering fetch: ${settings.sheetUrl}`);
      fetchData(settings.sheetUrl, true); // Force refresh when URL changes via settings
    }
  }, [settings.sheetUrl, fetchData]); // Depend on sheetUrl and fetchData

  const setSheetUrl = (url: string) => {
    setSettings(prev => ({ ...prev, sheetUrl: url }))
    // Fetching is handled by the useEffect watching settings.sheetUrl
  }

  const setCurrency = (currency: string) => {
    setSettings(prev => ({ ...prev, currency }))
  }

  const setSelectedCampaign = (id: string) => {
    setSettings(prev => ({ ...prev, selectedCampaign: id }))
  }

  const setCampaigns = (campaigns: Settings['campaigns']) => {
    setSettings(prev => ({ ...prev, campaigns }))
  }

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      setSheetUrl,
      setCurrency,
      setSelectedCampaign,
      setCampaigns
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
} 