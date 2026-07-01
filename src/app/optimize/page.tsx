'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
  strengths: string[];
  weaknesses: string[];
  seo_issues: string[];
  missing_information: string[];
}

function OptimizePageContent() {
  const [article, setArticle] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [websiteContext, setWebsiteContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [report, setReport] = useState<SeoOptimizationReport | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // States for the in-place improvement pipeline
  const [improvementLogs, setImprovementLogs] = useState<any[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled'>('Pending');
  const [optimizedDraft, setOptimizedDraft] = useState<any | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');

  // Load from runId query param if present
  useEffect(() => {
    if (!runId) return;

    setLoading(true);
    setError(null);
    setTrendData(null);
    setReport(null);
    setCurrentRunId(runId);

    fetch(`/api/logs?runId=${runId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch logs for this run.');
        }
        return res.json();
      })
      .then((logs) => {
        const optimizerLog = logs.find((l: any) => l.agent_name === 'seo_optimizer_agent');
        const pipelineStatusLog = logs.find((l: any) => l.agent_name === 'pipeline_status');
        
        if (optimizerLog) {
          const input = typeof optimizerLog.input === 'string' ? JSON.parse(optimizerLog.input) : optimizerLog.input;
          const output = typeof optimizerLog.output === 'string' ? JSON.parse(optimizerLog.output) : optimizerLog.output;

          setArticle(input.article || '');
          setTargetKeyword(input.targetKeyword || '');
          setWebsiteContext(input.websiteContext || '');
          setTrendData(input.trendData || null);
          setReport(output || null);
        } else if (pipelineStatusLog && pipelineStatusLog.output) {
          const output = typeof pipelineStatusLog.output === 'string' ? JSON.parse(pipelineStatusLog.output) : pipelineStatusLog.output;
          if (output.result && output.result.report) {
            setReport(output.result.report);
            setTrendData(output.result.trendData);
            setArticle(output.result.article || '');
          }
        }

        // Check if there are also writer/polisher logs for this runId
        const writerLogs = logs.filter(
          (l: any) => l.agent_name.startsWith('writer_agent_attempt') || l.agent_name.startsWith('writer_agent_revision') || l.agent_name === 'style-polisher'
        );

        if (writerLogs.length > 0) {
          setImprovementLogs(logs);
          setImproving(true); // Put the page into improving/completed view
          
          const polisherLog = logs.find((l: any) => l.agent_name === 'style-polisher');
          let draftPayload = null;
          if (polisherLog && polisherLog.output) {
            const out = typeof polisherLog.output === 'string' ? JSON.parse(polisherLog.output) : polisherLog.output;
            draftPayload = out.polishedDraft || (out.title ? out : null);
          }
          if (!draftPayload) {
            const lastWriter = writerLogs[writerLogs.length - 1];
            draftPayload = typeof lastWriter.output === 'string' ? JSON.parse(lastWriter.output) : lastWriter.output;
          }
          setOptimizedDraft(draftPayload);
          setPipelineStatus(pipelineStatusLog ? JSON.parse(pipelineStatusLog.output).status : 'Completed');
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to retrieve optimization analysis from history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [runId]);

  // Polling for progress during in-place improvement
  useEffect(() => {
    if (!improving || !currentRunId || pipelineStatus === 'Completed' || pipelineStatus === 'Failed' || pipelineStatus === 'Cancelled') {
      return;
    }

    let active = true;
    const fetchLogs = () => {
      fetch(`/api/logs?runId=${currentRunId}`)
        .then(res => res.json())
        .then(data => {
          if (!active) return;
          const logList = data || [];
          setImprovementLogs(logList);

          const statusLog = logList.find((l: any) => l.agent_name === 'pipeline_status');
          if (statusLog) {
            const out = typeof statusLog.output === 'string' ? JSON.parse(statusLog.output) : statusLog.output;
            setPipelineStatus(out.status);

            if (out.status === 'Completed' || out.status === 'Failed' || out.status === 'Cancelled') {
              // Retrieve final optimized draft
              const polisherLog = logList.find((l: any) => l.agent_name === 'style-polisher');
              let draftPayload = null;
              if (polisherLog && polisherLog.output) {
                const polOut = typeof polisherLog.output === 'string' ? JSON.parse(polisherLog.output) : polisherLog.output;
                draftPayload = polOut.polishedDraft || (polOut.title ? polOut : null);
              }
              if (!draftPayload) {
                const writerLogs = logList.filter(
                  (l: any) => l.agent_name.startsWith('writer_agent_attempt') || l.agent_name.startsWith('writer_agent_revision')
                );
                if (writerLogs.length > 0) {
                  const lastWriter = writerLogs[writerLogs.length - 1];
                  draftPayload = typeof lastWriter.output === 'string' ? JSON.parse(lastWriter.output) : lastWriter.output;
                }
              }
              setOptimizedDraft(draftPayload);
            }
          }
        })
        .catch(err => console.error('Error polling improvement logs:', err));
    };

    const intervalId = setInterval(fetchLogs, 1500);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [improving, currentRunId, pipelineStatus]);

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
    setOptimizedDraft(null);
    setImproving(false);
    setPipelineStatus('Pending');

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
      setCurrentRunId(data.run_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'An unexpected error occurred during optimization.');
    } finally {
      setLoading(false);
    }
  };

  const handleImproveArticle = async () => {
    if (!report || !article.trim() || !currentRunId) return;

    setImproving(true);
    setPipelineStatus('Running');
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

      // 3. Trigger content generation pipeline using the SAME runId
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prd: customPrd,
          seoRecommendations,
          runId: currentRunId
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'Failed to trigger article improvement pipeline.');
      setImproving(false);
      setPipelineStatus('Failed');
    }
  };

  const handleStopImprovement = async () => {
    if (!currentRunId) return;
    setStopping(true);
    try {
      const res = await fetch('/api/generate/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: currentRunId })
      });
      if (res.ok) {
        setPipelineStatus('Cancelled');
      }
    } catch (err) {
      console.error('Failed to cancel pipeline:', err);
    } finally {
      setStopping(false);
    }
  };

  // Word count and reading time calculation
  const getReadingTime = (payload: any) => {
    if (!payload) return null;
    let text = `${payload.title || ''} ${payload.introduction || ''} ${payload.conclusion || ''}`;
    if (Array.isArray(payload.sections)) {
      payload.sections.forEach((s: any) => {
        text += ` ${s.heading || ''} ${s.content || ''}`;
      });
    }
    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount === 0) return null;

    const wpm = 225; // 225 average WPM
    const totalSeconds = Math.round((wordCount / wpm) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return {
      word_count: String(wordCount),
      reading_time_minutes: String(minutes),
      reading_time_seconds: String(seconds)
    };
  };

  const getScoreColor = (scoreStr: string) => {
    const numeric = parseInt(scoreStr);
    if (isNaN(numeric)) return 'var(--primary)';
    if (numeric >= 80) return 'var(--success)';
    if (numeric >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  const getStageStatus = (stage: string) => {
    const logs = improvementLogs;
    const hasResearch = logs.some(l => l.agent_name === 'research');
    const hasWriter = logs.some(l => l.agent_name.startsWith('writer_agent_attempt'));
    const hasFactChecker = logs.some(l => l.agent_name.startsWith('fact_checker_attempt'));
    const hasStylePolisher = logs.some(l => l.agent_name === 'style-polisher');
    const hasRubricGrader = logs.some(l => l.agent_name === 'rubric-grader');
    
    const factCheckerLogs = logs.filter(l => l.agent_name.startsWith('fact_checker_attempt'));
    const latestFactCheck = factCheckerLogs.length > 0 ? (typeof factCheckerLogs[factCheckerLogs.length - 1].output === 'string' ? JSON.parse(factCheckerLogs[factCheckerLogs.length - 1].output) : factCheckerLogs[factCheckerLogs.length - 1].output) : null;
    const isFactCheckPassed = latestFactCheck?.passed === true;

    const isCancelled = pipelineStatus === 'Cancelled';
    const isFailed = pipelineStatus === 'Failed';
    const isFinished = pipelineStatus === 'Completed';

    switch (stage) {
      case 'research':
        if (hasResearch) return { status: 'completed', text: '✓ Research sources found' };
        if (isCancelled) return { status: 'failed', text: '⊘ Research cancelled' };
        if (isFailed) return { status: 'failed', text: '✗ Research failed' };
        return { status: 'running', text: '● Researching sources...' };
      case 'writer':
        if (hasWriter) return { status: 'completed', text: '✓ Improved draft written' };
        if (!hasResearch) return { status: 'pending', text: '○ Writing improved draft' };
        if (isCancelled) return { status: 'failed', text: '⊘ Writing draft cancelled' };
        if (isFailed) return { status: 'failed', text: '✗ Writing draft failed' };
        return { status: 'running', text: '● Writing improved draft...' };
      case 'fact-check':
        if (hasFactChecker) {
          if (isFinished || hasRubricGrader) {
            return {
              status: isFactCheckPassed ? 'completed' : 'warning',
              text: isFactCheckPassed ? '✓ Verification passed' : '✓ Verification done (failed, style bypassed)'
            };
          }
          return { status: 'running', text: `● Revision attempt ${factCheckerLogs.length + 1}...` };
        }
        if (!hasWriter) return { status: 'pending', text: '○ Verifying claims' };
        if (isCancelled) return { status: 'failed', text: '⊘ Verification cancelled' };
        if (isFailed) return { status: 'failed', text: '✗ Verification failed' };
        return { status: 'running', text: '● Verifying claims...' };
      case 'style':
        if (hasStylePolisher) return { status: 'completed', text: '✓ Style polished' };
        if (hasFactChecker && !isFactCheckPassed && (isFinished || hasRubricGrader)) {
          return { status: 'skipped', text: '○ Polishing bypassed' };
        }
        if (!hasFactChecker || !isFactCheckPassed) return { status: 'pending', text: '○ Polishing style' };
        if (isCancelled) return { status: 'failed', text: '⊘ Polishing cancelled' };
        if (isFailed) return { status: 'failed', text: '✗ Polishing failed' };
        return { status: 'running', text: '● Polishing style...' };
      default:
        return { status: 'pending', text: '' };
    }
  };

  const readingTime = getReadingTime(optimizedDraft);

  return (
    <div className="container">
      <div className="header">
        <h1 className="title-gradient">Article SEO Optimizer</h1>
        <p className="subtitle">Analyze existing articles against search trends to find content gaps, optimize titles, and generate improved drafts.</p>
      </div>

      {loading ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">Analyzing Existing Article...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
          
          {/* Inputs Panel */}
          <form onSubmit={handleOptimize} className="card" style={{ margin: 0 }}>
            {error && !improving && (
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
                  disabled={loading || improving}
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
                  disabled={loading || improving}
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
                style={{ minHeight: '180px' }}
                value={article}
                onChange={(e) => setArticle(e.target.value)}
                placeholder="Paste the full text of your existing article here..."
                disabled={loading || improving}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || improving}
            >
              Analyze & Optimize Article
            </button>
          </form>

          {/* Report Results */}
          {trendData && report && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }} className="optimize-results-grid">
              
              {/* Top Row: Original Content Evaluation Analysis */}
              <div className="card" style={{ margin: 0, borderLeft: `6px solid ${getScoreColor(report.seo_score)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>SEO Evaluation & Original Analysis</h2>
                    <p style={{ color: 'var(--gray-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Comparative evaluation of the original article draft.</p>
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

                {/* Strengths / Weaknesses / Issues Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  <div className="section-box" style={{ margin: 0, borderTop: '2px solid var(--success)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>✓ Strengths</span>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      {report.strengths?.map((s, idx) => <li key={idx}>{s}</li>)}
                    </ul>
                  </div>

                  <div className="section-box" style={{ margin: 0, borderTop: '2px solid var(--error)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--error)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>✗ Weaknesses</span>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      {report.weaknesses?.map((w, idx) => <li key={idx}>{w}</li>)}
                    </ul>
                  </div>

                  <div className="section-box" style={{ margin: 0, borderTop: '2px solid var(--warning)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--warning)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>⚠️ SEO Issues</span>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      {report.seo_issues?.map((i, idx) => <li key={idx}>{i}</li>)}
                    </ul>
                  </div>

                  <div className="section-box" style={{ margin: 0, borderTop: '2px solid var(--info)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--info)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>🔍 Missing Information</span>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      {report.missing_information?.map((m, idx) => <li key={idx}>{m}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sidebar and Action Recommendations Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
                
                {/* Original Content Evaluation Gaps Card */}
                <div className="card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--info)' }}>🔧 Recommendations</h3>
                    </div>
                    {!improving && (
                      <button
                        onClick={handleImproveArticle}
                        className="btn btn-primary"
                        style={{ background: 'var(--success)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        ✨ Improve Article
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Title Analysis</h4>
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>{report.title_analysis}</p>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Search Intent</h4>
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>{report.search_intent_match}</p>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Missing Keywords</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {report.missing_keywords.map((kw, idx) => (
                          <span key={idx} className="badge badge-warning" style={{ textTransform: 'none', padding: '4px 8px', fontSize: '0.8rem' }}>{kw}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Recommended Headings</h4>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        {report.recommended_headings.map((heading, idx) => <li key={idx} style={{ marginBottom: '4px' }}>H2: {heading}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* AI Optimized Version Section */}
                {improving && (
                  <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px', marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--success)' }}>🤖 AI Optimized Version</h3>
                      {(pipelineStatus === 'Running' || pipelineStatus === 'Pending') && (
                        <button
                          onClick={handleStopImprovement}
                          disabled={stopping}
                          className="btn"
                          style={{ background: 'var(--error)', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', boxShadow: 'none' }}
                        >
                          {stopping ? 'Stopping...' : 'Stop'}
                        </button>
                      )}
                    </div>

                    {/* Progress tracking */}
                    {(pipelineStatus === 'Running' || pipelineStatus === 'Pending' || pipelineStatus === 'Cancelled') && (
                      <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                        {pipelineStatus === 'Cancelled' ? (
                          <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.9rem' }}>⊘ Generation cancelled by user.</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>● Generation progress:</span>
                            {['research', 'writer', 'fact-check', 'style'].map(st => {
                              const sInfo = getStageStatus(st);
                              let col = 'var(--gray-muted)';
                              if (sInfo.status === 'completed') col = 'var(--success)';
                              if (sInfo.status === 'warning') col = 'var(--warning)';
                              if (sInfo.status === 'failed') col = 'var(--error)';
                              if (sInfo.status === 'running') col = 'var(--primary)';
                              return <span key={st} style={{ color: col }}>{sInfo.text || `○ ${st}`}</span>;
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {optimizedDraft ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <h4 style={{ fontSize: '1.15rem', color: 'var(--success)', fontWeight: 800 }}>{optimizedDraft.title}</h4>
                          <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--gray-muted)', marginTop: '6px' }}>{optimizedDraft.introduction}</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {optimizedDraft.sections?.map((sec: any, idx: number) => (
                            <div key={idx} className="section-box" style={{ margin: 0, padding: '10px 14px', background: 'rgba(255,255,255,0.01)' }}>
                              <h5 style={{ color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>{sec.heading}</h5>
                              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--foreground)', marginTop: '4px' }}>{sec.content}</p>
                            </div>
                          ))}
                        </div>

                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{optimizedDraft.conclusion}</p>

                        {/* Reading Time displays */}
                        {readingTime && (
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginTop: '10px',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            textAlign: 'center'
                          }}>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--gray-muted)', display: 'block' }}>Word Count</span>
                              <strong style={{ fontSize: '0.95rem' }}>{readingTime.word_count} words</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--gray-muted)', display: 'block' }}>Reading Time</span>
                              <strong style={{ fontSize: '0.95rem' }}>{readingTime.reading_time_minutes}m {readingTime.reading_time_seconds}s</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      pipelineStatus !== 'Cancelled' && (
                        <p style={{ fontStyle: 'italic', color: 'var(--gray-muted)', fontSize: '0.9rem' }}>
                          Waiting for writing agent to generate improved content...
                        </p>
                      )
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OptimizePage() {
  return (
    <Suspense fallback={
      <div className="container loader-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    }>
      <OptimizePageContent />
    </Suspense>
  );
}
