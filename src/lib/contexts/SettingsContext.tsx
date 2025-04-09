// src/lib/contexts/SettingsContext.tsx
'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import type { Campaign, Settings } from '../types'
import { DEFAULT_SHEET_URL } from '../config'

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

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('settings')
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) })
      } catch {
        setSettings(defaultSettings)
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
  }, [settings])

  const setSheetUrl = (url: string) => {
    setSettings(prev => ({ ...prev, sheetUrl: url }))
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