'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TrendData {
  keyword: string;
  relatedQueries: string[];
  risingQueries: string[];
  trendSummary: string;
}

interface SeoOptimizationReport {
  title_analysis: string;
  seo_score: string;
  search_intent_match: string;
  missing_keywords: string[];
  content_gaps: string[];
  recommended_headings: string[];
  readability_feedback: string;
  improvement_suggestions: string[];
  optimized_title_options: string[];
}

export default function OptimizePage() {
  const [article, setArticle] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [websiteContext, setWebsiteContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [report, setReport] = useState<SeoOptimizationReport | null>(null);
  const router = useRouter();

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!article.trim()) {
      setError('Please paste your existing article content.');
      return;
    }
    if (!targetKeyword.trim()) {
      setError('Please enter a target keyword or topic.');
      return;
    }

    setLoading(true);
    setError(null);
    setTrendData(null);
    setReport(null);

    try {
      const response = await fetch('/api/seo/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ article, websiteContext, targetKeyword }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTrendData(data.trendData);
      setReport(data.report);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'An unexpected error occurred during optimization.');
    } finally {
      setLoading(false);
    }
  };

  const handleImproveArticle = async () => {
    if (!report || !article.trim()) return;

    setImproving(true);
    setError(null);

    try {
      // 1. Format the custom PRD wrapping the original article
      const customPrd = `# Content Spec: Optimize Existing Article

## Original Article
${article}

## Target Keyword
${targetKeyword}

## Website/Business Context
${websiteContext || 'None provided'}
`;

      // 2. Map optimizer output to SEO recommendations schema
      const seoRecommendations = {
        primaryKeyword: targetKeyword,
        secondaryKeywords: report.missing_keywords,
        contentIdeas: report.content_gaps,
        recommendedTitles: report.optimized_title_options,
        seoStrategy: `Search Intent Alignment: ${report.search_intent_match}\n\nReadability Feedback: ${report.readability_feedback}\n\nKey Improvement Suggestions:\n${report.improvement_suggestions.map(s => `- ${s}`).join('\n')}`
      };

      // 3. Trigger content generation pipeline (uses Writer, Fact Checker, Style Polisher, etc.)
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prd: customPrd,
          seoRecommendations
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.run_id) {
        throw new Error('No run ID received from generation pipeline.');
      }

      // Redirect user directly to the timeline lifecycle view
      router.push(`/timeline/${data.run_id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'Failed to trigger article improvement pipeline.');
      setImproving(false);
    }
  };

  const getScoreColor = (scoreStr: string) => {
    const numeric = parseInt(scoreStr);
    if (isNaN(numeric)) return 'var(--primary)';
    if (numeric >= 80) return 'var(--success)';
    if (numeric >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title-gradient">Article SEO Optimizer</h1>
        <p className="subtitle">Analyze existing articles against search trends to find content gaps, optimize titles, and generate improved drafts.</p>
      </div>

      {loading || improving ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">{improving ? 'Improving Article with Writer Agent...' : 'Analyzing Existing Article...'}</p>
          <p className="loading-subtext">
            {improving 
              ? 'Executing sequential pipeline: Research, Writer, Fact-checking, and Style polishing. This will take about 30-60 seconds.' 
              : 'Fetching Google Trends data and comparing against your article text. This takes about 10-15 seconds.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          
          {/* Inputs Panel */}
          <form onSubmit={handleOptimize} className="card" style={{ margin: 0 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="keyword-input">
                  Target Keyword or Topic
                </label>
                <input
                  type="text"
                  id="keyword-input"
                  className="textarea-input"
                  style={{ minHeight: 'auto', padding: '12px 16px' }}
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  placeholder="e.g., coffee brewing methods"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="context-input">
                  Website or Business Context (Optional)
                </label>
                <input
                  type="text"
                  id="context-input"
                  className="textarea-input"
                  style={{ minHeight: 'auto', padding: '12px 16px' }}
                  value={websiteContext}
                  onChange={(e) => setWebsiteContext(e.target.value)}
                  placeholder="e.g., Local boutique coffee shop"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '10px' }}>
              <label className="form-label" htmlFor="article-input">
                Existing Article Content
              </label>
              <textarea
                id="article-input"
                className="textarea-input"
                style={{ minHeight: '200px' }}
                value={article}
                onChange={(e) => setArticle(e.target.value)}
                placeholder="Paste the full text of your existing article here..."
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              Analyze & Optimize Article
            </button>
          </form>

          {/* Report Results */}
          {trendData && report && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }} className="optimize-results-grid">
              
              {/* Score and Main Summary */}
              <div className="card" style={{ margin: 0, borderLeft: `6px solid ${getScoreColor(report.seo_score)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>SEO Evaluation Report</h2>
                    <p style={{ color: 'var(--gray-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Comparative analysis against live search interest trends.</p>
                  </div>
                  <div style={{
                    background: 'rgba(0,0,0,0.25)',
                    padding: '10px 20px',
                    borderRadius: '50px',
                    border: `1px solid ${getScoreColor(report.seo_score)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--gray-muted)', textTransform: 'uppercase', fontWeight: 700 }}>SEO SCORE</span>
                    <strong style={{ fontSize: '1.4rem', color: getScoreColor(report.seo_score) }}>{report.seo_score}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  <div className="section-box" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Title Analysis</span>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>{report.title_analysis}</p>
                  </div>
                  <div className="section-box" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Search Intent Match</span>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>{report.search_intent_match}</p>
                  </div>
                </div>
              </div>

              {/* Optimization Details Panel */}
              <div className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--card-border)', paddingBottom: '20px', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--success)' }}>🔧 Recommended Enhancements</h3>
                    <p style={{ color: 'var(--gray-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Actions required to rank higher for "{targetKeyword}".</p>
                  </div>
                  <button
                    onClick={handleImproveArticle}
                    className="btn btn-primary"
                    style={{
                      background: 'var(--success)',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      padding: '10px 20px',
                      fontSize: '0.9rem'
                    }}
                  >
                    ✨ Improve Article with AI
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                  
                  {/* Column 1: Gaps & Keywords */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Missing Keywords</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {report.missing_keywords.length > 0 ? (
                          report.missing_keywords.map((kw, idx) => (
                            <span key={idx} className="badge badge-warning" style={{ textTransform: 'none', padding: '6px 12px', fontSize: '0.85rem' }}>
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--gray-muted)', fontStyle: 'italic' }}>No missing keywords identified.</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Content Gaps</h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {report.content_gaps.map((gap, idx) => (
                          <li key={idx} style={{ marginBottom: '6px' }}>{gap}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Recommended Headings</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {report.recommended_headings.map((heading, idx) => (
                          <div key={idx} className="section-box" style={{ margin: 0, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', fontSize: '0.9rem' }}>
                            <strong>H2: {heading}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Suggestion details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Readability Feedback</h4>
                      <p style={{ margin: 0, background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {report.readability_feedback}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Actionable Suggestions</h4>
                      <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        {report.improvement_suggestions.map((suggestion, idx) => (
                          <li key={idx} style={{ marginBottom: '8px' }}>{suggestion}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Optimized Title Options</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {report.optimized_title_options.map((title, idx) => (
                          <div key={idx} className="section-box" style={{ margin: 0, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--success)' }}>
                            <strong>💡 {title}</strong>
                          </div>
                        ))}
                      </div>
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
