import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY environment variable is not set.');
}

// Initializing the unified Google Gen AI client
export const ai = new GoogleGenAI({ apiKey });

// Centralized model routing per agent as specified
export const AGENT_MODELS = {
  research: 'gemini-3.5-flash',
  writer: 'gemini-3.5-flash',
  'fact-checker': 'gemini-3.1-pro-preview',
  'style-polisher': 'gemini-3.5-flash',
  'rubric-grader': 'gemini-3.1-pro-preview',
  'seo-agent': 'gemini-3.5-flash',
  'seo-optimizer-agent': 'gemini-3.5-flash',
} as const;

export type AgentModelName = typeof AGENT_MODELS[keyof typeof AGENT_MODELS];
