export type AgentName =
  | 'research'
  | 'writer'
  | 'fact-checker'
  | 'style-polisher'
  | 'rubric-grader'
  | 'seo_agent'
  | 'seo_optimizer_agent'
  | `writer_agent_attempt_${number}`
  | `writer_agent_revision_${number}`
  | `fact_checker_attempt_${number}`;

export interface AgentLog {
  id?: string;
  run_id: string;
  agent_name: AgentName;
  input: unknown;
  output: unknown;
  latency_ms: number;
  token_count?: number;
  timestamp?: string;
}

export interface ResearchResult {
  summary: string;
  sources: ResearchSource[];
}

// -------------------------------------------------------------
// Agent Specific Input/Output Types
// -------------------------------------------------------------

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchInput {
  prd: string;
}

export interface ResearchOutput {
  summary: string;
  sources: ResearchSource[];
}

export interface Section {
  heading: string;
  content: string;
}

export interface WriterDraft {
  title: string;
  introduction: string;
  sections: Section[];
  conclusion: string;
}

export interface WriterInput {
  prd: string;
  researchSummary: string;
  researchSources: ResearchSource[];
  feedback?: string;
}

export type WriterOutput = WriterDraft;

export interface FactCheckerInput {
  prd: string;
  researchSummary: string;
  researchSources: ResearchSource[];
  draft: WriterDraft;
}

export interface FactCheckerOutput {
  passed: boolean;
  unsupported_claims: string[];
  feedback: string;
}

export interface StylePolisherInput {
  draft: WriterDraft;
}

export interface StylePolisherOutput {
  polishedDraft: WriterDraft;
}

export interface RubricGraderInput {
  prd: string;
  article: WriterDraft;
  factCheckResult: FactCheckerOutput;
}

export interface RubricGraderOutput {
  clarity: number;      // 1-5 score
  accuracy: number;     // 1-5 score
  completeness: number; // 1-5 score
  overall_score: number; // 1-5 score
  feedback: string;
}

export interface TrendData {
  keyword: string;
  relatedQueries: string[];
  risingQueries: string[];
  trendSummary: string;
}

export interface KeywordSuggestion {
  ranking: number;
  keyword: string;
  searchGrowth: string;
  relevanceScore: number;
  opportunityExplanation: string;
}

export interface SeoRecommendations {
  primaryKeyword: string;
  secondaryKeywords: string[];
  contentIdeas: string[];
  recommendedTitles: string[];
  seoStrategy: string;
  keywordSuggestions: KeywordSuggestion[];
}

export interface SeoOptimizationReport {
  title_analysis: string;
  seo_score: string;
  search_intent_match: string;
  missing_keywords: string[];
  content_gaps: string[];
  recommended_headings: string[];
  readability_feedback: string;
  improvement_suggestions: string[];
  optimized_title_options: string[];
  strengths: string[];
  weaknesses: string[];
  seo_issues: string[];
  missing_information: string[];
}

export interface OriginalityReport {
  missing_angles: string[];
  unique_perspectives: string[];
  local_context_opportunities: string[];
  potential_interviews: string[];
  follow_up_topics: string[];
  exclusive_content_opportunities: string[];
}

