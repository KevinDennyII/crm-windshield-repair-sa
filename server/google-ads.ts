import { GoogleAdsApi } from "google-ads-api";

let googleAdsClient: GoogleAdsApi | null = null;
let googleAdsCustomer: any = null;

export function isGoogleAdsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

function getClient(): GoogleAdsApi {
  if (!googleAdsClient) {
    googleAdsClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    });
  }
  return googleAdsClient;
}

function getCustomer() {
  if (!googleAdsCustomer) {
    const client = getClient();
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    googleAdsCustomer = client.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, ""),
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      ...(loginCustomerId ? { login_customer_id: loginCustomerId.replace(/-/g, "") } : {}),
    });
  }
  return googleAdsCustomer;
}

export function resetGoogleAdsClient() {
  googleAdsClient = null;
  googleAdsCustomer = null;
}

export interface CampaignMetrics {
  id: string;
  name: string;
  status: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  conversionRate: number;
}

export interface KeywordMetrics {
  keyword: string;
  matchType: string;
  campaignName: string;
  adGroupName: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  qualityScore: number | null;
}

export interface AccountOverview {
  totalClicks: number;
  totalImpressions: number;
  totalCost: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  costPerConversion: number;
}

export interface DailyMetrics {
  date: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
}

function getDateRange(range: string): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().split("T")[0];
  let from: string;

  switch (range) {
    case "LAST_7_DAYS":
      from = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      break;
    case "LAST_14_DAYS":
      from = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
      break;
    case "THIS_MONTH": {
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      break;
    }
    case "LAST_MONTH": {
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      from = firstOfLastMonth.toISOString().split("T")[0];
      return { from, to: lastOfLastMonth.toISOString().split("T")[0] };
    }
    case "LAST_30_DAYS":
    default:
      from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      break;
  }

  return { from, to };
}

export async function getCampaignPerformance(dateRange: string = "LAST_30_DAYS"): Promise<CampaignMetrics[]> {
  const customer = getCustomer();
  const { from, to } = getDateRange(dateRange);

  const campaigns = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${from}' AND '${to}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `);

  return campaigns.map((row: any) => ({
    id: String(row.campaign.id),
    name: row.campaign.name,
    status: row.campaign.status === 2 ? "ENABLED" : row.campaign.status === 3 ? "PAUSED" : String(row.campaign.status),
    clicks: Number(row.metrics.clicks || 0),
    impressions: Number(row.metrics.impressions || 0),
    cost: Number(row.metrics.cost_micros || 0) / 1_000_000,
    conversions: Number(row.metrics.conversions || 0),
    ctr: Number(row.metrics.ctr || 0),
    avgCpc: Number(row.metrics.average_cpc || 0) / 1_000_000,
    conversionRate: Number(row.metrics.impressions) > 0
      ? (Number(row.metrics.conversions || 0) / Number(row.metrics.clicks || 1)) * 100
      : 0,
  }));
}

export async function getKeywordPerformance(dateRange: string = "LAST_30_DAYS"): Promise<KeywordMetrics[]> {
  const customer = getCustomer();
  const { from, to } = getDateRange(dateRange);

  const keywords = await customer.query(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      campaign.name,
      ad_group.name,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE segments.date BETWEEN '${from}' AND '${to}'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `);

  return keywords.map((row: any) => {
    const matchTypeMap: Record<number, string> = { 2: "EXACT", 3: "PHRASE", 4: "BROAD" };
    return {
      keyword: row.ad_group_criterion?.keyword?.text || "Unknown",
      matchType: matchTypeMap[row.ad_group_criterion?.keyword?.match_type] || String(row.ad_group_criterion?.keyword?.match_type || "UNKNOWN"),
      campaignName: row.campaign?.name || "Unknown",
      adGroupName: row.ad_group?.name || "Unknown",
      clicks: Number(row.metrics.clicks || 0),
      impressions: Number(row.metrics.impressions || 0),
      cost: Number(row.metrics.cost_micros || 0) / 1_000_000,
      conversions: Number(row.metrics.conversions || 0),
      ctr: Number(row.metrics.ctr || 0),
      avgCpc: Number(row.metrics.average_cpc || 0) / 1_000_000,
      qualityScore: row.ad_group_criterion?.quality_info?.quality_score ?? null,
    };
  });
}

export async function getAccountOverview(dateRange: string = "LAST_30_DAYS"): Promise<AccountOverview> {
  const customer = getCustomer();
  const { from, to } = getDateRange(dateRange);

  const results = await customer.query(`
    SELECT
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM customer
    WHERE segments.date BETWEEN '${from}' AND '${to}'
  `);

  let totalClicks = 0, totalImpressions = 0, totalCostMicros = 0, totalConversions = 0;

  for (const row of results as any[]) {
    totalClicks += Number(row.metrics.clicks || 0);
    totalImpressions += Number(row.metrics.impressions || 0);
    totalCostMicros += Number(row.metrics.cost_micros || 0);
    totalConversions += Number(row.metrics.conversions || 0);
  }

  const totalCost = totalCostMicros / 1_000_000;

  return {
    totalClicks,
    totalImpressions,
    totalCost,
    totalConversions,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
  };
}

export async function getDailyPerformance(dateRange: string = "LAST_30_DAYS"): Promise<DailyMetrics[]> {
  const customer = getCustomer();
  const { from, to } = getDateRange(dateRange);

  const results = await customer.query(`
    SELECT
      segments.date,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY segments.date ASC
  `);

  return (results as any[]).map((row: any) => ({
    date: row.segments.date,
    clicks: Number(row.metrics.clicks || 0),
    impressions: Number(row.metrics.impressions || 0),
    cost: Number(row.metrics.cost_micros || 0) / 1_000_000,
    conversions: Number(row.metrics.conversions || 0),
  }));
}

export async function getGoogleAdsContextForAI(dateRange: string = "LAST_30_DAYS"): Promise<string> {
  try {
    if (!isGoogleAdsConfigured()) {
      return "\n\nGoogle Ads: Not connected. Credentials not configured.";
    }

    const [overview, campaigns, keywords] = await Promise.all([
      getAccountOverview(dateRange),
      getCampaignPerformance(dateRange),
      getKeywordPerformance(dateRange),
    ]);

    const campaignSummary = campaigns.slice(0, 10).map(
      (c) => `  - ${c.name} [${c.status}]: ${c.clicks} clicks, ${c.impressions} impressions, $${c.cost.toFixed(2)} cost, ${c.conversions.toFixed(1)} conversions, ${(c.ctr * 100).toFixed(2)}% CTR`
    ).join("\n");

    const topKeywords = keywords.slice(0, 15).map(
      (k) => `  - "${k.keyword}" [${k.matchType}]: ${k.clicks} clicks, $${k.cost.toFixed(2)} cost, ${k.conversions.toFixed(1)} conversions${k.qualityScore ? `, QS: ${k.qualityScore}` : ""}`
    ).join("\n");

    return `

LIVE GOOGLE ADS DATA (${dateRange}):
Account Overview:
  - Total Clicks: ${overview.totalClicks}
  - Total Impressions: ${overview.totalImpressions.toLocaleString()}
  - Total Cost: $${overview.totalCost.toFixed(2)}
  - Total Conversions: ${overview.totalConversions.toFixed(1)}
  - Avg CTR: ${overview.avgCtr.toFixed(2)}%
  - Avg CPC: $${overview.avgCpc.toFixed(2)}
  - Cost per Conversion: $${overview.costPerConversion.toFixed(2)}

Campaigns (Top 10 by Spend):
${campaignSummary || "  No active campaigns found."}

Top Keywords (by Spend):
${topKeywords || "  No keyword data found."}`;
  } catch (error) {
    console.error("[GoogleAds] Error fetching AI context:", error);
    return "\n\nGoogle Ads: Error fetching data. Check API credentials.";
  }
}
