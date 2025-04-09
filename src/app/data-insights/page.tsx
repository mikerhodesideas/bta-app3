'use client'

import { DataInsights } from '@/components/data-insights/DataInsights';

export default function DataInsightsPage() {
    return (
        <div className="container mx-auto px-4 py-12 mt-16">
            <h1 className="text-3xl font-bold mb-8">Data Insights</h1>
            <DataInsights />
        </div>
    );
} 