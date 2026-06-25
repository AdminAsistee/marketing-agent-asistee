import { loadEnvConfig } from '@next/env';
import ws from 'ws';

// Load env variables
loadEnvConfig(process.cwd());

// Mock WebSocket for Node.js
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function testSupabase() {
  console.log('Verifying Supabase connection and schema...');
  
  try {
    const { supabase } = await import('../src/lib/supabase');
    
    // Attempt a basic read query on agent_logs to verify connection and schema
    console.log('Querying agent_logs table...');
    const { data, error } = await supabase
      .from('agent_logs')
      .select('id, agent_name, timestamp')
      .order('timestamp', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Supabase query failed:', error.message);
      process.exit(1);
    }

    console.log('Supabase connection successful!');
    console.log('Recent logs fetched:', JSON.stringify(data, null, 2));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('An unexpected error occurred during database verification:', errorMessage);
    process.exit(1);
  }
}

testSupabase();
