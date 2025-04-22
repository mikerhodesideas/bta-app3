import { GenerateInsightsOptions, generateInsights } from './gemini-api';
import { generateOpenAIInsights } from './openai-api';
import { LLMProvider, LLMResponse } from './types/models';

/**
 * Routes the insight generation to the correct API provider based on user selection
 */
export async function generateInsightsWithProvider(
    options: GenerateInsightsOptions,
    provider: LLMProvider = 'gemini'
): Promise<LLMResponse> {
    console.log(`[APIRouter] Routing insight generation to ${provider} provider`);

    // Route to the correct API based on provider
    switch (provider) {
        case 'openai':
            return generateOpenAIInsights(options);
        case 'gemini':
        default:
            return generateInsights(options);
    }
} 