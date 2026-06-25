'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';


interface AgentLog {
  id: string;
  run_id: string;
  agent_name: string;
  input: unknown;
  output: unknown;
  latency_ms: number;
  token_count: number | null;
  timestamp: string;
}

export default function TimelinePage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggerFetch, setTriggerFetch] = useState(0);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });

    fetch(`/api/logs?runId=${runId}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((errData) => {
            throw new Error(errData.error || 'Failed to fetch logs.');
          });
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setLogs(data || []);
        setLoading(false);
      })
      .catch((err: { message?: string }) => {
        if (!active) return;
        setError(err.message || 'Failed to fetch agent execution logs.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [runId, triggerFetch]);

  // Utility to parse JSONB inputs/outputs robustly
  const parsePayload = (val: unknown): Record<string, unknown> => {
    if (!val) return {};
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return { text: val };
      }
    }
    if (val && typeof val === 'object') {
      return val as Record<string, unknown>;
    }
    return {};
  };

  // Classifies the agent execution for naming, badge, and timeline colors
  const getAgentConfig = (name: string, output: Record<string, unknown>) => {
    const isError = output && output.error;

    if (name === 'research') {
      return {
        title: 'Research Agent',
        colorClass: 'info',
        badge: isError ? 'badge-error' : 'badge-info',
        statusText: isError ? 'FAILED' : 'SUCCESS',
      };
    }
    if (name.startsWith('writer_agent_attempt')) {
      const match = name.match(/\d+$/);
      const attemptNum = match ? match[0] : '1';
      return {
        title: `Writer Agent (Attempt ${attemptNum})`,
        colorClass: 'primary',
        badge: isError ? 'badge-error' : 'badge-info',
        statusText: isError ? 'FAILED' : 'SUCCESS',
      };
    }
    if (name.startsWith('writer_agent_revision')) {
      const match = name.match(/\d+$/);
      const revNum = match ? match[0] : '1';
      return {
        title: `Writer Agent (Revision ${revNum})`,
        colorClass: 'warning',
        badge: isError ? 'badge-error' : 'badge-warning',
        statusText: isError ? 'FAILED' : 'REVISED',
      };
    }
    if (name.startsWith('fact_checker_attempt')) {
      const match = name.match(/\d+$/);
      const attemptNum = match ? match[0] : '1';
      const passed = output && output.passed === true;
      return {
        title: `Fact Checker (Attempt ${attemptNum})`,
        colorClass: passed ? 'success' : 'error',
        badge: passed ? 'badge-success' : 'badge-error',
        statusText: passed ? 'PASS' : 'FAILED',
      };
    }
    if (name === 'style-polisher') {
      return {
        title: 'Style Polisher Agent',
        colorClass: 'success',
        badge: isError ? 'badge-error' : 'badge-success',
        statusText: isError ? 'FAILED' : 'SUCCESS',
      };
    }
    if (name === 'rubric-grader') {
      return {
        title: 'Rubric Grader Agent',
        colorClass: 'primary',
        badge: isError ? 'badge-error' : 'badge-success',
        statusText: isError ? 'FAILED' : 'GRADED',
      };
    }
    return {
      title: name,
      colorClass: 'info',
      badge: 'badge-info',
      statusText: 'DONE',
    };
  };

  // Determine pipeline execution flow state
  const getPipelineBanner = () => {
    if (logs.length === 0) return null;

    const factCheckLogs = logs.filter(l => l.agent_name.startsWith('fact_checker_attempt'));
    const writerRevisionLogs = logs.filter(l => l.agent_name.startsWith('writer_agent_revision'));
    
    // Check if any fact checks failed
    const hasFailures = factCheckLogs.some(l => {
      const out = parsePayload(l.output);
      return out.passed !== true;
    });

    const lastLog = logs[logs.length - 1];
    const lastOut = parsePayload(lastLog.output);
    const isLastSuccess = lastLog.agent_name === 'style-polisher' && !lastOut.error;

    if (isLastSuccess && !hasFailures) {
      return (
        <div className="flow-status-banner success">
          ✨ Successful Flow: The initial draft passed fact-check verification on the first attempt and was style-polished.
        </div>
      );
    } else if (isLastSuccess && hasFailures) {
      return (
        <div className="flow-status-banner warning">
          🔄 Rollback Revision Flow: The draft failed initial verification but was successfully corrected and polished after {writerRevisionLogs.length} revision loop(s).
        </div>
      );
    } else {
      return (
        <div className="flow-status-banner error" style={{
          background: 'var(--error-bg)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--error)',
          padding: '16px',
          borderRadius: 'var(--border-radius)',
          marginBottom: '30px',
          fontWeight: 600
        }}>
          ⚠️ Rollback Flow Alert: The article draft failed fact checking after maximum retries. The Style Polisher was bypassed.
        </div>
      );
    }
  };

  const handleRefresh = () => {
    setTriggerFetch(prev => prev + 1);
  };

  return (
    <div className="container">
      <Link href="/generate" className="back-btn">
        ← Generate another article
      </Link>

      <div className="header" style={{ textAlign: 'left' }}>
        <h1 className="title-gradient" style={{ fontSize: '2.2rem' }}>Pipeline Generation Lifecycle</h1>
        <p className="subtitle" style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
          Run ID: {runId}
        </p>
      </div>

      {loading ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading Lifecycle Logs...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderLeft: '4px solid var(--error)' }}>
          <h3 style={{ color: 'var(--error)', marginBottom: '8px' }}>Failed to retrieve logs</h3>
          <p style={{ marginBottom: '16px' }}>{error}</p>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Retry Fetching
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>No logs found for this run ID</h3>
          <p style={{ color: 'var(--gray-muted)', marginTop: '8px', marginBottom: '20px' }}>
            Verify that the run ID is correct and that telemetry was saved in Supabase.
          </p>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      ) : (
        <>
          {getPipelineBanner()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Telemetry Logs</h3>
            <button
              onClick={handleRefresh}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔄 Refresh Logs
            </button>
          </div>

          <div className="timeline-container">
            {logs.map((log) => {
              const input = parsePayload(log.input);
              const output = parsePayload(log.output);
              const config = getAgentConfig(log.agent_name, output);
              const timestamp = new Date(log.timestamp).toLocaleString();

              return (
                <div key={log.id} className="timeline-card">
                  <div className={`timeline-dot ${config.colorClass}`} />
                  
                  <div className="card-header">
                    <div className="card-title-group">
                      <span className="card-title">{config.title}</span>
                      <span className={`badge ${config.badge}`}>
                        {config.statusText}
                      </span>
                    </div>

                    <div className="card-meta">
                      <span>⏱️ {log.latency_ms} ms</span>
                      {log.token_count !== null && (
                        <span>🪙 {log.token_count} tokens</span>
                      )}
                    </div>
                  </div>

                  <p style={{ color: 'var(--gray-muted)', fontSize: '0.85rem', marginBottom: '14px', fontFamily: 'var(--font-mono)' }}>
                    Timestamp: {timestamp}
                  </p>

                  {/* -----------------------------------------------------------
                   * Card Body: Expandable Details per Agent Type (Task 3)
                   * ----------------------------------------------------------- */}
                  
                  {/* Research Agent Details */}
                  {log.agent_name === 'research' && !output.error && (
                    <div className="details-section">
                      <details open>
                        <summary className="details-summary">Research Findings & Sources</summary>
                        <div className="details-content">
                          <p style={{ whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                            {String(output.summary || '')}
                          </p>
                          {Array.isArray(output.sources) && output.sources.length > 0 && (
                            <div>
                              <h4>Web Sources Evaluated</h4>
                              {(output.sources as Array<{ title?: string; url?: string }>).map((src, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={String(src.url || '')}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-item"
                                >
                                  🔗 {String(src.title || src.url || '')}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Writer Agent & Writer Revision Details */}
                  {(log.agent_name.startsWith('writer_agent_attempt') || log.agent_name.startsWith('writer_agent_revision')) && !output.error && (
                    <div className="details-section">
                      <details open>
                        <summary className="details-summary">Generated Article Details</summary>
                        <div className="details-content">
                          {!!input.feedback && (
                            <div style={{
                              background: 'var(--warning-bg)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              color: 'var(--warning)',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              marginBottom: '16px',
                              fontSize: '0.9rem'
                            }}>
                              <strong>Fact Checker Feedback Addressed:</strong>
                              <p style={{ marginTop: '4px' }}>{String(input.feedback)}</p>
                            </div>
                          )}

                          <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', fontWeight: 700 }}>
                            {String(output.title || '')}
                          </h3>
                          
                          <p style={{ fontStyle: 'italic', marginBottom: '16px', color: 'var(--gray-muted)' }}>
                            {String(output.introduction || '')}
                          </p>

                          {Array.isArray(output.sections) && (output.sections as Array<{ heading?: string; content?: string }>).map((sec, sIdx) => (
                            <div key={sIdx} className="section-box">
                              <h5>{sec.heading}</h5>
                              <p style={{ whiteSpace: 'pre-wrap' }}>{sec.content}</p>
                            </div>
                          ))}

                          <p style={{ fontWeight: '600', marginTop: '16px' }}>
                            {String(output.conclusion || '')}
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Fact Checker Details */}
                  {log.agent_name.startsWith('fact_checker_attempt') && !output.error && (
                    <div className="details-section">
                      <details open>
                        <summary className="details-summary">Claim Verification Report</summary>
                        <div className="details-content">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <strong>Passed Verification:</strong>
                            <span className={`badge ${output.passed ? 'badge-success' : 'badge-error'}`}>
                              {output.passed ? 'Yes' : 'No'}
                            </span>
                          </div>

                          {!output.passed && Array.isArray(output.unsupported_claims) && output.unsupported_claims.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                              <h4>Unsupported Claims Identified</h4>
                              <div style={{ marginTop: '8px' }}>
                                {(output.unsupported_claims as string[]).map((claim, cIdx) => (
                                  <div key={cIdx} className="unsupported-claim-item">
                                    {claim}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!!output.feedback && (
                            <div>
                              <h4>Factual Accuracy Feedback</h4>
                              <p style={{ whiteSpace: 'pre-wrap', marginTop: '4px', background: 'rgba(0, 0, 0, 0.1)', padding: '12px', borderRadius: '6px' }}>
                                {String(output.feedback)}
                              </p>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Style Polisher Details */}
                  {log.agent_name === 'style-polisher' && !output.error && (
                    <div className="details-section">
                      <details open>
                        <summary className="details-summary">Polished Content Output</summary>
                        <div className="details-content">
                          <h3 style={{ fontSize: '1.3rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 800 }}>
                            {String(output.title || '')}
                          </h3>
                          
                          <p style={{ fontStyle: 'italic', marginBottom: '16px', color: 'var(--gray-muted)' }}>
                            {String(output.introduction || '')}
                          </p>

                          {Array.isArray(output.sections) && (output.sections as Array<{ heading?: string; content?: string }>).map((sec, sIdx) => (
                            <div key={sIdx} className="section-box" style={{ borderLeft: '3px solid var(--primary)' }}>
                              <h5 style={{ color: 'var(--primary)', fontSize: '1rem', fontWeight: 700 }}>{sec.heading}</h5>
                              <p style={{ whiteSpace: 'pre-wrap' }}>{sec.content}</p>
                            </div>
                          ))}

                          <p style={{ fontWeight: '600', marginTop: '16px' }}>
                            {String(output.conclusion || '')}
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Rubric Grader Details */}
                  {log.agent_name === 'rubric-grader' && !output.error && (
                    <div className="details-section">
                      <details open>
                        <summary className="details-summary">Rubric Quality Evaluation Report</summary>
                        <div className="details-content">
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            <div className="section-box" style={{ textAlign: 'center', borderTop: '3px solid var(--primary)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Clarity</span>
                              <strong style={{ fontSize: '1.8rem', color: 'var(--primary)' }}>{String(output.clarity || '0')}/5</strong>
                            </div>
                            <div className="section-box" style={{ textAlign: 'center', borderTop: '3px solid var(--success)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Accuracy</span>
                              <strong style={{ fontSize: '1.8rem', color: 'var(--success)' }}>{String(output.accuracy || '0')}/5</strong>
                            </div>
                            <div className="section-box" style={{ textAlign: 'center', borderTop: '3px solid var(--warning)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Completeness</span>
                              <strong style={{ fontSize: '1.8rem', color: 'var(--warning)' }}>{String(output.completeness || '0')}/5</strong>
                            </div>
                            <div className="section-box" style={{ textAlign: 'center', borderTop: '3px solid var(--info)', background: 'var(--info-bg)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Overall Quality</span>
                              <strong style={{ fontSize: '1.8rem', color: 'var(--info)' }}>{String(output.overall_score || '0')}/5</strong>
                            </div>
                          </div>

                          <h4>Evaluation Feedback</h4>
                          <p style={{ whiteSpace: 'pre-wrap', marginTop: '6px', background: 'rgba(0, 0, 0, 0.1)', padding: '14px', borderRadius: '8px', lineHeight: '1.6' }}>
                            {String(output.feedback || '')}
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Error Card Details */}
                  {!!output.error && (
                    <div className="details-section" style={{ color: 'var(--error)' }}>
                      <strong>Execution Error:</strong>
                      <p style={{ marginTop: '4px' }}>{String(output.error)}</p>
                    </div>
                  )}

                  {/* Raw JSON Accordion (Required by Task 3) */}
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    <details>
                      <summary className="details-summary" style={{ fontSize: '0.8rem', color: 'var(--gray-muted)' }}>
                        View Raw Telemetry JSON
                      </summary>
                      <div style={{ marginTop: '10px' }}>
                        <pre className="raw-json">
                          {JSON.stringify({ input, output }, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>

                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
