export interface AdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  cpm: number;
  cpc: number;
  ctr: number;
  frequency: number;
  reach: number;
  actions: Array<{
    action_type: string;
    value: string;
  }>;
  action_values: Array<{
    action_type: string;
    value: string;
  }>;
  cost_per_action_type: Array<{
    action_type: string;
    value: string;
  }>;
}

export interface AdCreative {
  thumbnail_url?: string;
  image_url?: string;
  object_story_spec?: any;
  body?: string;
  title?: string;
}

export interface AdData {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  creative?: AdCreative;
  insights?: {
    data: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      cpm: string;
      cpc: string;
      ctr: string;
      frequency: string;
      reach: string;
      actions: Array<{
        action_type: string;
        value: string;
      }>;
      action_values: Array<{
        action_type: string;
        value: string;
      }>;
      cost_per_action_type: Array<{
        action_type: string;
        value: string;
      }>;
      date_start: string;
      date_stop: string;
    }>;
  };
  metrics: AdMetrics;
  performance_score: number;
  status_color: string;
}

export interface CampaignData {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  insights?: {
    data: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      cpm: string;
      cpc: string;
      ctr: string;
      frequency: string;
      reach: string;
      actions: Array<{
        action_type: string;
        value: string;
      }>;
    }>;
  };
}

export interface AdsetData {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  targeting?: any;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  insights?: {
    data: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      cpm: string;
      cpc: string;
      ctr: string;
      frequency: string;
      reach: string;
      actions: Array<{
        action_type: string;
        value: string;
      }>;
    }>;
  };
}

export interface AccountInfo {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent: string;
  balance: string;
}

export interface SpendData {
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  date: string;
  results: number;
  costOfResults: number;
  roas: number;
  conversionValue: number;
  conversions: {
    linkClicks: number;
    landingPageViews: number;
    contentViews: number;
    postSaves: number;
    leads: number;
    videoViews: number;
    postEngagements: number;
    pageEngagements: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    dateRange?: string;
    fetchedAt?: string;
  };
  error?: string;
  message?: string;
}
