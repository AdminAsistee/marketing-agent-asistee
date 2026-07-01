'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface HistoryRecord {
  run_id: string;
  timestamp: string;
  title: string;
  feature: string;
  status: 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  error?: string;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all pipeline_status logs ordered by timestamp descending
        const { data, error: fetchError } = await supabase
          .from('agent_logs')
          .select('*')
          .eq('agent_name', 'pipeline_status')
          .order('timestamp', { ascending: false });

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (!data) {
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
          return {
            run_id: log.run_id,
            timestamp: log.timestamp || new Date().toISOString(),
            title: input?.title || 'Untitled Run',
            feature: input?.feature || 'Article Generation',
            status: output?.status || 'Completed',
            error: output?.error
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
    }

    fetchHistory();
  }, []);

  const handleReopen = (record: HistoryRecord) => {
    if (record.feature === 'SEO Analysis') {
      router.push(`/seo?runId=${record.run_id}`);
    } else if (record.feature === 'Article Optimization') {
      router.push(`/optimize?runId=${record.run_id}`);
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

  return (
    <div className="container">
      <div className="header">
        <h1 className="title-gradient">Generation History</h1>
        <p className="subtitle">Retrieve previous generated articles, SEO analyses, optimization reports, and check execution statuses.</p>
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
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '20px 24px',
                borderLeft: `4px solid ${
                  record.status === 'Completed'
                    ? 'var(--success)'
                    : record.status === 'Running'
                    ? 'var(--info)'
                    : record.status === 'Cancelled'
                    ? 'var(--warning)'
                    : 'var(--error)'
                }`
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${getStatusBadgeClass(record.status)}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800 }}>
                    {getStatusIcon(record.status)} {record.status}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(record.timestamp).toLocaleString()}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '4px' }}>
                  {record.title}
                </h3>
                <p style={{ color: 'var(--gray-muted)', fontSize: '0.85rem' }}>
                  Run ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{record.run_id}</span>
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      color: 'var(--gray-muted)',
                      display: 'block',
                      marginBottom: '2px'
                    }}
                  >
                    Feature Used
                  </span>
                  <strong
                    style={{
                      fontSize: '0.95rem',
                      color:
                        record.feature === 'SEO Analysis'
                          ? 'var(--info)'
                          : record.feature === 'Article Optimization'
                          ? 'var(--warning)'
                          : 'var(--primary)'
                    }}
                  >
                    {record.feature}
                  </strong>
                </div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    color: 'var(--gray-muted)'
                  }}
                >
                  ➔
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
