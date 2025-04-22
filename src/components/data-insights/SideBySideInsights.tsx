import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Separator } from "@/components/ui/separator";
import { BrainCircuit, Cpu, MessageSquareWarning } from 'lucide-react';
import { TokenUsage, calculateCost, LLMProvider } from '@/lib/types/models';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define a generic structure for provider data
export interface ProviderInsightData {
    provider: LLMProvider;
    insights: string | null;
    isLoading: boolean;
    tokenUsage: TokenUsage | null;
    modelName: string;
    cost?: number; // Optional cost, calculated outside or passed in
    error?: string | null; // Optional error message
}

// Update props for SideBySideInsights
interface SideBySideInsightsProps {
    provider1Data: ProviderInsightData;
    provider2Data: ProviderInsightData;
}

// Helper component to render a single provider's column
const ProviderColumn: React.FC<{ data: ProviderInsightData }> = ({ data }) => {
    const { provider, insights, isLoading, tokenUsage, modelName, cost, error } = data;

    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    const colors = {
        gemini: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600', badge: 'bg-blue-100', accent: 'text-blue-400', prose: 'prose-h2:text-blue-700 prose-h3:text-blue-600 prose-a:text-blue-600 hover:prose-a:text-blue-700' },
        openai: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: 'text-green-600', badge: 'bg-green-100', accent: 'text-green-400', prose: 'prose-h2:text-green-700 prose-h3:text-green-600 prose-a:text-green-600 hover:prose-a:text-green-700' },
        anthropic: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', icon: 'text-purple-600', badge: 'bg-purple-100', accent: 'text-purple-400', prose: 'prose-h2:text-purple-700 prose-h3:text-purple-600 prose-a:text-purple-600 hover:prose-a:text-purple-700' }
    };
    const style = colors[provider] || colors.gemini; // Default to Gemini style if provider unknown

    return (
        <div className={`flex-1 w-full md:w-[48%] p-4 ${style.bg} ${style.border} rounded-lg shadow-sm flex flex-col`}>
            <div className={`flex items-center justify-between border-b ${style.border} pb-2 mb-3 flex-wrap`}>
                <div className="flex items-center mb-1 md:mb-0">
                    <BrainCircuit className={`h-5 w-5 ${style.icon} mr-2`} />
                    <h4 className={`text-lg font-semibold ${style.text}`}>{providerName}</h4>
                    <Badge variant="outline" className={`ml-2 ${style.badge} ${style.text} hover:${style.badge}`}>
                        {modelName || 'N/A'}
                    </Badge>
                </div>
                {tokenUsage && (
                    <div className={`flex items-center text-xs ${style.icon} flex-shrink-0`}>
                        <Cpu className="h-3 w-3 mr-1" />
                        <span>{tokenUsage.inputTokens + tokenUsage.outputTokens} tokens</span>
                        <span className={`ml-1 ${style.accent}`}>({tokenUsage.inputTokens} in / {tokenUsage.outputTokens} out)</span>
                        {cost !== undefined && (
                            <span className={`ml-2 ${style.icon}`}>${cost.toFixed(4)}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="prose prose-sm max-w-none overflow-y-auto flex-grow
                prose-headings:font-semibold prose-headings:text-gray-800
                prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
                prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-5 prose-h3:mb-2
                prose-p:my-2 prose-p:leading-relaxed
                prose-strong:text-gray-800 prose-strong:font-semibold
                prose-ul:my-2 prose-ul:pl-6 prose-li:my-1
                prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                ${style.prose}
            ">
                {isLoading ? (
                    <p className={`${style.text} animate-pulse`}>Generating {providerName} insights...</p>
                ) : error ? (
                    <Alert variant="destructive" className="w-full">
                        <MessageSquareWarning className="h-4 w-4" />
                        <AlertTitle>Error ({providerName})</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : insights ? (
                    <ReactMarkdown className="insights-content">{insights}</ReactMarkdown>
                ) : (
                    <p className="text-gray-500 italic">No {providerName} insights generated yet.</p>
                )}
            </div>
        </div>
    );
};

export const SideBySideInsights: React.FC<SideBySideInsightsProps> = ({
    provider1Data,
    provider2Data
}) => {

    // Check if both providers have finished loading (or errored)
    const bothFinished = (!provider1Data.isLoading || provider1Data.error) && (!provider2Data.isLoading || provider2Data.error);

    return (
        <div className="flex flex-col w-full space-y-4">
            {/* Only show title if insights are loading or available */}
            {(provider1Data.isLoading || provider1Data.insights || provider1Data.error || provider2Data.isLoading || provider2Data.insights || provider2Data.error) && (
                <div className="flex items-center">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Side-by-Side AI Insights Comparison</h3>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 w-full">
                <ProviderColumn data={provider1Data} />
                {/* Separator only needed on larger screens */}
                <Separator orientation="vertical" className="hidden md:block h-auto mx-2 bg-gray-300" />
                <ProviderColumn data={provider2Data} />
            </div>

            {/* Optional: Add a summary or comparison section below if needed when both are finished */}
            {/* {bothFinished && ( ... )} */}
        </div>
    );
}; 