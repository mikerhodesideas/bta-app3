import OpenAI from 'openai';
import { LLMResponse, GenerateInsightsOptions } from './types/models';
import { createDataInsightsPrompt, DATA_ANALYSIS_SYSTEM_PROMPT, formatResponseAsMarkdown } from './prompts';

// Default OpenAI model
export const OPENAI_MODEL = 'o4-mini-2025-04-16';

export async function generateOpenAIInsights(options: GenerateInsightsOptions): Promise<LLMResponse> {
    const { data } = options;

    // Create standard prompt with context
    const fullPrompt = createDataInsightsPrompt(options);

    // Check for API key
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not found. Please check your .env.local file and ensure NEXT_PUBLIC_OPENAI_API_KEY is set.');
    }

    try {
        // Initialize the OpenAI client
        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true // For client-side usage
        });

        // Format data for the API request
        const dataText = JSON.stringify(data, null, 2);
        const userContent = `${fullPrompt}\n\nData:\n${dataText}`;

        // Log what we're sending (with truncated data)
        console.log('[OpenAIAPI] Sending request with prompt:', fullPrompt);
        console.log('[OpenAIAPI] Data sample:', JSON.stringify(data.slice(0, 1), null, 2));
        console.log('[OpenAIAPI] Analyzing total rows:', data.length);

        // Generate content using the OpenAI SDK
        // Using max_completion_tokens instead of max_tokens for o4 models
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
                { role: 'system', content: DATA_ANALYSIS_SYSTEM_PROMPT },
                {
                    role: 'user', content: userContent
                }
            ],
            max_completion_tokens: 4000,
        });

        // Log the response for debugging
        console.log('[OpenAIAPI] Response received');

        // Get the generated text
        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No content returned from OpenAI');
        }

        // Get token usage from the OpenAI response
        const usage = {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0
        };

        // Log token usage
        console.log('[OpenAIAPI] Token usage:', usage);

        // Format the response using shared formatter and return with token information
        return {
            content: formatResponseAsMarkdown(content),
            usage: usage
        };

    } catch (error) {
        console.error('[OpenAIAPI] Error generating insights:', error);
        throw error;
    }
} 