'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getOrCreateUserId } from '@/lib/user';

interface OriginalityReport {
  missing_angles: string[];
  unique_perspectives: string[];
  local_context_opportunities: string[];
  potential_interviews: string[];
  follow_up_topics: string[];
  exclusive_content_opportunities: string[];
}

function OriginalityPageContent() {
  const [input, setInput] = useState('');
  const [websiteContext, setWebsiteContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OriginalityReport | null>(null);

  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');

  // Load from runId query param if present (for history reopening)
  useEffect(() => {
    if (!runId) return;

    setLoading(true);
    setError(null);
    setReport(null);

    fetch(`/api/logs?runId=${runId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch logs for this run.');
        }
        return res.json();
      })
      .then((logs) => {
        const originalityLog = logs.find((l: any) => l.agent_name === 'originality_agent');
        const pipelineStatusLog = logs.find((l: any) => l.agent_name === 'pipeline_status');

        if (originalityLog) {
          const inputVal = typeof originalityLog.input === 'string' ? JSON.parse(originalityLog.input) : originalityLog.input;
          const outputVal = typeof originalityLog.output === 'string' ? JSON.parse(originalityLog.output) : originalityLog.output;

          setInput(inputVal.input || '');
          setWebsiteContext(inputVal.websiteContext || '');
          setReport(outputVal || null);
        } else if (pipelineStatusLog) {
          const inputVal = typeof pipelineStatusLog.input === 'string' ? JSON.parse(pipelineStatusLog.input) : pipelineStatusLog.input;
          const outputVal = typeof pipelineStatusLog.output === 'string' ? JSON.parse(pipelineStatusLog.output) : pipelineStatusLog.output;

          setInput(inputVal.title || '');
          if (outputVal.result) {
            setReport(outputVal.result);
          }
        } else {
          setError('No originality analysis data found for this run ID.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to retrieve originality analysis from history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [runId]);

  // Dynamic document title update
  useEffect(() => {
    if (input.trim()) {
      const displayTitle = input.trim().slice(0, 30) + (input.trim().length > 30 ? '...' : '');
      document.title = `Originality Analysis: ${displayTitle}`;
    } else {
      document.title = `Originality Analysis`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError('Please enter a topic or paste article content.');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const userId = getOrCreateUserId();
      const response = await fetch('/api/originality', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input, websiteContext, userId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setReport(data.report);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'An unexpected error occurred during originality analysis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title-gradient">Originality & Opportunity Analysis</h1>
        <p className="subtitle">Determine how your content can provide unique value beyond existing search results and stand out from the competition.</p>
      </div>

      {loading ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">Analyzing Content Originality...</p>
          <p className="loading-subtext">
            Comparing your topic/article against live search results to identify content gaps and interviews. This takes about 10-15 seconds.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          {/* Form Card */}
          <form onSubmit={handleSubmit} className="card" style={{ margin: 0 }}>
            {error && (
              <div style={{
                background: 'var(--error-bg)',
                color: 'var(--error)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                fontSize: '0.95rem'
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="input-content">
                Article Topic or Draft Content
              </label>
              <textarea
                id="input-content"
                className="textarea-input"
                style={{ minHeight: '160px' }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter the proposed article topic or paste your existing article draft here to see how you can differentiate it..."
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="website-context">
                Website or Business Context (Optional)
              </label>
              <input
                type="text"
                id="website-context"
                className="textarea-input"
                style={{ minHeight: 'auto', padding: '12px 16px' }}
                value={websiteContext}
                onChange={(e) => setWebsiteContext(e.target.value)}
                placeholder="e.g., TCGNakama marketplace, specializing in vintage trading card auctions"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              Analyze Uniqueness & Opportunities
            </button>
          </form>

          {/* Results Display */}
          {report && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              
              {/* Top Banner */}
              <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>💡 Content Opportunity Report</h2>
                <p style={{ color: 'var(--gray-muted)', fontSize: '0.9rem' }}>
                  Actionable suggestions to provide original, exclusive value that competitors fail to provide.
                </p>
              </div>

              {/* Grid of details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                
                {/* Missing Angles */}
                <div className="card" style={{ margin: 0, borderTop: '3px solid var(--error)' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--error)', marginBottom: '12px', fontWeight: 700 }}>🔍 Missing Angles</h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {report.missing_angles.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Unique Perspectives */}
                <div className="card" style={{ margin: 0, borderTop: '3px solid var(--success)' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--success)', marginBottom: '12px', fontWeight: 700 }}>✨ Unique Perspectives</h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {report.unique_perspectives.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Exclusive Content Opportunities */}
                <div className="card" style={{ margin: 0, borderTop: '3px solid var(--primary)' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', marginBottom: '12px', fontWeight: 700 }}>🎁 Exclusive Assets & Data</h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {report.exclusive_content_opportunities.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Potential Interviews */}
                <div className="card" style={{ margin: 0, borderTop: '3px solid var(--info)' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--info)', marginBottom: '12px', fontWeight: 700 }}>👥 Interview Opportunities</h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {report.potential_interviews.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Local Context Opportunities */}
                <div className="card" style={{ margin: 0, borderTop: '3px solid var(--warning)' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--warning)', marginBottom: '12px', fontWeight: 700 }}>📍 Local Context & Hooks</h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {report.local_context_opportunities.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Follow-up Topics */}
                <div className="card" style={{ margin: 0, borderTop: '3px solid var(--gray-muted)' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--foreground)', marginBottom: '12px', fontWeight: 700 }}>📚 Content Cluster Follow-ups</h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {report.follow_up_topics.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

              </div>

              {/* Action Section */}
              <div className="card" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Ready to generate your original content?</h4>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--gray-muted)', fontSize: '0.85rem' }}>Prefill these content recommendations directly inside our blog generator.</p>
                </div>
                <Link href="/generate" className="btn btn-primary">
                  Go to Blog Generator
                </Link>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OriginalityPage() {
  return (
    <Suspense fallback={
      <div className="container loader-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    }>
      <OriginalityPageContent />
    </Suspense>
  );
}
