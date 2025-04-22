import Anthropic from '@anthropic-ai/sdk';
import { LLMResponse, GenerateInsightsOptions, DEFAULT_MODELS } from './types/models';
import { createDataInsightsPrompt, formatResponseAsMarkdown } from './prompts';

// Initialize Anthropic client with environment API key
const anthropicClient = new Anthropic({
    apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true // Required for browser environments
});

// Generate insights using Anthropic Claude
export async function generateAnthropicInsights(
    options: GenerateInsightsOptions
): Promise<LLMResponse> {
    const fullPrompt = createDataInsightsPrompt(options);
    const dataText = JSON.stringify(options.data, null, 2);
    const userContent = `${fullPrompt}\n\nData:\n${dataText}`;

    console.log('[AnthropicAPI] Sending request with prompt:', fullPrompt);
    try {
        const response = await anthropicClient.messages.create({
            model: DEFAULT_MODELS.anthropic,
            max_tokens: 4000,
            messages: [{ role: 'user', content: userContent }],
        });
        console.log('[AnthropicAPI] Response received');

        // Extract content - assuming the first block is the text content
        const contentBlocks = response.content;
        const textContent = contentBlocks && contentBlocks.length > 0 && contentBlocks[0].type === 'text'
            ? contentBlocks[0].text
            : '';

        // Extract usage stats from the response
        const usage = {
            inputTokens: response.usage.input_tokens || 0,
            outputTokens: response.usage.output_tokens || 0
        };
        console.log('[AnthropicAPI] Token usage:', usage);

        return {
            content: formatResponseAsMarkdown(textContent),
            usage,
        };
    } catch (error) {
        console.error('[AnthropicAPI] Error generating insights:', error);
        throw error;
    }
} 