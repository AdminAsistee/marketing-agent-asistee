import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load env variables
loadEnvConfig(process.cwd());

// Mock WebSocket for Node.js
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function runDay5Tests() {
  console.log('--- STARTING DAY 5 final rubric evaluation TESTS ---');

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
  const { rubricGraderAgent } = await import('../src/lib/rubricGrader');
  const { supabase } = await import('../src/lib/supabase');

  // -------------------------------------------------------------
  // TEST 1: Successful Generation Flow + Rubric Evaluation
  // -------------------------------------------------------------
  console.log('\n=== TEST 1: Successful Generation & Rubric Grader ===');
  const successRunId = crypto.randomUUID();
  console.log(`Success Run ID: ${successRunId}`);

  try {
    console.log('Running Research...');
    const research = await researchAgent(prd, successRunId);

    console.log('Running Writer...');
    const draft = await writerAgent(
      prd,
      research,
      successRunId,
      undefined,
      undefined,
      'writer_agent_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false }
    );

    console.log('Running Fact Checker...');
    let factCheck = await factCheckerAgent(
      prd,
      research,
      draft,
      successRunId,
      'fact_checker_attempt_1',
      { attempt: 1, max_attempts: 3, is_revision: false }
    );

    let finalArticle = draft;

    // Handle revision if fact check fails on first attempt
    let retryCount = 0;
    while (!factCheck.passed && retryCount < 2) {
      retryCount++;
      console.log(`[TEST 1 REVISION] Fact check failed. Revision attempt ${retryCount}...`);
      finalArticle = await writerAgent(
        prd,
        research,
        successRunId,
        finalArticle,
        factCheck.feedback,
        `writer_agent_revision_${retryCount}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true }
      );
      factCheck = await factCheckerAgent(
        prd,
        research,
        finalArticle,
        successRunId,
        `fact_checker_attempt_${retryCount + 1}`,
        { attempt: retryCount + 1, max_attempts: 3, is_revision: true }
      );
    }

    if (factCheck.passed) {
      console.log('Fact check passed. Running Style Polisher...');
      finalArticle = await stylePolisherAgent(finalArticle, successRunId, 'style-polisher');
    } else {
      console.log('Fact check failed max retries. Using unpolished draft.');
    }

    console.log('Running Rubric Grader Agent...');
    const rubricGraderResult = await rubricGraderAgent(
      prd,
      finalArticle,
      factCheck,
      successRunId
    );

    console.log('TEST 1 Rubric Grader Results:');
    console.log(`- Clarity Score: ${rubricGraderResult.clarity}/5`);
    console.log(`- Accuracy Score: ${rubricGraderResult.accuracy}/5`);
    console.log(`- Completeness Score: ${rubricGraderResult.completeness}/5`);
    console.log(`- Overall Score: ${rubricGraderResult.overall_score}/5`);
    console.log(`- Feedback:\n${rubricGraderResult.feedback}\n`);

    // Verify DB logging
    console.log('Verifying successful DB telemetry write...');
    const { data: successLogs, error: successErr } = await supabase
      .from('agent_logs')
      .select('agent_name, output')
      .eq('run_id', successRunId)
      .eq('agent_name', 'rubric-grader')
      .single();

    if (successErr) {
      throw new Error(`Failed to query success log from Supabase: ${successErr.message}`);
    }
    console.log('DB Verification: Found log for', successLogs.agent_name);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Test 1 failed:', errorMsg);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 2: Lower-Quality Generation Flow + Rubric Evaluation
  // -------------------------------------------------------------
  console.log('\n=== TEST 2: Lower-Quality Flow & Rubric Grader ===');
  const failureRunId = crypto.randomUUID();
  console.log(`Failure Run ID: ${failureRunId}`);

  try {
    // Create a very bad draft that claims impossible things and violates the PRD
    const badDraft = {
      title: 'TaskFlow AI is a Magic Wand',
      introduction: 'TaskFlow AI doesn\'t use code. It is powered by standard wizardry and spellcasting.',
      sections: [
        {
          heading: 'AI Task Spellcasting',
          content: 'You wave your wand and tasks appear out of thin air. No internet connection or databases required.'
        }
      ],
      conclusion: 'Choose TaskFlow AI for magical operations.'
    };

    // Construct a failed fact-checking outcome
    const badFactCheck = {
      passed: false,
      unsupported_claims: [
        'TaskFlow AI is powered by standard wizardry and spellcasting.',
        'No internet connection or databases required.'
      ],
      feedback: 'The draft relies on magic and spellcasting which directly contradicts the PRD stating that the app is built on Next.js 15, Supabase, and Gemini API. Factual accuracy is completely compromised.'
    };

    console.log('Running Rubric Grader Agent on the bad draft...');
    const rubricGraderResult = await rubricGraderAgent(
      prd,
      badDraft,
      badFactCheck,
      failureRunId
    );

    console.log('TEST 2 Rubric Grader Results (Expect lower scores):');
    console.log(`- Clarity Score: ${rubricGraderResult.clarity}/5`);
    console.log(`- Accuracy Score: ${rubricGraderResult.accuracy}/5`);
    console.log(`- Completeness Score: ${rubricGraderResult.completeness}/5`);
    console.log(`- Overall Score: ${rubricGraderResult.overall_score}/5`);
    console.log(`- Feedback:\n${rubricGraderResult.feedback}\n`);

    // Verify DB logging
    console.log('Verifying failure DB telemetry write...');
    const { data: failureLogs, error: failureErr } = await supabase
      .from('agent_logs')
      .select('agent_name, output')
      .eq('run_id', failureRunId)
      .eq('agent_name', 'rubric-grader')
      .single();

    if (failureErr) {
      throw new Error(`Failed to query failure log from Supabase: ${failureErr.message}`);
    }
    console.log('DB Verification: Found log for', failureLogs.agent_name);
    console.log('\n--- ALL DAY 5 TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Test 2 failed:', errorMsg);
    process.exit(1);
  }
}

runDay5Tests();
