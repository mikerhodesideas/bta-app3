import React from 'react';
import { LLMProvider, DEFAULT_PROVIDER } from '@/lib/types/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BrainCircuit, KeyRound, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the shape of the API key status object
export interface ApiKeyStatuses {
    gemini: string | null; // Expects first 15 chars or null
    openai: string | null; // Expects first 15 chars or null
    anthropic: string | null; // Expects first 15 chars or null
}

interface ModelSelectorProps {
    selectedProvider: LLMProvider;
    onProviderChange: (provider: LLMProvider) => void;
    apiKeyStatuses: ApiKeyStatuses; // Added prop
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedProvider = DEFAULT_PROVIDER,
    onProviderChange,
    apiKeyStatuses = { gemini: null, openai: null, anthropic: null } // Provide default value
}) => {
    const hasAnyKey = apiKeyStatuses.gemini || apiKeyStatuses.openai || apiKeyStatuses.anthropic;
    const keyDisplay = (key: string | null) => key ? `Set: ${key}...` : 'Not Set';

    return (
        <div className="space-y-4"> {/* Changed flex to div with spacing */}
            <div className="flex items-center gap-2"> {/* Original model selector part */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <Label htmlFor="model-selector" className="mr-2 text-sm font-medium">AI Model:</Label>
                                <BrainCircuit className="h-4 w-4 text-gray-400" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-sm">Select the AI model provider for generating insights</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Select
                    value={selectedProvider}
                    onValueChange={(value) => onProviderChange(value as LLMProvider)}
                >
                    <SelectTrigger id="model-selector" className="h-8 w-[120px]">
                        <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* New Accordion section for API Key Status */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="api-keys">
                    <AccordionTrigger className="text-sm py-2">
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4" /> API Key Status
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 text-xs space-y-2">
                        <p><span className="font-semibold">Gemini:</span> {keyDisplay(apiKeyStatuses.gemini)}</p>
                        <p><span className="font-semibold">OpenAI:</span> {keyDisplay(apiKeyStatuses.openai)}</p>
                        <p><span className="font-semibold">Anthropic:</span> {keyDisplay(apiKeyStatuses.anthropic)}</p>

                        {!hasAnyKey && (
                            <Alert className="mt-4">
                                <Info className="h-4 w-4" />
                                <AlertTitle className="font-semibold">Action Required</AlertTitle>
                                <AlertDescription className="text-xs">
                                    No API keys found. To enable AI features, add your API keys to the <code className="font-mono bg-gray-200 px-1 rounded">.env.local</code> file in the project root:
                                    <pre className="mt-1 p-1 bg-gray-100 rounded text-xs overflow-x-auto">
                                        {`GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key`}
                                    </pre>
                                    Remember to restart the application after adding the keys.
                                </AlertDescription>
                            </Alert>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}; 