// src/lib/types/models.ts

// LLM Provider type
export type LLMProvider = 'gemini' | 'openai' | 'anthropic';

// Token usage information
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

// Cost information for models
export interface ModelCosts {
    inputCost: number;  // Cost per 1M input tokens
    outputCost: number; // Cost per 1M output tokens
}

// Model definition
export interface ModelDefinition {
    id: string;          // Internal model ID
    displayName: string; // User-friendly name
    provider: LLMProvider;
    costs: ModelCosts;
}

// LLM model configuration
export interface LLMConfig {
    provider: LLMProvider;
    model: string;
}

// Response from the API with token usage
export interface LLMResponse {
    content: string;
    usage: TokenUsage;
}

// Common options interface for generating insights
export interface GenerateInsightsOptions {
    data: any[];
    sourceInfo: {
        name: string;
        filters: string;
        totalRows: number;
        rowsAnalyzed: number;
        outlierInfo: string;
    };
    prompt: string;
}

// Available models with pricing information (costs per 1M tokens in USD)
export const AVAILABLE_MODELS: ModelDefinition[] = [
    {
        id: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        provider: 'gemini',
        costs: {
            inputCost: 0.15,
            outputCost: 0.60
        }
    },
    {
        id: 'gemini-2.5-flash-think',
        displayName: 'Gemini 2.5 Flash (think)',
        provider: 'gemini',
        costs: {
            inputCost: 0.15,
            outputCost: 3.50
        }
    },
    {
        id: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        provider: 'gemini',
        costs: {
            inputCost: 1.25,
            outputCost: 10.00
        }
    },
    {
        id: 'o4-mini-2025-04-16',
        displayName: 'o4-mini',
        provider: 'openai',
        costs: {
            inputCost: 1.10,
            outputCost: 4.40
        }
    },
    {
        id: 'gpt-4-1106-preview',
        displayName: 'GPT-4.1',
        provider: 'openai',
        costs: {
            inputCost: 2.00,
            outputCost: 8.00
        }
    },

    {
        id: 'claude-3-7-sonnet-latest',
        displayName: 'Claude 3.7 Sonnet (latest)',
        provider: 'anthropic',
        costs: {
            inputCost: 3.00,
            outputCost: 15.00
        }
    },
    {
        id: 'claude-3-5-haiku-latest',
        displayName: 'Claude 3.5 Haiku (latest)',
        provider: 'anthropic',
        costs: {
            inputCost: 0.80,
            outputCost: 4.00
        }
    }
];

// Default models for each provider
export const DEFAULT_PROVIDER: LLMProvider = 'gemini';
export const DEFAULT_MODELS = {
    gemini: 'gemini-2.0-flash',
    openai: 'o4-mini-2025-04-16',
    anthropic: 'claude-3-5-haiku-latest'
};

// Helper function to get model by ID
export function getModelById(modelId: string): ModelDefinition | undefined {
    return AVAILABLE_MODELS.find(model => model.id === modelId);
}

// Helper function to calculate cost for token usage
export function calculateCost(usage: TokenUsage, modelId: string): number | undefined {
    const model = getModelById(modelId);
    if (!model) return undefined;

    const inputCost = (usage.inputTokens / 1000000) * model.costs.inputCost;
    const outputCost = (usage.outputTokens / 1000000) * model.costs.outputCost;

    return inputCost + outputCost;
} 