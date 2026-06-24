import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import type { AgentName } from '../src/lib/types';

// Load environment variables synchronously at the very beginning
loadEnvConfig(process.cwd());

// Mock global WebSocket for Supabase realtime in Node.js environment
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

import crypto from 'crypto';

async function main() {
  console.log('Testing Gemini and Supabase Telemetry Integration...');

  // Dynamically import lib files to guarantee env variables and global WebSocket are ready first
  const { ai } = await import('../src/lib/gemini');
  const { logger } = await import('../src/lib/logger');

  const prompt = 'Say: Hello from Gemini';
  const model = 'gemini-2.5-flash';
  const runId = crypto.randomUUID();

  console.log(`Calling model '${model}'...`);
  const startTime = Date.now();
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    const latency = Date.now() - startTime;
    const responseText = response.text || '';
    
    console.log(`Received response (Latency: ${latency}ms):`);
    console.log(`"${responseText}"`);

    // Extract token count if available from the SDK response
    const tokenCount = response.usageMetadata?.candidatesTokenCount || undefined;
    console.log(`Tokens used: ${tokenCount ?? 'N/A'}`);

    console.log('Inserting log transaction into Supabase...');
    const result = await logger.logAgentTransaction({
      run_id: runId,
      agent_name: 'test_agent' as AgentName,
      input: { prompt },
      output: { text: responseText.trim() },
      latency_ms: latency,
      token_count: tokenCount,
    });

    if (result) {
      console.log('Success! Telemetry row inserted successfully.');
      console.log('Inserted Row:', JSON.stringify(result, null, 2));
    } else {
      console.error('Failed to insert telemetry row.');
    }
  } catch (error) {
    console.error('Error during test execution:', error);
  }
}

main().catch((err) => {
  console.error('Unhandled error in script:', err);
});
