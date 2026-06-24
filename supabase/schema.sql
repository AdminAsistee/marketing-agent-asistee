-- Create agent_logs table for pipeline telemetry
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    input JSONB NOT NULL,
    output JSONB NOT NULL,
    latency_ms INTEGER NOT NULL,
    token_count INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index by run_id to optimize fetching logs for a specific pipeline execution
CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id ON agent_logs(run_id);

-- Enable Row Level Security (RLS) optionally, or allow anonymous reads for the telemetry dashboard if simple
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow select access to everyone (so the dashboard can read logs)
CREATE POLICY "Allow public read access" ON agent_logs
    FOR SELECT USING (true);

-- Create policy to allow insert access using service_role key (serverless API routes will write logs)
CREATE POLICY "Allow service role inserts" ON agent_logs
    FOR INSERT WITH CHECK (true);
