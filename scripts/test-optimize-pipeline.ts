import { loadEnvConfig } from '@next/env';
import ws from 'ws';
import crypto from 'crypto';

loadEnvConfig(process.cwd());
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function testOptimizePipeline() {
  console.log('--- STARTING SEO OPTIMIZATION PIPELINE TEST ---');

  try {
    const { fetchTrends } = await import('../src/lib/googleTrends');
    const { seoOptimizerAgent } = await import('../src/lib/seoOptimizer');
    const { supabase } = await import('../src/lib/supabase');

    const targetKeyword = 'coffee brewing methods';
    const context = 'Local boutique coffee shop';
    const originalArticle = `
How to Make Better Coffee
Making coffee is simple. You just grind some beans and pour hot water over them.
Most people use a standard drip machine, but you can also use a French press or a pour over cone.
If you use good beans, it will taste good. Make sure your water is hot.
    `;
    const runId = crypto.randomUUID();

    // 1. Run Trends Retrieval
    console.log(`\n1. Fetching Trends for target keyword "${targetKeyword}"...`);
    const trendData = await fetchTrends(targetKeyword);
    console.log('Trends data retrieved successfully:');
    console.log(`- Keyword: ${trendData.keyword}`);
    console.log(`- Related Queries:`, trendData.relatedQueries.slice(0, 3));

    // 2. Run SEO Optimization Agent
    console.log('\n2. Executing SEO Optimization Agent...');
    const report = await seoOptimizerAgent(
      originalArticle,
      context,
      targetKeyword,
      trendData,
      runId
    );
    console.log('SEO Optimization Agent executed successfully:');
    console.log(`- SEO Score: "${report.seo_score}"`);
    console.log(`- Missing Keywords:`, report.missing_keywords);
    console.log(`- Content Gaps:`, report.content_gaps);
    console.log(`- Suggested Title Options:`, report.optimized_title_options);
    console.log(`- Readability: "${report.readability_feedback.slice(0, 100)}..."`);

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

    console.log('\n--- SEO OPTIMIZATION PIPELINE TEST COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n[SEO TEST OPTIMIZE FAILURE]:', errorMessage);
    process.exit(1);
  }
}

testOptimizePipeline();
