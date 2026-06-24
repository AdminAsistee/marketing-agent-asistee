import { supabase } from './supabase';
import { AgentLog } from './types';

export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[\x1b[36m${timestamp}\x1b[0m] [\x1b[32mINFO\x1b[0m] ${message}`,
      meta ? '\n' + JSON.stringify(meta, null, 2) : ''
    );
  },

  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(
      `[\x1b[36m${timestamp}\x1b[0m] [\x1b[31mERROR\x1b[0m] ${message}`,
      error ? '\n' + JSON.stringify(error, null, 2) : ''
    );
  },

  logAgentTransaction: async (log: AgentLog): Promise<AgentLog | null> => {
    const timestamp = new Date().toISOString();
    
    // Log to console first
    console.log(
      `[\x1b[36m${timestamp}\x1b[0m] [\x1b[35mTELEMETRY\x1b[0m] Agent: \x1b[33m${log.agent_name}\x1b[0m | Run ID: \x1b[34m${log.run_id}\x1b[0m | Latency: \x1b[32m${log.latency_ms}ms\x1b[0m | Tokens: \x1b[32m${log.token_count ?? 'N/A'}\x1b[0m`
    );

    try {
      const { data, error } = await supabase
        .from('agent_logs')
        .insert([
          {
            run_id: log.run_id,
            agent_name: log.agent_name,
            input: log.input,
            output: log.output,
            latency_ms: log.latency_ms,
            token_count: log.token_count,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(
          `[\x1b[36m${timestamp}\x1b[0m] [\x1b[31mERROR\x1b[0m] Failed to save telemetry to Supabase: ${error.message}`
        );
        return null;
      }

      return data as AgentLog;
    } catch (err: any) {
      console.error(
        `[\x1b[36m${timestamp}\x1b[0m] [\x1b[31mERROR\x1b[0m] Exception saving telemetry to Supabase:`,
        err
      );
      return null;
    }
  },
};
