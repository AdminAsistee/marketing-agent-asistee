'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface HistoryRecord {
  run_id: string;
  timestamp: string;
  title: string;
  feature: string;
  status: 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  error?: string;
  inputSummary: string;
  outputPreview: string;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Dynamic document title update
  useEffect(() => {
    document.title = 'History: Generation Logs';
  }, []);

  const fetchHistory = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const res = await fetch('/api/history');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      if (!data || !Array.isArray(data)) {
        setRecords([]);
        return;
      }

      // De-duplicate by run_id (the first occurrence in the descending list is the latest state)
      const uniqueMap = new Map<string, any>();
      for (const log of data) {
        if (!uniqueMap.has(log.run_id)) {
          uniqueMap.set(log.run_id, log);
        }
      }

      const resolvedRecords: HistoryRecord[] = Array.from(uniqueMap.values()).map((log) => {
        const input = typeof log.input === 'string' ? JSON.parse(log.input) : log.input;
        const output = typeof log.output === 'string' ? JSON.parse(log.output) : log.output;
        
        // Map legacy feature names to standard names
        let feature = input?.feature || 'Generate Article';
        if (feature === 'SEO Analysis') feature = 'SEO Intelligence';
        if (feature === 'Article Optimization') feature = 'Optimize Existing Article';
        if (feature === 'Article Generation') feature = 'Generate Article';

        const status = output?.status || 'Completed';

        // 1. Resolve User Input Summary
        let inputSummary = 'N/A';
        if (feature === 'Generate Article' || feature === 'SEO-optimized article generation') {
          inputSummary = input?.prdSnippet ? `PRD Specs: "${input.prdSnippet}..."` : 'N/A';
        } else if (feature === 'SEO Intelligence') {
          inputSummary = `Keyword: "${input?.keyword || input?.title || 'N/A'}"` + (input?.websiteContext ? ` | Context: "${input.websiteContext}"` : '');
        } else if (feature === 'Optimize Existing Article') {
          inputSummary = `Keyword: "${input?.targetKeyword || input?.title || 'N/A'}"` + (input?.articleSnippet ? ` | Article Snippet: "${input.articleSnippet}..."` : '');
        } else if (feature === 'Originality Analysis') {
          inputSummary = input?.inputSnippet ? `Topic/Draft: "${input.inputSnippet}..."` : 'N/A';
        }

        // 2. Resolve Output Preview
        let outputPreview = 'No preview available.';
        if (status === 'Running') {
          outputPreview = '🔄 Generation is currently executing in real-time...';
        } else if (status === 'Cancelled') {
          outputPreview = '⊘ Execution was manually stopped by the user.';
        } else if (status === 'Failed') {
          outputPreview = `⚠️ Error: ${output?.error || 'Execution failed.'}`;
        } else if (status === 'Completed') {
          const resVal = output?.result;
          if (feature === 'Generate Article' || feature === 'SEO-optimized article generation') {
            const rubricScore = output?.rubric?.overall_score || 'N/A';
            outputPreview = `📝 Article Draft: "${resVal?.title || 'Untitled'}" (${rubricScore}/5 Quality Grade)`;
          } else if (feature === 'SEO Intelligence') {
            const primary = resVal?.recommendations?.primaryKeyword || 'N/A';
            const titles = resVal?.recommendations?.recommendedTitles || [];
            outputPreview = `📈 Target: "${primary}"` + (titles.length > 0 ? ` | Title Suggestion: "${titles[0]}"` : '');
          } else if (feature === 'Optimize Existing Article') {
            const score = resVal?.report?.seo_score || 'N/A';
            const suggestions = resVal?.report?.improvement_suggestions || [];
            outputPreview = `📊 SEO Score: ${score}` + (suggestions.length > 0 ? ` | Recommendation: "${suggestions[0]}"` : '');
          } else if (feature === 'Originality Analysis') {
            const angles = resVal?.missing_angles || [];
            outputPreview = angles.length > 0 ? `💡 Missing Angle: "${angles[0]}"` : 'Originality report generated successfully.';
          }
        }

        return {
          run_id: log.run_id,
          timestamp: log.timestamp || new Date().toISOString(),
          title: input?.title || 'Untitled Run',
          feature: feature,
          status: status,
          error: output?.error,
          inputSummary,
          outputPreview
        };
      });

      setRecords(resolvedRecords);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error fetching history:', msg);
      setError(msg || 'Failed to fetch history logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(true);

    // Set up BroadcastChannel for real-time updates across tabs
    const channel = new BroadcastChannel('content_agent_history');
    channel.onmessage = (event) => {
      if (event.data?.type === 'history_updated') {
        console.log('[HISTORY PAGE] Re-fetching history due to cross-tab signal...');
        fetchHistory(false);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  const handleReopen = (record: HistoryRecord) => {
    if (record.feature === 'SEO Intelligence') {
      router.push(`/seo?runId=${record.run_id}`);
    } else if (record.feature === 'Optimize Existing Article') {
      router.push(`/optimize?runId=${record.run_id}`);
    } else if (record.feature === 'Originality Analysis') {
      router.push(`/originality?runId=${record.run_id}`);
    } else {
      router.push(`/timeline/${record.run_id}`);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'badge-success';
      case 'Running':
        return 'badge-info';
      case 'Cancelled':
        return 'badge-warning';
      case 'Failed':
      default:
        return 'badge-error';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return '✓';
      case 'Running':
        return '●';
      case 'Cancelled':
        return '⊘';
      case 'Failed':
      default:
        return '⚠️';
    }
  };

  const getFeatureColor = (feature: string) => {
    switch (feature) {
      case 'SEO Intelligence':
        return 'var(--info)';
      case 'Optimize Existing Article':
        return 'var(--warning)';
      case 'SEO-optimized article generation':
        return 'var(--success)';
      case 'Originality Analysis':
        return 'var(--primary)';
      case 'Generate Article':
      default:
        return '#818cf8'; // Indigo
    }
  };

  return (
    <div className="container">
      <div className="header" style={{ textAlign: 'left', marginBottom: '40px' }}>
        <h1 className="title-gradient" style={{ fontSize: '2.5rem' }}>Generation History</h1>
        <p className="subtitle">Chronological list of all your AI Content platform executions, reports, and generated articles.</p>
      </div>

      {loading ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading Generation History...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderLeft: '4px solid var(--error)' }}>
          <h3 style={{ color: 'var(--error)', marginBottom: '8px' }}>Failed to retrieve history</h3>
          <p style={{ marginBottom: '16px' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => fetchHistory(true)}>
            Retry Fetching
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>No history records found</h3>
          <p style={{ color: 'var(--gray-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Run SEO keyword analyses, write new articles, or run optimizations to populate history.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <Link href="/generate" className="btn btn-primary">
              Generate Article
            </Link>
            <Link href="/seo" className="btn btn-primary" style={{ background: 'var(--info)', border: 'none', boxShadow: 'none' }}>
              SEO Intelligence
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {records.map((record) => (
            <div
              key={record.run_id}
              onClick={() => handleReopen(record)}
              className="card"
              style={{
                margin: 0,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '24px',
                borderLeft: `5px solid ${getFeatureColor(record.feature)}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Top Row: Date, Feature Tag, Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span 
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: getFeatureColor(record.feature),
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: `1px solid ${getFeatureColor(record.feature)}33`,
                      textTransform: 'uppercase'
                    }}
                  >
                    {record.feature}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-muted)', fontFamily: 'var(--font-mono)' }}>
                    ⏱️ {new Date(record.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <span className={`badge ${getStatusBadgeClass(record.status)}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800 }}>
                  {getStatusIcon(record.status)} {record.status}
                </span>
              </div>

              {/* Title & RunID */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0 6px 0', color: 'var(--foreground)' }}>
                  {record.title}
                </h3>
                <span style={{ color: 'var(--gray-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  Run ID: {record.run_id}
                </span>
              </div>

              {/* User Input Summary */}
              <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', background: 'rgba(0, 0, 0, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--gray-muted)', fontWeight: 600, display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '2px' }}>User Input Summary</span>
                {record.inputSummary}
              </div>

              {/* Output Preview & View Result Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px' }}>
                <div style={{ flex: 1, minWidth: '240px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--gray-muted)', fontWeight: 600, display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '2px' }}>Output Preview</span>
                  <span style={{ color: 'var(--gray-muted)' }}>{record.outputPreview}</span>
                </div>

                <button
                  className="btn"
                  style={{
                    background: getFeatureColor(record.feature),
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: `0 4px 10px ${getFeatureColor(record.feature)}22`
                  }}
                >
                  View Result ➔
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
