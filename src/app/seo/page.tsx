'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface TrendData {
  keyword: string;
  relatedQueries: string[];
  risingQueries: string[];
  trendSummary: string;
}

interface KeywordSuggestion {
  ranking: number;
  keyword: string;
  searchGrowth: string;
  relevanceScore: number;
  opportunityExplanation: string;
}

interface SeoRecommendations {
  primaryKeyword: string;
  secondaryKeywords: string[];
  contentIdeas: string[];
  recommendedTitles: string[];
  seoStrategy: string;
  keywordSuggestions: KeywordSuggestion[];
}

function SeoPageContent() {
  const [keyword, setKeyword] = useState('');
  const [websiteContext, setWebsiteContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [recommendations, setRecommendations] = useState<SeoRecommendations | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');

  // Load from runId query param if present
  useEffect(() => {
    if (!runId) return;

    setLoading(true);
    setError(null);
    setTrendData(null);
    setRecommendations(null);

    fetch(`/api/logs?runId=${runId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch logs for this run.');
        }
        return res.json();
      })
      .then((logs) => {
        const seoAgentLog = logs.find((l: any) => l.agent_name === 'seo_agent');
        const pipelineStatusLog = logs.find((l: any) => l.agent_name === 'pipeline_status');

        if (seoAgentLog) {
          const input = typeof seoAgentLog.input === 'string' ? JSON.parse(seoAgentLog.input) : seoAgentLog.input;
          const output = typeof seoAgentLog.output === 'string' ? JSON.parse(seoAgentLog.output) : seoAgentLog.output;

          setKeyword(input.keyword || '');
          setWebsiteContext(input.websiteContext || '');
          setTrendData(input.trendData || null);
          setRecommendations(output || null);
        } else if (pipelineStatusLog) {
          const input = typeof pipelineStatusLog.input === 'string' ? JSON.parse(pipelineStatusLog.input) : pipelineStatusLog.input;
          const output = typeof pipelineStatusLog.output === 'string' ? JSON.parse(pipelineStatusLog.output) : pipelineStatusLog.output;

          setKeyword(input.title || '');
          if (output.result) {
            setTrendData(output.result.trendData || null);
            setRecommendations(output.result.recommendations || null);
          }
        } else {
          setError('No SEO analysis data found for this run ID.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to retrieve SEO analysis from history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [runId]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      setError('Please enter a keyword or topic.');
      return;
    }

    setLoading(true);
    setError(null);
    setTrendData(null);
    setRecommendations(null);

    try {
      const response = await fetch('/api/seo/trends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword, websiteContext }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTrendData(data.trendData);
      setRecommendations(data.recommendations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'An unexpected error occurred during SEO analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseRecommendations = () => {
    if (!recommendations) return;
    localStorage.setItem('seo_recommendations', JSON.stringify({
      keyword,
      recommendations
    }));
    router.push('/generate');
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title-gradient">SEO Keyword Intelligence</h1>
        <p className="subtitle">Identify high-value keywords, rising queries, and optimized blog content ideas using search trends.</p>
      </div>

      {loading ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">Analyzing SEO Opportunities...</p>
          <p className="loading-subtext">
            Retrieving Google Trends data and running SEO Analysis Agent. This takes about 10-15 seconds.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          {/* Input Form Card */}
          <form onSubmit={handleAnalyze} className="card" style={{ margin: 0 }}>
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
              <label className="form-label" htmlFor="keyword-input">
                Target Keyword or Topic
              </label>
              <input
                type="text"
                id="keyword-input"
                className="textarea-input"
                style={{ minHeight: 'auto', padding: '12px 16px' }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., Pokemon cards"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="context-input">
                Website or Business Context (Optional)
              </label>
              <textarea
                id="context-input"
                className="textarea-input"
                style={{ minHeight: '120px' }}
                value={websiteContext}
                onChange={(e) => setWebsiteContext(e.target.value)}
                placeholder="e.g., TCGNakama marketplace for buying/selling cards"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              Analyze SEO Opportunities
            </button>
          </form>

          {/* Results Output (If Available) */}
          {trendData && recommendations && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }} className="seo-results-grid">
              
              {/* Trends Data Card */}
              <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--info)' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--info)', marginBottom: '12px' }}>📊 Google Search Trends Analysis</h2>
                
                <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Search Interest Summary</h4>
                <p style={{ lineHeight: '1.6', marginBottom: '20px' }}>{trendData.trendSummary}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Related Queries</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {trendData.relatedQueries.length > 0 ? (
                        trendData.relatedQueries.map((q, idx) => (
                          <span key={idx} className="badge badge-info" style={{ textTransform: 'none', padding: '6px 12px', fontSize: '0.85rem' }}>
                            {q}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--gray-muted)', fontStyle: 'italic' }}>No related queries found.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Rising Topics / Searches</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {trendData.risingQueries.length > 0 ? (
                        trendData.risingQueries.map((q, idx) => (
                          <span key={idx} className="badge badge-warning" style={{ textTransform: 'none', padding: '6px 12px', fontSize: '0.85rem' }}>
                            📈 {q}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--gray-muted)', fontStyle: 'italic' }}>No rising queries found.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations Card */}
              <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>🤖 SEO Agent Recommendations</h2>
                    <p style={{ color: 'var(--gray-muted)', fontSize: '0.9rem' }}>Optimal target keywords and content strategies generated by Gemini.</p>
                  </div>
                  <button
                    onClick={handleUseRecommendations}
                    className="btn btn-primary"
                    style={{
                      background: 'var(--success)',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      padding: '10px 20px',
                      fontSize: '0.9rem'
                    }}
                  >
                    🚀 Use in Blog Generator
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  <div className="section-box" style={{ margin: 0, borderLeft: '3px solid var(--primary)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Primary Keyword</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{recommendations.primaryKeyword}</strong>
                  </div>
                  <div className="section-box" style={{ margin: 0, borderLeft: '3px solid var(--success)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Secondary Keywords</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {recommendations.secondaryKeywords.map((kw, idx) => (
                        <span key={idx} className="badge badge-success" style={{ textTransform: 'none', padding: '4px 8px' }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ranked Keyword Suggestions */}
                {recommendations.keywordSuggestions && recommendations.keywordSuggestions.length > 0 && (
                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>
                      📊 Ranked Keyword Opportunities & Metrics
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {recommendations.keywordSuggestions
                        .sort((a, b) => a.ranking - b.ranking)
                        .map((s) => (
                          <div
                            key={s.ranking}
                            style={{
                              background: 'rgba(0,0,0,0.15)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '8px',
                              padding: '14px 18px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                {s.ranking}. {s.keyword}
                              </span>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span className="badge badge-warning" style={{ textTransform: 'none', padding: '4px 8px', fontWeight: 700 }}>
                                  {s.searchGrowth}
                                </span>
                                <span className="badge badge-info" style={{ textTransform: 'none', padding: '4px 8px' }}>
                                  Relevance: {s.relevanceScore}%
                                </span>
                              </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gray-muted)', lineHeight: '1.5' }}>
                              <strong>Content Opportunity:</strong> {s.opportunityExplanation}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>SEO Content Strategy</h4>
                  <p style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '8px', lineHeight: '1.6', fontSize: '0.95rem' }}>{recommendations.seoStrategy}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Recommended Article Titles</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recommendations.recommendedTitles.map((title, idx) => (
                        <div key={idx} className="section-box" style={{ margin: 0, padding: '10px 14px', background: 'rgba(255,255,255,0.02)' }}>
                          <strong>💡 {title}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Sub-Topic Content Ideas</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recommendations.contentIdeas.map((idea, idx) => (
                        <div key={idx} className="section-box" style={{ margin: 0, padding: '10px 14px', background: 'rgba(255,255,255,0.02)' }}>
                          • {idea}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SeoPage() {
  return (
    <Suspense fallback={
      <div className="container loader-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    }>
      <SeoPageContent />
    </Suspense>
  );
}
