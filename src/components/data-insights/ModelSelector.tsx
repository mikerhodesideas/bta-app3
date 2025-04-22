import React from 'react';
import { LLMProvider, DEFAULT_PROVIDER } from '@/lib/types/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BrainCircuit } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ModelSelectorProps {
    selectedProvider: LLMProvider;
    onProviderChange: (provider: LLMProvider) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedProvider = DEFAULT_PROVIDER,
    onProviderChange
}) => {
    return (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center">
                            <Label htmlFor="model-selector" className="mr-2 text-sm font-medium text-gray-700">AI Model:</Label>
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
    );
}; 