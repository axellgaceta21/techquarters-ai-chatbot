export type LeadSignals = {
  has_business: boolean;
  has_traffic_or_spend: boolean;
  problem_clarity: number;
  urgency: number;
  wants_to_book: boolean;
};

export type LeadProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  industry?: string | null;
  website?: string | null;
  team_size?: string | null;
  revenue_range?: string | null;
  crm?: string | null;
  traffic_source?: string | null;
  current_tools?: string | null;
  biggest_problem?: string | null;
  urgency_reason?: string | null;
  budget?: string | null;
  timeline?: string | null;
  desired_outcome?: string | null;
};

export type ConversationSummary = {
  ai_summary?: string;
  pain_points?: string;
  recommended_next_action?: string;
  buying_intent?: string;
};

export type AIAction = {
  type: "booking_cta";
  label: string;
  url: string;
  helperText?: string;
};

export interface AIResponse {
  reply: string;
  stage: string;
  booking_offered?: boolean;
  signals: LeadSignals;
  profile?: LeadProfile;
  summary?: ConversationSummary;
  actions?: AIAction[];
}
