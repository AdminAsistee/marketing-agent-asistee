import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import fs from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function testDirect() {
  const { ai, AGENT_MODELS } = await import('../src/lib/gemini');
  console.log('AGENT_MODELS:', AGENT_MODELS);
  
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/prd-sample.txt');
  const prd = fs.readFileSync(fixturePath, 'utf-8');
  
  const prompt = `You are a Research Agent. Conduct research and gather live web context related to the following Product Requirement Document (PRD). Focus on analyzing competitors, latest technologies, standard integrations, and technical feasibility. Provide a detailed, comprehensive synthesis of your findings.\n\nPRD:\n${prd}`;

  console.log('Sending request to Gemini model:', AGENT_MODELS.research);
  const response = await ai.models.generateContent({
    model: AGENT_MODELS.research,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  
  console.log('RAW RESPONSE keys:', Object.keys(response));
  console.log('response.text:', response.text);
  console.log('response candidate 0:', JSON.stringify(response.candidates?.[0], null, 2));
}

testDirect().catch(console.error);
