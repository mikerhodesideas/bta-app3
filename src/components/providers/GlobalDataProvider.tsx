'use client'

import { useEffect } from 'react';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { useDataStore } from '@/store/dataStore';

export function GlobalDataProvider({ children }: { children: React.ReactNode }) {
    const { settings } = useSettings();
    const fetchData = useDataStore((state) => state.fetchData);

    useEffect(() => {
        if (settings.sheetUrl) {
            console.log('[GlobalDataProvider] sheetUrl available, attempting fetch.');
            fetchData(settings.sheetUrl);
        } else {
            console.log('[GlobalDataProvider] No sheet URL set, skipping fetch trigger.');
        }
    }, [settings.sheetUrl, fetchData]);

    // Render children regardless of loading state, pages will handle their own loading UI
    return <>{children}</>;
} 