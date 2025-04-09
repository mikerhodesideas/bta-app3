import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL } from '@/lib/config';

// IMPORTANT: Ensure your Gemini API Key is set as an environment variable
const API_KEY = process.env.GEMINI_API_KEY;
const MAX_OUTPUT_TOKENS = 2048; // Increased token limit for potentially larger data/insights

export async function POST(request: NextRequest) {
    if (!API_KEY) {
        console.error("Gemini API Key not found in environment variables.");
        return NextResponse.json({ error: 'Server configuration error: Missing API Key.' }, { status: 500 });
    }

    try {
        const { prompt, data: requestData } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
        }

        // Construct the final prompt, potentially including the data
        let finalPrompt = prompt;
        if (requestData) {
            // Convert data to a string format suitable for the LLM
            // Limit the data size to avoid exceeding token limits
            const dataString = JSON.stringify(requestData, null, 2); // Pretty print JSON
            const maxDataLength = 10000; // Limit data string length (adjust as needed)
            const truncatedDataString = dataString.length > maxDataLength
                ? dataString.substring(0, maxDataLength) + "\n... (data truncated)"
                : dataString;

            finalPrompt += "\n\nAnalyze the following data:\n\n```json\n" + truncatedDataString + "\n```";
        }


        const requestBody = {
            contents: [{
                parts: [{
                    text: finalPrompt
                }]
            }],
            generationConfig: {
                // Adjust temperature for creativity vs. factuality (0.0 = deterministic, 1.0 = creative)
                // temperature: 0.5,
                maxOutputTokens: MAX_OUTPUT_TOKENS
            }
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text(); // Read raw text first for debugging

        if (!response.ok) {
            console.error(`Gemini API Error: ${response.status} ${response.statusText}`, responseText);
            // Try to parse error details if available
            let errorDetails = responseText;
            try {
                const errorJson = JSON.parse(responseText);
                errorDetails = errorJson.error?.message || responseText;
            } catch (parseError) { /* Ignore if not JSON */ }
            return NextResponse.json({ error: `Gemini API Error: ${errorDetails}` }, { status: response.status });
        }

        // Parse the successful response
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch (e) {
            console.error("Error parsing Gemini JSON response:", responseText);
            return NextResponse.json({ error: 'Failed to parse Gemini response.' }, { status: 500 });
        }

        // Safely access the generated text
        const generatedText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error("Unexpected Gemini response format:", responseJson);
            return NextResponse.json({ error: 'Failed to extract text from Gemini response.' }, { status: 500 });
        }

        return NextResponse.json({ insights: generatedText });

    } catch (error: unknown) {
        console.error('Error in Gemini API route:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
    }
} 