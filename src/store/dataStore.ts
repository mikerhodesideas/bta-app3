import { create } from 'zustand';
import { fetchAllTabsData } from '@/lib/sheetsData';
import type { TabData, AdMetric, SearchTermMetric, AdGroupMetric } from '@/lib/types';
import { SheetTab, SHEET_TABS } from '@/lib/config';

interface DataState {
    data: TabData;
    loading: boolean;
    error: string | null;
    lastFetchedUrl: string | null; // Keep track of the URL used for the last fetch
    fetchData: (sheetUrl: string, forceRefresh?: boolean) => Promise<void>;
    getDataForTab: (tab: SheetTab) => AdMetric[] | SearchTermMetric[] | AdGroupMetric[];
}

export const useDataStore = create<DataState>((set, get) => ({
    data: SHEET_TABS.reduce((acc, tab) => {
        acc[tab] = [];
        return acc;
    }, {} as TabData),
    loading: false,
    error: null,
    lastFetchedUrl: null,

    fetchData: async (sheetUrl: string, forceRefresh: boolean = false) => {
        // Only fetch if loading isn't already in progress
        // or if it's a force refresh, or if the URL has changed
        if (get().loading || (!forceRefresh && get().lastFetchedUrl === sheetUrl && Object.values(get().data).some(arr => arr.length > 0))) {
            console.log('[DataStore] Skipping fetch: Already loading, or data exists for this URL and not forcing refresh.');
            return;
        }

        console.log(`[DataStore] Fetching data from ${sheetUrl}. Force refresh: ${forceRefresh}`);
        set({ loading: true, error: null, lastFetchedUrl: sheetUrl });
        try {
            const fetchedData = await fetchAllTabsData(sheetUrl);
            set({ data: fetchedData, loading: false, error: null });
            console.log('[DataStore] Data fetched successfully.');
        } catch (err: any) {
            console.error('[DataStore] Error fetching data:', err);
            set({ error: err.message || 'Failed to fetch data', loading: false });
        }
    },

    getDataForTab: (tab: SheetTab) => {
        return get().data[tab] || [];
    },
}));

// Optional: Trigger initial data load when the app starts
// This depends on how you access the sheetUrl initially (e.g., from settings)
// You might call fetchData from your main App component or a context provider.
// Example (conceptual - adapt to your settings context):
// import { useSettings } from '@/lib/contexts/SettingsContext';
// const { settings } = useSettings();
// if (settings.sheetUrl) {
//   useDataStore.getState().fetchData(settings.sheetUrl);
// } 