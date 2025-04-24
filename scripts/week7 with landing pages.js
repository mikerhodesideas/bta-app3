const SHEET_URL = '';
const TABS = {
  SEARCH_TERMS: 'SearchTerms',
  DAILY: 'Daily',
  AD_GROUP: 'AdGroups',
  NEGATIVE_KEYWORD_LISTS: 'NegativeKeywordLists',
  CAMPAIGN_NEGATIVES: 'CampaignNegatives',
  ADGROUP_NEGATIVES: 'AdGroupNegatives',
  CAMPAIGN_STATUS: 'CampaignStatus',
  SHARED_LIST_KEYWORDS: 'SharedListKeywords',
  LANDING_PAGES: 'LandingPages'
};

// GAQL queries for various reports
const QUERIES = {
  // Search terms query
  SEARCH_TERMS: `
    SELECT 
      search_term_view.search_term, 
      campaign.name,
      ad_group.name,
      metrics.impressions, 
      metrics.clicks, 
      metrics.cost_micros, 
      metrics.conversions, 
      metrics.conversions_value
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.advertising_channel_type = "SEARCH"
      AND metrics.impressions >= 30
    ORDER BY metrics.cost_micros DESC
  `,
  
  // Daily campaign data query
  DAILY: `
    SELECT
      campaign.name,
      campaign.id,
      metrics.clicks,
      metrics.conversions_value,
      metrics.conversions,
      metrics.cost_micros,
      metrics.impressions,
      segments.date
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY segments.date DESC, metrics.cost_micros DESC
  `,
  
  // Ad group data query
  AD_GROUP: `
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
  `,
  
  // Negative keyword lists query
  NEGATIVE_KEYWORD_LISTS: `
    SELECT
      shared_set.name,
      shared_set.id,
      shared_set.type,
      campaign.name,
      campaign.id,
      campaign_shared_set.status
    FROM campaign_shared_set
    WHERE shared_set.type = NEGATIVE_KEYWORDS
      AND campaign_shared_set.status = "ENABLED"
    ORDER BY shared_set.name
  `,
  
  // Campaign-level negative keywords query
  CAMPAIGN_NEGATIVES: `
    SELECT
      campaign.name,
      campaign.id,
      campaign_criterion.criterion_id,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.negative
    FROM campaign_criterion
    WHERE campaign_criterion.type = KEYWORD
      AND campaign_criterion.negative = TRUE
    ORDER BY campaign.name, campaign_criterion.keyword.text
  `,
  
  // Ad group-level negative keywords query
  ADGROUP_NEGATIVES: `
    SELECT
      campaign.name,
      campaign.id,
      ad_group.name,
      ad_group.id,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.negative
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = KEYWORD
      AND ad_group_criterion.negative = TRUE
    ORDER BY campaign.name, ad_group.name, ad_group_criterion.keyword.text
  `,
  
  // Campaign status query
  CAMPAIGN_STATUS: `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC
  `,
  
  // Shared list keywords query
  SHARED_LIST_KEYWORDS: `
    SELECT
      shared_set.id,
      shared_criterion.criterion_id,
      shared_criterion.keyword.text,
      shared_criterion.keyword.match_type,
      shared_criterion.type
    FROM shared_criterion
    WHERE shared_set.type = NEGATIVE_KEYWORDS
      AND shared_criterion.type = KEYWORD
    ORDER BY shared_set.id, shared_criterion.keyword.text
  `,
  
  // Landing pages query
  LANDING_PAGES: `
    SELECT 
      landing_page_view.unexpanded_final_url,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM landing_page_view
    WHERE segments.date DURING LAST_30_DAYS
      AND metrics.impressions > 30
    ORDER BY metrics.impressions DESC
  `
};

// Headers for each report
const HEADERS = {
  SEARCH_TERMS: ["Search Term", "Campaign", "Ad Group", "Impressions", "Clicks", "Cost", "Conversions", "Value", "CPC", "CTR", "Conv Rate", "CPA", "ROAS"],
  DAILY: ["Campaign", "Campaign ID", "Impressions", "Clicks", "Value", "Conversions", "Cost", "Date"],
  AD_GROUP: ["Campaign", "Campaign ID", "Ad Group", "Ad Group ID", "Impressions", "Clicks", "Value", "Conversions", "Cost", "Date", "CPC", "CTR", "Conv Rate", "CPA", "ROAS"],
  NEGATIVE_KEYWORD_LISTS: ["List Name", "List ID", "List Type", "Campaign Name", "Campaign ID"],
  CAMPAIGN_NEGATIVES: ["Campaign Name", "Campaign ID", "Criterion ID", "Keyword Text", "Match Type"],
  ADGROUP_NEGATIVES: ["Campaign Name", "Campaign ID", "Ad Group Name", "Ad Group ID", "Criterion ID", "Keyword Text", "Match Type"],
  CAMPAIGN_STATUS: ["Campaign ID", "Campaign Name", "Status", "Channel Type", "Cost"],
  SHARED_LIST_KEYWORDS: ["List ID", "Criterion ID", "Keyword Text", "Match Type", "Type"],
  LANDING_PAGES: ["URL", "Impressions", "Clicks", "Cost", "Conversions", "Value", "CTR", "CVR", "CPA", "ROAS"]
};

// Process data functions mapped to their respective tabs
const PROCESSORS = {
  SEARCH_TERMS: processSearchTermsData,
  DAILY: processDailyData,
  AD_GROUP: processAdGroupData,
  NEGATIVE_KEYWORD_LISTS: processNegativeKeywordLists,
  CAMPAIGN_NEGATIVES: processCampaignNegatives,
  ADGROUP_NEGATIVES: processAdGroupNegatives,
  CAMPAIGN_STATUS: processCampaignStatus,
  SHARED_LIST_KEYWORDS: processSharedListKeywords,
  LANDING_PAGES: processLandingPagesData
};

function main() {
  try {
    Logger.log('Starting the Google Ads Report script.');
    let start = new Date();
    
    // Access the Google Sheet
    let ss = SHEET_URL ? SpreadsheetApp.openByUrl(SHEET_URL) : SpreadsheetApp.create("Google Ads Report");
    if (!SHEET_URL) {
      Logger.log("No SHEET_URL found, so this sheet was created: " + ss.getUrl());
    }

    // Process each tab
    Object.keys(TABS).forEach(tabKey => {
      processTab(
        ss,
        TABS[tabKey],
        HEADERS[tabKey],
        QUERIES[tabKey],
        PROCESSORS[tabKey]
      );
    });

    let end = new Date();
    let duration = ((end - start) / 1000).toFixed(1);
    Logger.log(`Script finished in ${duration} seconds. Your Sheet is at ${ss.getUrl()}`);

  } catch (e) {
    Logger.log("Error in main function: " + e);
  }
}

function processTab(ss, tabName, headers, query, dataProcessor) {
  try {
    // Get or create the tab
    let sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    sheet.clearContents();

    // Set headers
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

    // Run the query and process data
    const report = AdsApp.report(query);
    const rows = report.rows();
    const data = dataProcessor(rows);

    // Write data to sheet (only if we have data)
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
      Logger.log(`Successfully wrote ${data.length} rows to the ${tabName} sheet.`);
    } else {
      Logger.log(`No data found for ${tabName}.`);
    }
  } catch (e) {
    Logger.log(`Error in processTab function for ${tabName}: ${e}`);
  }
}

// Data processing functions
function processSearchTermsData(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    const searchTerm = String(row['search_term_view.search_term'] || '');
    const campaign = String(row['campaign.name'] || '');
    const adGroup = String(row['ad_group.name'] || '');
    const impressions = Number(row['metrics.impressions'] || 0);
    const clicks = Number(row['metrics.clicks'] || 0);
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const conversions = Number(row['metrics.conversions'] || 0);
    const conversionValue = Number(row['metrics.conversions_value'] || 0);

    // Calculate metrics
    const cost = costMicros / 1000000;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const convRate = clicks > 0 ? conversions / clicks : 0;
    const cpa = conversions > 0 ? cost / conversions : 0;
    const roas = cost > 0 ? conversionValue / cost : 0;

    data.push([searchTerm, campaign, adGroup, impressions, clicks, cost, conversions, conversionValue, cpc, ctr, convRate, cpa, roas]);
  }
  return data;
}

function processDailyData(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    const campaign = String(row['campaign.name'] || '');
    const campaignId = String(row['campaign.id'] || '');
    const impressions = Number(row['metrics.impressions'] || 0);
    const clicks = Number(row['metrics.clicks'] || 0);
    const value = Number(row['metrics.conversions_value'] || 0);
    const conversions = Number(row['metrics.conversions'] || 0);
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const cost = costMicros / 1000000;
    const date = String(row['segments.date'] || '');

    data.push([campaign, campaignId, impressions, clicks, value, conversions, cost, date]);
  }
  return data;
}

function processAdGroupData(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    const campaign = String(row['campaign.name'] || '');
    const campaignId = String(row['campaign.id'] || '');
    const adGroup = String(row['ad_group.name'] || '');
    const adGroupId = String(row['ad_group.id'] || '');
    const impressions = Number(row['metrics.impressions'] || 0);
    const clicks = Number(row['metrics.clicks'] || 0);
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const conversions = Number(row['metrics.conversions'] || 0);
    const conversionValue = Number(row['metrics.conversions_value'] || 0);
    const date = String(row['segments.date'] || '');

    // Calculate metrics
    const cost = costMicros / 1000000;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const convRate = clicks > 0 ? conversions / clicks : 0;
    const cpa = conversions > 0 ? cost / conversions : 0;
    const roas = cost > 0 ? conversionValue / cost : 0;

    data.push([campaign, campaignId, adGroup, adGroupId, impressions, clicks, conversionValue, conversions, cost, date, cpc, ctr, convRate, cpa, roas]);
  }
  return data;
}

function processNegativeKeywordLists(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    data.push([
      String(row['shared_set.name'] || ''),
      String(row['shared_set.id'] || ''),
      String(row['shared_set.type'] || ''),
      String(row['campaign.name'] || ''),
      String(row['campaign.id'] || '')
    ]);
  }
  return data;
}

function processCampaignNegatives(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    data.push([
      String(row['campaign.name'] || ''),
      String(row['campaign.id'] || ''),
      String(row['campaign_criterion.criterion_id'] || ''),
      String(row['campaign_criterion.keyword.text'] || ''),
      String(row['campaign_criterion.keyword.match_type'] || '')
    ]);
  }
  return data;
}

function processAdGroupNegatives(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    data.push([
      String(row['campaign.name'] || ''),
      String(row['campaign.id'] || ''),
      String(row['ad_group.name'] || ''),
      String(row['ad_group.id'] || ''),
      String(row['ad_group_criterion.criterion_id'] || ''),
      String(row['ad_group_criterion.keyword.text'] || ''),
      String(row['ad_group_criterion.keyword.match_type'] || '')
    ]);
  }
  return data;
}

function processCampaignStatus(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const cost = costMicros / 1000000;
    data.push([
      String(row['campaign.id'] || ''),
      String(row['campaign.name'] || ''),
      String(row['campaign.status'] || ''),
      String(row['campaign.advertising_channel_type'] || ''),
      cost
    ]);
  }
  return data;
}

function processSharedListKeywords(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    data.push([
      String(row['shared_set.id'] || ''),
      String(row['shared_criterion.criterion_id'] || ''),
      String(row['shared_criterion.keyword.text'] || ''),
      String(row['shared_criterion.keyword.match_type'] || ''),
      String(row['shared_criterion.type'] || '')
    ]);
  }
  return data;
}

function processLandingPagesData(rows) {
  const data = [];
  while (rows.hasNext()) {
    const row = rows.next();
    
    const url = String(row['landing_page_view.unexpanded_final_url'] || '');
    const impressions = Number(row['metrics.impressions'] || 0);
    const clicks = Number(row['metrics.clicks'] || 0);
    const costMicros = Number(row['metrics.cost_micros'] || 0);
    const conversions = Number(row['metrics.conversions'] || 0);
    const conversionValue = Number(row['metrics.conversions_value'] || 0);
    
    // Calculate derived metrics
    const cost = costMicros / 1000000;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? conversions / clicks : 0;
    const cpa = conversions > 0 ? cost / conversions : 0;
    const roas = cost > 0 ? conversionValue / cost : 0;
    
    data.push([url, impressions, clicks, cost, conversions, conversionValue, ctr, cvr, cpa, roas]);
  }
  
  // Sort by impressions (descending)
  data.sort((a, b) => b[1] - a[1]);
  
  return data;
}