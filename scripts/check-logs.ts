import { loadEnvConfig } from '@next/env';
import ws from 'ws';

loadEnvConfig(process.cwd());
globalThis.WebSocket = ws as unknown as typeof globalThis.WebSocket;

async function check() {
  const { supabase } = await import('../src/lib/supabase');
  const runId = '8af5c224-9a31-4da5-820a-893dfa86ef0e';
  const { data, error } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('run_id', runId);
    
  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }
  
  console.log('Logs found:', data?.length);
  for (const log of data || []) {
    console.log(`Agent: ${log.agent_name}`);
    console.log(`Input:`, JSON.stringify(log.input, null, 2));
    console.log(`Output:`, JSON.stringify(log.output, null, 2));
  }
}

check();
