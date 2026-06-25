import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load env variables
loadEnvConfig(process.cwd());

// Mock WebSocket for Node.js
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function runPipelineTest() {
  console.log('--- STARTING FULL PIPELINE TEST ---');
  
  // 1. Load PRD from fixture
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/prd-sample.txt');
  if (!fs.existsSync(fixturePath)) {
    console.error(`Fixture file not found at ${fixturePath}`);
    process.exit(1);
  }
  
  const prd = fs.readFileSync(fixturePath, 'utf-8');
  console.log('PRD loaded successfully from fixture.');

  // Generate a single runId for the entire pipeline run
  const runId = crypto.randomUUID();
  console.log(`Generated Pipeline Run ID: ${runId}\n`);

  try {
    // 2. Import agents
    const { researchAgent } = await import('../src/lib/researcher');
    const { writerAgent } = await import('../src/lib/writer');
    const { supabase } = await import('../src/lib/supabase');

    // 3. Execute Research Agent
    console.log('=== RUNNING RESEARCH AGENT ===');
    const researchResult = await researchAgent(prd, runId);
    console.log('\n[Research Summary]:');
    console.log(researchResult.summary.slice(0, 300) + '...\n');
    console.log('[Extracted and Normalized Sources]:');
    console.log(JSON.stringify(researchResult.sources, null, 2));
    console.log('==============================\n');

    // 4. Execute Writer Agent
    console.log('=== RUNNING WRITER AGENT ===');
    const draftResult = await writerAgent(prd, researchResult, runId);
    console.log('\n[Generated Title]:', draftResult.title);
    console.log('\n[Introduction]:');
    console.log(draftResult.introduction.slice(0, 150) + '...\n');
    console.log('[Sections Count]:', draftResult.sections.length);
    draftResult.sections.forEach((sec, idx) => {
      console.log(`  Section ${idx + 1}: ${sec.heading} (${sec.content.slice(0, 100)}...)`);
    });
    console.log('\n[Conclusion]:');
    console.log(draftResult.conclusion.slice(0, 150) + '...\n');
    console.log('============================\n');

    // 5. Verify Supabase logs
    console.log('=== VERIFYING TELEMETRY LOGS IN SUPABASE ===');
    // Allow a brief moment for database writes to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { data: logs, error } = await supabase
      .from('agent_logs')
      .select('id, agent_name, latency_ms, token_count')
      .eq('run_id', runId);

    if (error) {
      console.error('Failed to query agent_logs:', error.message);
      process.exit(1);
    }

    console.log(`Found ${logs?.length || 0} logs in Supabase for runId: ${runId}`);
    console.log(JSON.stringify(logs, null, 2));

    const hasResearchLog = logs?.some((l) => l.agent_name === 'research');
    const hasWriterLog = logs?.some((l) => l.agent_name === 'writer');

    if (hasResearchLog && hasWriterLog) {
      console.log('\n[SUCCESS] Both Research and Writer transactions successfully recorded in Supabase.');
      console.log('--- PIPELINE TEST PASSED SUCCESSFULLY ---');
    } else {
      console.error('\n[FAILURE] Telemetry logs were not properly recorded.');
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n[PIPELINE EXCEPTION]:', errorMessage);
    process.exit(1);
  }
}

runPipelineTest();
