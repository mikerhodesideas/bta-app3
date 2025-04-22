import { GenerateInsightsOptions, generateInsights as generateGeminiInsights } from './gemini-api';
import { generateOpenAIInsights } from './openai-api';
import { generateAnthropicInsights } from './anthropic-api';
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
        case 'anthropic':
            return generateAnthropicInsights(options);
        case 'gemini':
        default:
            return generateGeminiInsights(options);
    }
} 