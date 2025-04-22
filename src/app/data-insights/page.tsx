'use client'

import { DataInsights } from '@/components/data-insights/DataInsights';

export default function DataInsightsPage() {
    return (
        <div className="container mx-auto pt-12 pb-8">
            <DataInsights showVisualization={false} />
        </div>
    );
} 