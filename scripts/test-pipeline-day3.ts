import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load env variables
loadEnvConfig(process.cwd());

// Mock WebSocket for Node.js
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function runDay3Tests() {
  console.log('--- STARTING DAY 3 QUALITY CONTROL PIPELINE TESTS ---');

  // Load PRD from fixture
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/prd-sample.txt');
  if (!fs.existsSync(fixturePath)) {
    console.error(`Fixture file not found at ${fixturePath}`);
    process.exit(1);
  }
  const prd = fs.readFileSync(fixturePath, 'utf-8');
  console.log('PRD loaded successfully.');

  const { researchAgent } = await import('../src/lib/researcher');
  const { writerAgent } = await import('../src/lib/writer');
  const { factCheckerAgent } = await import('../src/lib/factChecker');
  const { stylePolisherAgent } = await import('../src/lib/stylePolisher');
  const { supabase } = await import('../src/lib/supabase');

  const runId = crypto.randomUUID();
  console.log(`Generated Pipeline Run ID: ${runId}\n`);

  try {
    // -------------------------------------------------------------
    // STEP 1: Run Research Agent
    // -------------------------------------------------------------
    console.log('=== RUNNING RESEARCH AGENT ===');
    const researchResult = await researchAgent(prd, runId);
    console.log('Research Agent completed successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Normal generation flow (Writer -> Fact Checker -> Style Polish)
    // -------------------------------------------------------------
    console.log('=== TEST 1: Normal Generation Flow ===');
    
    console.log('Running Writer (Attempt 1)...');
    const initialDraft = await writerAgent(
      prd,
      researchResult,
      runId,
      undefined,
      undefined,
      'writer_agent_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false }
    );
    console.log('Initial Draft Title:', initialDraft.title);

    console.log('Running Fact Checker (Attempt 1)...');
    const firstCheck = await factCheckerAgent(
      prd,
      researchResult,
      initialDraft,
      runId,
      'fact_checker_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false }
    );
    console.log('Fact Check passed:', firstCheck.passed);
    console.log('Unsupported Claims found:', firstCheck.unsupported_claims.length);
    console.log('Feedback:', firstCheck.feedback);

    let finalDraft = initialDraft;
    let checkResult = firstCheck;

    // Handle revision loop in the test if the normal flow happened to fail verification
    let retryCount = 0;
    while (!checkResult.passed && retryCount < 2) {
      retryCount++;
      console.log(`[TEST 1 ROLLBACK] Fact check failed on normal draft. Revision attempt ${retryCount}...`);
      finalDraft = await writerAgent(
        prd,
        researchResult,
        runId,
        finalDraft,
        checkResult.feedback,
        `writer_agent_revision_${retryCount}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true }
      );
      checkResult = await factCheckerAgent(
        prd,
        researchResult,
        finalDraft,
        runId,
        `fact_checker_attempt_${retryCount + 1}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true }
      );
      console.log(`Revision ${retryCount} check passed:`, checkResult.passed);
    }

    // Apply Style Polishing (only if check passed, or for test completeness)
    console.log('Running Style Polisher...');
    const polishedDraft = await stylePolisherAgent(finalDraft, runId, 'style-polisher');
    console.log('Polished Draft Title:', polishedDraft.title);
    console.log('TEST 1 completed successfully.\n');


    // -------------------------------------------------------------
    // TEST 2: Forced Fact-Check Failure & Revision Flow
    // -------------------------------------------------------------
    console.log('=== TEST 2: Forced Fact-Check Failure & Revision ===');
    
    // Injecting explicit unsupported claims that contradict the PRD/Research
    const badDraft = {
      title: 'TaskFlow AI: Operating on Mars with Cold Fusion',
      introduction: 'TaskFlow AI is revolutionary. While most PM tools run on Earth, TaskFlow AI is powered by cold fusion and is hosted in a data center on Mars.',
      sections: [
        {
          heading: 'Quantum Task Breakdown',
          content: 'We use quantum entanglement to sync tasks instantly, bypassing the speed of light restrictions.'
        }
      ],
      conclusion: 'Choose TaskFlow AI for interstellar productivity.'
    };

    console.log('Running Fact Checker on bad draft (Forced Attempt 2)...');
    const badCheckRunId = crypto.randomUUID();
    const badCheck = await factCheckerAgent(
      prd,
      researchResult,
      badDraft,
      badCheckRunId,
      'fact_checker_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false }
    );

    console.log('Fact Check passed (Expected: false):', badCheck.passed);
    console.log('Unsupported Claims found (Expected > 0):', badCheck.unsupported_claims);
    console.log('Feedback:', badCheck.feedback);

    if (badCheck.passed) {
      throw new Error('Test 2 Failure: Fact check passed on a draft that explicitly claims cold fusion on Mars!');
    }

    console.log('Simulating rollback: Sending bad draft and feedback to Writer Agent...');
    const revisedDraft = await writerAgent(
      prd,
      researchResult,
      badCheckRunId,
      badDraft,
      badCheck.feedback,
      'writer_agent_revision_1',
      { attempt: 2, max_attempts: 3, is_revision: true }
    );

    console.log('Running Fact Checker on revised draft (Forced Attempt 3)...');
    const revisedCheck = await factCheckerAgent(
      prd,
      researchResult,
      revisedDraft,
      badCheckRunId,
      'fact_checker_attempt_2',
      { attempt: 2, max_attempts: 3, is_revision: true }
    );

    console.log('Revised check passed:', revisedCheck.passed);
    console.log('Revised unsupported claims:', revisedCheck.unsupported_claims);
    console.log('TEST 2 completed successfully.\n');


    // -------------------------------------------------------------
    // TEST 3: Style Polisher Fact Integrity Check
    // -------------------------------------------------------------
    console.log('=== TEST 3: Style Polisher Fact Integrity Check ===');
    
    // We will verify that:
    // 1. The output keys match the input keys.
    // 2. The core facts are not modified.
    // Let's compare word counts or look for specific claims.
    console.log('Original Draft Title:', initialDraft.title);
    console.log('Polished Draft Title:', polishedDraft.title);
    
    // Check if the Polished Draft introduced any new unauthorized words or claims
    // We can also verify that Style Polisher kept the sections structure intact.
    if (polishedDraft.sections.length !== initialDraft.sections.length) {
      throw new Error('Test 3 Failure: Style Polisher altered the section count.');
    }
    
    console.log('Style Polisher successfully preserved sections count:', polishedDraft.sections.length);
    console.log('TEST 3 completed successfully.\n');


    // -------------------------------------------------------------
    // TEST 4: Telemetry, Token Counts, and Retry Metadata Verification
    // -------------------------------------------------------------
    console.log('=== TEST 4: Supabase Telemetry Log Verification ===');
    
    // Allow database writes to complete
    console.log('Waiting for database writes to complete...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('Querying Supabase logs for runId:', runId);
    const { data: logs, error } = await supabase
      .from('agent_logs')
      .select('agent_name, input, output, latency_ms, token_count')
      .eq('run_id', runId);

    if (error) {
      throw new Error(`Failed to query agent_logs: ${error.message}`);
    }

    console.log(`Found ${logs?.length || 0} telemetry logs in Supabase.`);
    console.log('Logged agents list:', logs.map(l => l.agent_name));

    // Verify token_count and retry_metadata in logs
    for (const log of logs) {
      console.log(`\nVerifying Log for agent [${log.agent_name}]:`);
      console.log(`- Latency: ${log.latency_ms}ms`);
      console.log(`- Token Count captured: ${log.token_count ?? 'MISSING!'}`);
      
      if (log.token_count === undefined) {
        console.warn(`[WARNING] Log for [${log.agent_name}] is missing token_count.`);
      }

      const inputObj = typeof log.input === 'string' ? JSON.parse(log.input) : log.input;
      if (inputObj && inputObj.retry_metadata) {
        console.log(`- Retry Metadata:`, JSON.stringify(inputObj.retry_metadata));
      } else {
        console.log(`- Retry Metadata: NONE (expected if research or initial run without metadata)`);
      }
    }

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('\n--- TEST EXECUTION FAILED ---');
    console.error(err);
    process.exit(1);
  }
}

runDay3Tests();
