# Adding New Data to BTA App: 
# Walkthrough Guide

This guide will walk you through the complete process of adding new data to the BTA App. 
We'll cover creating a Google Ads script, modifying the existing data pipeline, adding the new data type to the application, and building a new page to display the data.

## Table of Contents

1. [Overview of the Existing System](#overview-of-the-existing-system)
2. [Creating a Test Google Ads Script](#creating-a-test-google-ads-script)
3. [Integrating with the Existing Google Ads Script](#integrating-with-the-existing-google-ads-script)
4. [Updating the Google Sheet Structure](#updating-the-google-sheet-structure)
5. [Modifying the App to Fetch New Data](#modifying-the-app-to-fetch-new-data)
6. [Creating a Test Page](#creating-a-test-page)
7. [Designing Your New Feature with LLMs](#designing-your-new-feature-with-llms)
8. [Conclusion](#conclusion)

## Overview of the Existing System

The BTA App is a Next.js application that visualizes Google Ads data. Here's how the system currently works:

1. A Google Ads Script (`starter-app-script.js`) extracts data from your Google Ads account
2. The script writes data to specific tabs in a Google Sheet
3. A Google Apps Script (`deploy-sheet.js`) exposes the Sheet data as a JSON API
4. The Next.js app fetches data from this API and displays it in various visualizations

Currently, the system handles two types of data:
- **Daily campaign data**: Daily performance metrics for each campaign
- **Search terms data**: Performance metrics for search terms

We'll be adding a new data type to this pipeline.

## Creating a Test Google Ads Script

Let's start by creating a simple Google Ads script to verify we can extract the new data type we want. For this guide, we'll add **ad group performance data** as our example.

### Step 1: Access the Google Ads Scripts Interface

1. Log in to your Google Ads account
2. Navigate to Tools & Settings > Bulk Actions > Scripts
3. Click the "+" button to create a new script

### Step 2: Create a Test Script

Copy and paste the following test script:

```javascript
function main() {
  // Define GAQL query for ad group data
  const AD_GROUP_QUERY = `
  SELECT
    campaign.name,
    campaign.id,
    ad_group.name,
    ad_group.id,
    metrics.clicks,
    metrics.conversions_value,
    metrics.conversions,
    metrics.cost_micros,
    metrics.impressions,
    segments.date
  FROM ad_group
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY segments.date DESC, metrics.cost_micros DESC
  LIMIT 100
  `;

  try {
    // Run the query
    const report = AdsApp.report(AD_GROUP_QUERY);
    const rows = report.rows();
    
    // Log some results for verification
    let count = 0;
    while (rows.hasNext() && count < 10) {
      const row = rows.next();
      Logger.log(JSON.stringify({
        campaign: row['campaign.name'],
        campaign_id: row['campaign.id'],
        ad_group: row['ad_group.name'],
        ad_group_id: row['ad_group.id'],
        clicks: row['metrics.clicks'],
        impressions: row['metrics.impressions'],
        cost_micros: row['metrics.cost_micros'],
        date: row['segments.date']
      }));
      count++;
    }
    Logger.log("Found " + count + " ad groups");
  } catch (e) {
    Logger.log("Error: " + e);
  }
}
```

### Step 3: Run and Verify

1. Click "Preview" to run the script
2. Check the logs to verify that data is being retrieved correctly
3. Make note of the data structure and fields returned

### Sample Data Structure

Your logs should show data that looks something like this (it'll probably be 1 line of data per campaign, but I've included the entire structure for clarity with dummy data):

```json
{
  "campaign": "Brand Campaign",
  "campaign_id": "12345678901",
  "ad_group": "Brand Keywords",
  "ad_group_id": "98765432101",
  "clicks": "42",
  "impressions": "1024",
  "cost_micros": "12500000",
  "date": "2023-04-15"
}
```

If your script runs successfully and shows data like this, you're ready to integrate it with the main script!

## Integrating with the Existing Google Ads Script

Now that we've verified our test script works, we'll integrate it with the main script that fetches all the data for the app.

### Step 1: Modify the starter-app-script.js

Copy the existing `scripts/starter-app-script.js` and add our new ad group query and processing function. You can give this code sample to an LLM together with the new script and the existing script to get the LLM to add the new code for you.Here's the prompt I used:

```markdown
I have an existing Google Ads script that currently sends data from my Google Ads account to a Google Sheet on two separate tabs. I want to add a new tab to that using code from a test script that I've just run successfully. Please can you integrate the two scripts together and give me the full final script, please? 

Then add the new code, sample output from new script, and the existing script.
```

You should get something like this:
```javascript
const SHEET_URL = '';                     // add your sheet url here
const SEARCH_TERMS_TAB = 'SearchTerms';
const DAILY_TAB = 'Daily';
const AD_GROUP_TAB = 'AdGroups';          // New tab name

// Existing GAQL queries...

// Add new GAQL query for ad group data
const AD_GROUP_QUERY = `
SELECT
  campaign.name,
  campaign.id,
  ad_group.name,
  ad_group.id,
  metrics.clicks,
  metrics.conversions_value,
  metrics.conversions,
  metrics.cost_micros,
  metrics.impressions,
  segments.date
FROM ad_group
WHERE segments.date DURING LAST_30_DAYS
ORDER BY segments.date DESC, metrics.cost_micros DESC
`;

function main() {
  try {
    // Access the Google Sheet
    let ss;
    if (!SHEET_URL) {
      ss = SpreadsheetApp.create("Google Ads Report");
      let url = ss.getUrl();
      Logger.log("No SHEET_URL found, so this sheet was created: " + url);
    } else {
      ss = SpreadsheetApp.openByUrl(SHEET_URL);
    }

    // Process Search Terms tab
    processTab(
      ss,
      SEARCH_TERMS_TAB,
      ["searchTerm", "campaign", "adGroup", "impr", "clicks", "cost", "conv", "value", "cpc", "ctr", "convRate", "cpa", "roas"],
      SEARCH_TERMS_QUERY,
      calculateSearchTermsMetrics
    );

    // Process Daily tab
    processTab(
      ss,
      DAILY_TAB,
      ["campaign", "campaignId", "impr", "clicks", "value", "conv", "cost", "date"],
      DAILY_QUERY,
      processDailyData
    );

    // Process Ad Groups tab (new)
    processTab(
      ss,
      AD_GROUP_TAB,
      ["campaign", "campaignId", "adGroup", "adGroupId", "impr", "clicks", "value", "conv", "cost", "date"],
      AD_GROUP_QUERY,
      processAdGroupData
    );

  } catch (e) {
    Logger.log("Error in main function: " + e);
  }
}

// Existing processing functions...

// Add new processing function for ad group data
function processAdGroupData(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();

    // Extract data according to the requested columns
    const campaign = String(row['campaign.name'] || '');
    const campaignId = String(row['campaign.id'] || '');
    const adGroup = String(row['ad_group.name'] || '');
    const adGroupId = String(row['ad_group.id'] || '');
    const clicks = Number(row['metrics.clicks'] || 0);
    const value = Number(row['metrics.conversions_value'] || 0);
    const conv = Number(row['metrics.conversions'] || 0);
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const cost = costMicros / 1000000;  // Convert micros to actual currency
    const impr = Number(row['metrics.impressions'] || 0);
    const date = String(row['segments.date'] || '');

    // Create a new row with the data
    const newRow = [campaign, campaignId, adGroup, adGroupId, impr, clicks, value, conv, cost, date];

    // Push new row to the data array
    data.push(newRow);
  }
  return data;
}
```

### Step 2: Update the Google Ads Script

1. Go back to your Google Ads account
2. Navigate to Tools & Settings > Bulk Actions > Scripts
3. Find your production script (or create a new one)
4. Replace the script code with your updated version
5. Save the script

### Step 3: Run the Script

1. Run the script once manually to populate the initial data
2. Verify that the script creates the new AdGroups tab in your Google Sheet
3. Set the script to run on a regular schedule (daily is recommended)

### Expected Result

After running the script, you should see a new tab called 'AdGroups' in your Google Sheet with data structured like this. 
(note your headers may be different - you'll need to be precise. 
If you want particular headers, you can ask the LLM to add them for you. 
Ensure you 'show' the LLM the exact headers you end up with before trying to integrate data into your app.)

| campaign | campaignId | adGroup | adGroupId | impr | clicks | value | conv | cost | date | cpc | ctr | convRate | cpa | roas |
|----------|------------|---------|-----------|------|--------|-------|------|------|------|------|------|----------|------|------|
| Brand Campaign | 12345678901 | Brand Keywords | 98765432101 | 1024 | 42 | 157.5 | 3.5 | 12.50 | 2025-04-15 | 3.75 | 0.034 | 0.034 | 12.50 | 12.6 |
| Brand Campaign | 12345678901 | Brand Keywords | 98765432101 | 2345 | 89 | 357.5 | 9.4 | 34.50 | 2025-04-15 | 2.50 | 0.024 | 0.024 | 12.50 | 12.6 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

Once you've confirmed the data is being correctly collected in the Google Sheet, you're ready to update the app to use this new data!

## Updating the Google Sheet Structure

You don't need to manually update the Google Sheet structure. The script will do this for you.


## Modifying the App to Fetch New Data

Now we need to modify the Next.js app to fetch and use our new ad group data. This involves several steps:
ASK THE LLM TO DO THIS FOR YOU!!My prompt
```markdown
pls jump to the 'Modifying the App to Fetch New Data' section
update my app based on the info there.
start with step 1 'update the types'
```


### Step 1: Update the Types

First, let's add the new type definition for ad group data in `src/lib/types.ts`:

```typescript
// src/lib/types.ts

// Existing imports and interfaces...

// Add the new AdGroupMetric interface
export interface AdGroupMetric {
  campaign: string;
  campaignId: string;
  adGroup: string;
  adGroupId: string;
  impr: number;
  clicks: number;
  value: number;
  conv: number;
  cost: number;
  date: string;
}

// Update the TabData type to include the new adGroups property
export type TabData = {
  daily: AdMetric[];
  searchTerms: SearchTermMetric[];
  adGroups: AdGroupMetric[]; // Add this line
}

// Add a type guard for AdGroupMetric
export function isAdGroupMetric(data: any): data is AdGroupMetric {
  return 'adGroup' in data && 'adGroupId' in data;
}

// Existing code...
```

### Step 2: Update the Configuration

Update the `src/lib/config.ts` file to add the new tab:

```typescript
// src/lib/config.ts
import type { MetricOptions } from './types';

// Existing constants...

// Update the SHEET_TABS array to include adGroups
export const SHEET_TABS = ['daily', 'searchTerms', 'adGroups'] as const;
export type SheetTab = typeof SHEET_TABS[number];

// Existing interfaces...

// Update the TAB_CONFIGS to include configuration for the adGroups tab
export const TAB_CONFIGS: Record<SheetTab, TabConfig> = {
  daily: {
    // Existing config...
  },
  searchTerms: {
    // Existing config...
  },
  adGroups: {
    name: 'adGroups',
    metrics: {
      impr: { label: 'Impr', format: (val: number) => val.toLocaleString() },
      clicks: { label: 'Clicks', format: (val: number) => val.toLocaleString() },
      cost: { label: 'Cost', format: (val: number) => `$${val.toFixed(2)}` },
      conv: { label: 'Conv', format: (val: number) => val.toFixed(1) },
      value: { label: 'Value', format: (val: number) => `$${val.toFixed(2)}` }
    }
  }
};
```

### Step 3: Update the Data Fetching Logic

Now update the fetch function in `src/lib/sheetsData.ts` to handle the new ad group data:

```typescript
// src/lib/sheetsData.ts
import { AdMetric, Campaign, SearchTermMetric, TabData, AdGroupMetric, isSearchTermMetric } from './types';
import { SHEET_TABS, SheetTab, TAB_CONFIGS, DEFAULT_SHEET_URL } from './config';

async function fetchTabData(sheetUrl: string, tab: SheetTab): Promise<AdMetric[] | SearchTermMetric[] | AdGroupMetric[]> {
  try {
    const urlWithTab = `${sheetUrl}?tab=${tab}`;
    const response = await fetch(urlWithTab);

    if (!response.ok) {
      throw new Error(`Failed to fetch data for tab ${tab}`);
    }

    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      console.error(`Response is not an array:`, rawData);
      return [];
    }

    // Parse data based on tab type
    if (tab === 'searchTerms') {
      return rawData.map((row: any) => ({
        // Existing searchTerms mapping...
      }));
    } else if (tab === 'adGroups') {
      // Map the ad groups data
      return rawData.map((row: any) => ({
        campaign: String(row['campaign'] || ''),
        campaignId: String(row['campaignId'] || ''),
        adGroup: String(row['adGroup'] || ''),
        adGroupId: String(row['adGroupId'] || ''),
        clicks: Number(row['clicks'] || 0),
        value: Number(row['value'] || 0),
        conv: Number(row['conv'] || 0),
        cost: Number(row['cost'] || 0),
        impr: Number(row['impr'] || 0),
        date: String(row['date'] || '')
      }));
    }

    // Daily metrics (default)
    return rawData.map((row: any) => ({
      // Existing daily metrics mapping...
    }));
  } catch (error) {
    console.error(`Error fetching ${tab} data:`, error);
    return [];
  }
}

export async function fetchAllTabsData(sheetUrl: string = DEFAULT_SHEET_URL): Promise<TabData> {
  const results = await Promise.all(
    SHEET_TABS.map(async tab => ({
      tab,
      data: await fetchTabData(sheetUrl, tab)
    }))
  );

  return results.reduce((acc, { tab, data }) => {
    if (tab === 'searchTerms') {
      acc[tab] = data as SearchTermMetric[];
    } else if (tab === 'adGroups') {
      acc[tab] = data as AdGroupMetric[];
    } else {
      acc[tab] = data as AdMetric[];
    }
    return acc;
  }, { daily: [], searchTerms: [], adGroups: [] } as TabData);
}

// Existing export functions...
```

### Step 4: Test the Fetching Functionality

To make sure your data fetching is working correctly, you can create a simple test function and log the results:

```typescript
// Add this temporarily to test fetching
async function testFetchAdGroups() {
  try {
    const data = await fetchAllTabsData();
    console.log('Ad Groups data:', data.adGroups.slice(0, 5)); // Log first 5 ad groups
  } catch (error) {
    console.error('Error testing ad groups fetch:', error);
  }
}

// Call this function from a component useEffect or similar
```

With these changes, your app should now be able to fetch the new ad group data from the Google Sheet. Next, let's create a test page to visualize this data!

## Creating a Test Page

Let's create a test page that will allow us to:
1. See a list of all available tabs in the Google Sheet
2. Select a tab and view a sample of its data
3. See a count of total rows for the selected tab

### Step 1: Create a Data Testing Page

Create a new file (if it's not already created) at `src/app/data-test/page.tsx`:

```tsx
// src/app/data-test/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { fetchAllTabsData } from '@/lib/sheetsData'
import { SHEET_TABS, SheetTab } from '@/lib/config'
import { TabData } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'

export default function DataTestPage() {
  const { settings } = useSettings()
  const [tabData, setTabData] = useState<TabData | null>(null)
  const [selectedTab, setSelectedTab] = useState<SheetTab>('daily')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settings.sheetUrl) {
      setIsLoading(false)
      setError('Please configure your Google Sheet URL in settings')
      return
    }

    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await fetchAllTabsData(settings.sheetUrl)
        setTabData(data)
      } catch (err: any) {
        console.error('Error fetching data:', err)
        setError(`Failed to load data: ${err?.message || 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [settings.sheetUrl])

  // Get the data for the selected tab
  const getSelectedTabData = () => {
    if (!tabData) return []
    return tabData[selectedTab] || []
  }

  // Get all data keys (column names) for the selected tab
  const getDataKeys = () => {
    const data = getSelectedTabData()
    if (data.length === 0) return []
    return Object.keys(data[0] || {})
  }

  const selectedTabData = getSelectedTabData()
  const dataKeys = getDataKeys()

  return (
    <div className="container mx-auto px-4 py-12 mt-16">
      <h1 className="text-3xl font-bold mb-8">Data Testing Page</h1>

      {error ? (
        <div className="text-red-500 mb-4">{error}</div>
      ) : isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium mb-2">Select Data Tab</label>
            <Select value={selectedTab} onValueChange={(value) => setSelectedTab(value as SheetTab)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select tab" />
              </SelectTrigger>
              <SelectContent>
                {SHEET_TABS.map((tab) => (
                  <SelectItem key={tab} value={tab}>
                    {tab}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Tab: {selectedTab}</h2>
            <p className="mb-4">Total rows: {selectedTabData.length}</p>

            {selectedTabData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {dataKeys.map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedTabData.slice(0, 10).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {dataKeys.map((key) => (
                          <td key={`${rowIndex}-${key}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {typeof row[key as keyof typeof row] === 'number'
                              ? Number(row[key as keyof typeof row]).toLocaleString()
                              : String(row[key as keyof typeof row])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No data available for this tab</p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
```

### Step 2: Add a Link to the Navigation

If not already done, update the `src/components/Navigation.tsx` file to include a link to the new test page:

```tsx
// src/components/Navigation.tsx
// Add a new link to the navigation menu

// Inside the navigation links array or JSX
<Link
  href="/data-test"
  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
>
  Data Test
</Link>
```

### Step 3: Test the Page

1. Start your development server: `npm run dev`
2. Navigate to http://localhost:3000/data-test
3. Make sure your Google Sheet URL is configured in settings
4. Use the dropdown to select different tabs and view their data

If everything is working correctly, you should see your newly added AdGroups data when you select that tab. You'll be able to see the first 10 rows of data and the total row count.

This test page is a great way to verify that:
1. Your data is being fetched correctly from the Google Sheet
2. The data structure matches what you expect
3. The app's data handling logic is working correctly

Once you've verified that everything is working as expected on the test page, you're ready to build a full feature page to display and analyze your ad group data!




## Designing Your New Feature with LLMs

Now that we've verified the data is being displayed correctly, we'll design and build a new feature page to display the ad group data. Using large language models (LLMs) can significantly accelerate this process.

### Step 1: Define Your Feature Requirements

Before writing any code, have a conversation with an LLM to clarify what you want to build:

1. Open your preferred LLM tool (Claude.ai, ChatGPT, or Cursor's built-in composer)
2. Describe your existing app, the new data you're adding, and what kind of page or feature you want to build
3. Ask for suggestions and collaborate with the LLM to refine your ideas

**Example prompt to start the conversation:**

```
I'm building a Google Ads analytics dashboard with Next.js. 
I've just added ad group data to my app with these fields:
- campaign
- campaignId
- adGroup
- adGroupId
- impr (impressions)
- clicks
- value (conversion value)
- conv (conversions)
- cost
- date
- cpc
- ctr
- convRate
- cpa
- roas

I want to create a new page that helps users understand their ad group performance. 
What visualizations or insights would be most valuable? 
How should I structure this page?
Please do not write any code yet. 
Let's first clarify exactly what you're going to build.
```

### Step 2: Refine Your Feature Design

Through multiple exchanges with the LLM:
1. Ask for mockups or descriptions of UI components
2. Discuss potential filters and sorting options
3. Explore different visualization types (charts, tables, cards)
4. Consider what insights would be most valuable to users

Keep iterating until you have a clear vision for your feature.
Remember you can always refine the UI later (tools like v0 can help), 
getting the functionality right first is usually best.


### Step 3: Generate Implementation Code

Once you have a clear plan:

1. Open Cursor or your code editor in the app project (so it sees all your code)
2. Create a new prompt (Composer, using 'Agent' mode)that includes:
   - Description of your app's architecture
   - The specific feature you want to implement
   - Any existing components or patterns to follow
   - The data structure you're working with

3. Ask the LLM to generate the code for your new feature page

**Example code generation prompt:**

```
I need to create a new page for ad group analytics in my Next.js app. Here's what I want to build:

[Include your detailed feature plan here]

The page should:
- Fetch ad group data from my context using the useSettings() and fetchAllTabsData() hooks
- Include filtering (eg by date range and campaign)
- Show a summary of key metrics
- Display a performance chart with trends over time
- Include a sortable table of ad groups with their metrics

Please generate the code for this page following my app's existing patterns and components.
```

### Step 4: Implement Your Feature

With the generated code as a starting point:

1. Create a new file in your pages directory (e.g., `src/app/ad-groups/page.tsx`)
2. Paste and adapt the generated code
3. Make any necessary adjustments
4. Add the new page to your navigation

### Step 5: Test and Refine

1. Run your app using `npm run dev`
2. Test the new feature with different data scenarios
3. Use the LLM to help debug any issues
4. Refine the UI and functionality based on testing

## Conclusion

You've now learned how to leverage LLMs to design and implement new features in your app. This collaborative approach allows you to:

1. Rapidly explore design possibilities
2. Generate high-quality starter code
3. Implement complex features more efficiently
4. Add sophisticated analytical capabilities

You can use this same process to add other data types from the Google Ads API, such as:

- Ad performance data
- Audience insights
- Geographic performance 
- Device performance
- And more!

By following the patterns established in this guide, you can continue to expand the app's capabilities to provide more insights into your Google Ads performance.