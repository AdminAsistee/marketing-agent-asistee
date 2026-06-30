import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import crypto from 'crypto';

loadEnvConfig(process.cwd());
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function testSeoPipeline() {
  console.log('--- STARTING SEO INTELLIGENCE PIPELINE TEST ---');

  try {
    const { fetchTrends } = await import('../src/lib/googleTrends');
    const { seoAgent } = await import('../src/lib/seoAgent');
    const { supabase } = await import('../src/lib/supabase');

    const keyword = 'Pokemon cards';
    const context = 'TCGNakama marketplace';
    const runId = crypto.randomUUID();

    // 1. Run Trends Retrieval
    console.log(`\n1. Fetching Search Trends for "${keyword}"...`);
    const trendData = await fetchTrends(keyword);
    console.log('Trends data retrieved successfully:');
    console.log(`- Keyword: ${trendData.keyword}`);
    console.log(`- Related Queries Count: ${trendData.relatedQueries.length}`);
    console.log(`- Rising Queries Count: ${trendData.risingQueries.length}`);
    console.log(`- Summary length: ${trendData.trendSummary.length} chars`);

    // 2. Run SEO Recommendations Agent
    console.log('\n2. Executing SEO Recommendations Agent...');
    const recs = await seoAgent(keyword, context, trendData, runId);
    console.log('SEO Agent executed successfully:');
    console.log(`- Primary Keyword selected: "${recs.primaryKeyword}"`);
    console.log(`- Secondary Keywords:`, recs.secondaryKeywords);
    console.log(`- Suggested titles:`, recs.recommendedTitles);
    console.log(`- Content ideas:`, recs.contentIdeas);
    console.log(`- SEO Strategy: "${recs.seoStrategy.slice(0, 150)}..."`);

    // 3. Verify Database Telemetry Write
    console.log('\n3. Verifying telemetry write to Supabase...');
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Allow DB write completion

    const { data: logs, error } = await supabase
      .from('agent_logs')
      .select('agent_name, input, output, token_count')
      .eq('run_id', runId)
      .single();

    if (error) {
      throw new Error(`Supabase verification failed: ${error.message}`);
    }

    console.log(`- Found log for agent: "${logs.agent_name}"`);
    console.log(`- Captured tokens: ${logs.token_count ?? 'N/A'}`);

    console.log('\n--- SEO PIPELINE TEST COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n[SEO TEST FAILURE]:', errorMessage);
    process.exit(1);
  }
}

testSeoPipeline();
