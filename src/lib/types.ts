export type AgentName =
  | 'research'
  | 'writer'
  | 'fact-checker'
  | 'style-polisher'
  | 'rubric-grader';

export interface AgentLog {
  id?: string;
  run_id: string;
  agent_name: AgentName;
  input: Record<string, any>;
  output: Record<string, any>;
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
  draft: string;
  sources: ResearchSource[];
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
  draft: WriterDraft;
  prd: string;
}

export interface RubricGraderOutput {
  clarity: number;      // 1-5 score
  accuracy: number;     // 1-5 score
  completeness: number; // 1-5 score
}
