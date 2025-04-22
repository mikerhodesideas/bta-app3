import { GenerateInsightsOptions } from './types/models';

/**
 * Creates a standard prompt for data insights generation
 * Used by both Gemini and OpenAI implementations
 */
export function createDataInsightsPrompt(options: GenerateInsightsOptions): string {
    const { sourceInfo, prompt } = options;

    return `Dataset: ${sourceInfo.name}
Filters Applied: ${sourceInfo.filters}
Total Rows Matching Filters: ${sourceInfo.totalRows}
Rows Being Analyzed: ${sourceInfo.rowsAnalyzed}
Outlier Handling: ${sourceInfo.outlierInfo}

User Prompt: ${prompt}`;
}

/**
 * Standard system prompt for data analysis
 */
export const DATA_ANALYSIS_SYSTEM_PROMPT = 'You are a data analysis assistant that provides insightful analysis of marketing data. Format your response using markdown.';

/**
 * Format the LLM response as proper markdown with better spacing
 * Used by both Gemini and OpenAI implementations
 */
export function formatResponseAsMarkdown(text: string): string {
    // Replace common section patterns with properly formatted markdown headings
    let formattedText = text
        // Format headings (add ## and extra line breaks)
        .replace(/([A-Za-z\s]+Summary:)/g, '\n\n## $1\n')
        .replace(/(Key Performance Trends and Observations:)/g, '\n\n## $1\n')
        .replace(/(Anomalies & Potential Issues:)/g, '\n\n## $1\n')
        .replace(/(Actionable Recommendations:)/g, '\n\n## $1\n')
        .replace(/(Brand vs\. Non-Brand:)/g, '\n\n### $1\n')
        .replace(/(Location-Based Searches|Top Brands Campaign Performance|Categories and Features Campaigns|High Spend, Low Conversion Keywords|High CPA, Low ROAS|High CTR, Zero Conversion|Zero-Click Keywords|Discrepancies in)([^:]*:)/g, '\n\n### $1$2\n')
        // Add extra spacing after bullet points for better readability
        .replace(/(\n[•\-*] .+)(\n[•\-*] )/g, '$1\n$2')
        // Ensure proper line breaks between paragraphs
        .replace(/\.(\n)([A-Z])/g, '.\n\n$2');

    // Add extra paragraph break if the response doesn't start with a heading
    if (!formattedText.startsWith('#')) {
        formattedText = formattedText.replace(/^(.+?)(\n)/, '$1\n\n');
    }

    // Ensure "Outlier:" sections are properly formatted with bold text
    formattedText = formattedText.replace(/"([^"]+)" Outlier:/g, '**"$1" Outlier:**');

    // Properly format any lists that might be in the response
    formattedText = formattedText.replace(/(\d+\.) (.+)(\n)(?!\d+\.)/g, '$1 $2\n\n');

    return formattedText;
} 