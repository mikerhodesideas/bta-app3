import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Separator } from "@/components/ui/separator";
import { BrainCircuit, Cpu } from 'lucide-react';
import { TokenUsage } from '@/lib/types/models';
import { Badge } from "@/components/ui/badge";

interface SideBySideInsightsProps {
    geminiInsights: string | null;
    openaiInsights: string | null;
    isLoadingGemini: boolean;
    isLoadingOpenAI: boolean;
    geminiTokenUsage: TokenUsage | null;
    openaiTokenUsage: TokenUsage | null;
    modelNames: {
        gemini: string;
        openai: string;
    };
}

export const SideBySideInsights: React.FC<SideBySideInsightsProps> = ({
    geminiInsights,
    openaiInsights,
    isLoadingGemini,
    isLoadingOpenAI,
    geminiTokenUsage,
    openaiTokenUsage,
    modelNames
}) => {
    return (
        <div className="flex flex-col w-full space-y-4">
            <div className="flex items-center">
                <h3 className="text-xl font-semibold mb-2 text-green-800">Side-by-Side AI Insights Comparison</h3>
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full">
                {/* Gemini Column */}
                <div className="flex-1 w-full md:w-[48%] p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2 mb-3">
                        <div className="flex items-center">
                            <BrainCircuit className="h-5 w-5 text-blue-600 mr-2" />
                            <h4 className="text-lg font-semibold text-blue-800">Gemini</h4>
                            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100">
                                {modelNames.gemini}
                            </Badge>
                        </div>
                        {geminiTokenUsage && (
                            <div className="flex items-center text-xs text-blue-600">
                                <Cpu className="h-3 w-3 mr-1" />
                                <span>{geminiTokenUsage.inputTokens + geminiTokenUsage.outputTokens} tokens</span>
                                <span className="ml-1 text-blue-400">({geminiTokenUsage.inputTokens} in / {geminiTokenUsage.outputTokens} out)</span>
                            </div>
                        )}
                    </div>

                    <div className="prose prose-sm max-w-none overflow-y-auto
            prose-headings:font-semibold 
            prose-headings:text-gray-800 
            prose-h2:text-xl prose-h2:font-bold prose-h2:text-blue-700 prose-h2:mt-6 prose-h2:mb-3
            prose-h3:text-lg prose-h3:font-semibold prose-h3:text-blue-600 prose-h3:mt-5 prose-h3:mb-2
            prose-p:my-2 prose-p:leading-relaxed
            prose-a:text-blue-600 hover:prose-a:text-blue-700 
            prose-strong:text-gray-800 prose-strong:font-semibold
            prose-ul:my-2 prose-ul:pl-6
            prose-li:my-1
            prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          ">
                        {isLoadingGemini ? (
                            <p className="text-blue-600 animate-pulse">Generating Gemini insights...</p>
                        ) : geminiInsights ? (
                            <ReactMarkdown className="insights-content">{geminiInsights}</ReactMarkdown>
                        ) : (
                            <p className="text-gray-500 italic">No Gemini insights generated yet.</p>
                        )}
                    </div>
                </div>

                {/* OpenAI Column */}
                <div className="flex-1 w-full md:w-[48%] p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between border-b border-green-200 pb-2 mb-3">
                        <div className="flex items-center">
                            <BrainCircuit className="h-5 w-5 text-green-600 mr-2" />
                            <h4 className="text-lg font-semibold text-green-800">OpenAI</h4>
                            <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                                {modelNames.openai}
                            </Badge>
                        </div>
                        {openaiTokenUsage && (
                            <div className="flex items-center text-xs text-green-600">
                                <Cpu className="h-3 w-3 mr-1" />
                                <span>{openaiTokenUsage.inputTokens + openaiTokenUsage.outputTokens} tokens</span>
                                <span className="ml-1 text-green-400">({openaiTokenUsage.inputTokens} in / {openaiTokenUsage.outputTokens} out)</span>
                            </div>
                        )}
                    </div>

                    <div className="prose prose-sm max-w-none overflow-y-auto
            prose-headings:font-semibold 
            prose-headings:text-gray-800 
            prose-h2:text-xl prose-h2:font-bold prose-h2:text-green-700 prose-h2:mt-6 prose-h2:mb-3
            prose-h3:text-lg prose-h3:font-semibold prose-h3:text-green-600 prose-h3:mt-5 prose-h3:mb-2
            prose-p:my-2 prose-p:leading-relaxed
            prose-a:text-green-600 hover:prose-a:text-green-700 
            prose-strong:text-gray-800 prose-strong:font-semibold
            prose-ul:my-2 prose-ul:pl-6
            prose-li:my-1
            prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          ">
                        {isLoadingOpenAI ? (
                            <p className="text-green-600 animate-pulse">Generating OpenAI insights...</p>
                        ) : openaiInsights ? (
                            <ReactMarkdown className="insights-content">{openaiInsights}</ReactMarkdown>
                        ) : (
                            <p className="text-gray-500 italic">No OpenAI insights generated yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}; 