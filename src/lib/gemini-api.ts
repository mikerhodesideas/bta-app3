import { GoogleGenAI } from '@google/genai';
import { LLMResponse, GenerateInsightsOptions, DEFAULT_MODELS } from './types/models';
import { createDataInsightsPrompt, formatResponseAsMarkdown } from './prompts';

// Use the default Gemini model from models.ts
const GEMINI_MODEL = DEFAULT_MODELS.gemini;

export async function generateInsights(options: GenerateInsightsOptions): Promise<LLMResponse> {
    const { data } = options;

    // Create standard prompt with context using shared template
    const fullPrompt = createDataInsightsPrompt(options);

    // Check for API key
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key not found. Please check your .env.local file and ensure NEXT_PUBLIC_GEMINI_API_KEY is set.');
    }

    try {
        // Initialize the Google GenAI client with the new SDK
        const ai = new GoogleGenAI({ apiKey });

        // Log what we're sending (with truncated data)
        console.log('[GeminiAPI] Sending request with prompt:', fullPrompt);
        console.log('[GeminiAPI] Data sample:', JSON.stringify(data.slice(0, 1), null, 2));
        console.log('[GeminiAPI] Analyzing total rows:', data.length);
        console.log('[GeminiAPI] Using model:', GEMINI_MODEL);

        // Create text content for the request
        const dataText = JSON.stringify(data, null, 2);
        const userContent = `${fullPrompt}\n\nData:\n${dataText}`;

        // Get accurate token count using the proper API method
        let inputTokens = 0;
        try {
            const tokenCountResponse = await ai.models.countTokens({
                model: GEMINI_MODEL,
                contents: [fullPrompt, `\n\nData:\n${dataText}`]
            });
            inputTokens = tokenCountResponse.totalTokens || 0;
            console.log('[GeminiAPI] Accurate token count:', tokenCountResponse.totalTokens);
        } catch (tokenError) {
            console.warn('[GeminiAPI] Could not get token count, using estimate:', tokenError);
            // Fallback to estimate if token counting fails
            inputTokens = Math.ceil(userContent.length / 4);
        }

        // Generate content using the new SDK format
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                fullPrompt,
                `\n\nData:\n${dataText}`
            ],
            config: {
                temperature: 0.7,
                maxOutputTokens: 4000, // Increase token limit
            }
        });

        // Log the response for debugging
        console.log('[GeminiAPI] Response received, type:', typeof response);

        // Get the text from the response
        const text = response.text ? response.text : '';

        // Get token count for the output
        let outputTokens = 0;
        try {
            const outputTokenCountResponse = await ai.models.countTokens({
                model: GEMINI_MODEL,
                contents: [text]
            });
            outputTokens = outputTokenCountResponse.totalTokens || 0;
            console.log('[GeminiAPI] Output token count:', outputTokens);
        } catch (tokenError) {
            console.warn('[GeminiAPI] Could not get output token count, using estimate:', tokenError);
            // Fallback to estimate if token counting fails
            outputTokens = Math.ceil(text.length / 4);
        }

        // Log token usage
        console.log('[GeminiAPI] Token usage:', {
            inputTokens,
            outputTokens
        });

        // Format the response text as markdown using shared function
        const formattedText = formatResponseAsMarkdown(text);

        // Return the response with token usage
        return {
            content: formattedText,
            usage: {
                inputTokens,
                outputTokens
            }
        };

    } catch (error) {
        console.error('[GeminiAPI] Error generating insights:', error);
        throw error;
    }
} 