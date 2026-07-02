'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getOrCreateUserId } from '@/lib/user';

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

  const [resultsTab, setResultsTab] = useState<'audit' | 'pipeline'>('audit');
  const [viewMode, setViewMode] = useState<'timeline' | 'tabs'>('tabs');
  const [activeTabId, setActiveTabId] = useState<string>('final-product');

  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');

  // Load from runId query param or localStorage if present
  useEffect(() => {
    const savedRunId = typeof window !== 'undefined' ? localStorage.getItem('active_optimization_run_id') : null;
    const targetRunId = runId || savedRunId;

    if (!targetRunId) return;

    if (!runId && savedRunId) {
      router.replace(`/optimize?runId=${savedRunId}`);
      return;
    }

    setLoading(true);
    setError(null);
    setTrendData(null);
    setReport(null);
    setCurrentRunId(targetRunId);

    fetch(`/api/logs?runId=${targetRunId}`)
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
          setResultsTab('pipeline');
          
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
  }, [runId, router]);

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

          const statusLogs = logList.filter((l: any) => l.agent_name === 'pipeline_status');
          const statusLog = statusLogs.length > 0 ? statusLogs[statusLogs.length - 1] : null;
          if (statusLog) {
            const out = typeof statusLog.output === 'string' ? JSON.parse(statusLog.output) : statusLog.output;
            setPipelineStatus(out.status);

            if (out.status === 'Completed' || out.status === 'Failed' || out.status === 'Cancelled') {
              // Notify history subscribers in other tabs!
              const channel = new BroadcastChannel('content_agent_history');
              channel.postMessage({ type: 'history_updated' });
              channel.close();

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

    fetchLogs(); // Fetch immediately
    const intervalId = setInterval(fetchLogs, 1500);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [improving, currentRunId, pipelineStatus]);

  // Dynamic document title update
  useEffect(() => {
    if (targetKeyword.trim()) {
      document.title = `Optimize Existing Article: ${targetKeyword.trim()}`;
    } else {
      document.title = `Optimize Existing Article`;
    }
  }, [targetKeyword]);

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
      const userId = getOrCreateUserId();
      const response = await fetch('/api/articles/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ article, websiteContext, targetKeyword, userId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.run_id) {
        throw new Error('Failed to receive a valid optimization run ID from the server.');
      }
      setTrendData(data.trendData);
      setReport(data.report);
      setCurrentRunId(data.run_id);
      localStorage.setItem('active_optimization_run_id', data.run_id);

      // Notify history subscribers in other tabs!
      const channel = new BroadcastChannel('content_agent_history');
      channel.postMessage({ type: 'history_updated' });
      channel.close();
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
      const userId = getOrCreateUserId();
      const response = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prd: customPrd,
          seoRecommendations,
          runId: currentRunId,
          userId
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      // Notify history subscribers in other tabs!
      const channel = new BroadcastChannel('content_agent_history');
      channel.postMessage({ type: 'history_updated' });
      channel.close();
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
        // Notify history subscribers in other tabs!
        const channel = new BroadcastChannel('content_agent_history');
        channel.postMessage({ type: 'history_updated' });
        channel.close();
      }
    } catch (err) {
      console.error('Failed to cancel pipeline:', err);
    } finally {
      setStopping(false);
    }
  };

  const handleStartNewOptimization = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('active_optimization_run_id');
    }
    router.replace('/optimize');

    setArticle('');
    setTargetKeyword('');
    setWebsiteContext('');
    setTrendData(null);
    setReport(null);
    setCurrentRunId(null);
    setImprovementLogs([]);
    setPipelineStatus('Pending');
    setOptimizedDraft(null);
    setImproving(false);
    setResultsTab('audit');
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

  const parsePayload = (val: unknown): Record<string, any> => {
    if (!val) return {};
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return { raw: val };
      }
    }
    if (val && typeof val === 'object') {
      return val as Record<string, unknown>;
    }
    return {};
  };

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
        {currentRunId && (
          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleStartNewOptimization}
              className="btn"
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                background: 'transparent',
                border: '1px solid var(--card-border)',
                color: 'var(--foreground)',
                cursor: 'pointer'
              }}
            >
              🔄 Start New Optimization
            </button>
          </div>
        )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '30px' }} className="optimize-results-container">
              
              {/* Tab Navigation at the top of Results */}
              <div className="tab-navigation" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                <button
                  type="button"
                  className={`tab-btn ${resultsTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setResultsTab('audit')}
                  style={{
                    background: resultsTab === 'audit' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.02)',
                    color: '#fff',
                    border: '1px solid var(--card-border)',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}
                >
                  📊 SEO Audit & Recommendations
                </button>
                {(improving || pipelineStatus !== 'Pending') && (
                  <button
                    type="button"
                    className={`tab-btn ${resultsTab === 'pipeline' ? 'active' : ''}`}
                    onClick={() => setResultsTab('pipeline')}
                    style={{
                      background: resultsTab === 'pipeline' ? 'var(--success)' : 'rgba(255, 255, 255, 0.02)',
                      color: '#fff',
                      border: '1px solid var(--card-border)',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}
                  >
                    🤖 AI Writer Generation Pipeline {pipelineStatus === 'Running' ? '●' : ''}
                  </button>
                )}
              </div>

              {resultsTab === 'audit' ? (
                /* Tab 1: SEO Audit Report */
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
                            type="button"
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
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--gray-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>
                            Missing Keywords Priority List
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {report.missing_keywords && report.missing_keywords.length > 0 ? (
                              report.missing_keywords.map((kwObj: any, idx) => {
                                const isObj = kwObj && typeof kwObj === 'object';
                                const kwText = isObj ? kwObj.keyword : kwObj;
                                const growth = isObj ? kwObj.trendGrowth : '+120%';
                                const priority = isObj ? kwObj.priority : 'Medium';
                                
                                const badgeClass = priority === 'High' 
                                  ? 'badge-error' 
                                  : (priority === 'Medium' ? 'badge-warning' : 'badge-info');

                                return (
                                  <div key={idx} style={{
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid var(--card-border)',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.85rem'
                                  }}>
                                    <span>{idx + 1}. <strong>{kwText}</strong></span>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)' }}>{growth}</span>
                                      <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem', padding: '2px 6px', textTransform: 'uppercase', fontWeight: 800 }}>
                                        {priority}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <span style={{ color: 'var(--gray-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>No missing keywords identified.</span>
                            )}
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
                  </div>
                </div>
              ) : (
                /* Tab 2: AI Writer Generation Pipeline (Mirrors the Timeline layout!) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Inline stylesheet for print layout */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                      header, nav, .navbar, .header, .flow-status-banner, .tabs-sidebar, .final-evaluation-card, .export-actions, .timeline-card, .card, .container > *:not(.tabs-layout), .optimize-results-container > *:not(.tab-panel) {
                        display: none !important;
                      }
                      .container {
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                      }
                      .tabs-layout {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                      }
                      .tab-panel {
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                      }
                      .final-product-grid {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                      }
                      .final-article-card {
                        width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: transparent !important;
                      }
                      .final-article-card * {
                        color: #000000 !important;
                      }
                      .final-article-card .btn, .final-article-card .export-actions, .export-actions {
                        display: none !important;
                      }
                    }
                  `}} />

                  {/* Top Status Banner */}
                  {(() => {
                    const getGenerationStatus = (): 'idle' | 'running' | 'completed' | 'cancelled' | 'failed' => {
                      if (pipelineStatus === 'Pending' || pipelineStatus === 'Running') return 'running';
                      if (pipelineStatus === 'Completed') return 'completed';
                      if (pipelineStatus === 'Cancelled') return 'cancelled';
                      if (pipelineStatus === 'Failed') return 'failed';
                      return 'idle';
                    };
                    const generationStatus = getGenerationStatus();

                    if (generationStatus === 'running') {
                      return (
                        <div className="flow-status-banner info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                          <span>● Pipeline executing in real-time...</span>
                          <button
                            type="button"
                            onClick={handleStopImprovement}
                            disabled={stopping}
                            className="btn"
                            style={{ background: 'var(--error)', color: '#fff', border: 'none', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', boxShadow: 'none' }}
                          >
                            {stopping ? 'Stopping...' : 'Stop Generation'}
                          </button>
                        </div>
                      );
                    }
                    if (generationStatus === 'cancelled') {
                      return (
                        <div className="flow-status-banner error" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          ⊘ Generation cancelled by user.
                        </div>
                      );
                    }
                    if (generationStatus === 'failed') {
                      return (
                        <div className="flow-status-banner error" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          ⚠️ Generation failed. Please check the logs.
                        </div>
                      );
                    }
                    return (
                      <div className="flow-status-banner success">
                        ✨ Successful Flow: The article was successfully optimized and polished.
                      </div>
                    );
                  })()}

                  {/* Sequential Progress Timeline Card */}
                  {(() => {
                    const steps = [
                      { label: 'Analysis', key: 'analysis' },
                      { label: 'Recommendations', key: 'recs' },
                      { label: 'Optimization', key: 'optimization' },
                      { label: 'Quality Check', key: 'quality' },
                      { label: 'Complete', key: 'complete' }
                    ];

                    const mappedSteps = steps.map((step) => {
                      if (step.key === 'analysis') {
                        return {
                          label: step.label,
                          status: report ? 'completed' : (loading ? 'running' : 'pending')
                        };
                      }
                      if (step.key === 'recs') {
                        return {
                          label: step.label,
                          status: report ? 'completed' : 'pending'
                        };
                      }
                      if (step.key === 'optimization') {
                        if (!improving) return { label: step.label, status: 'pending' };
                        const hasWriter = improvementLogs.some(l => l.agent_name.startsWith('writer_agent_attempt'));
                        const hasStyle = improvementLogs.some(l => l.agent_name === 'style-polisher');
                        if (hasStyle) return { label: step.label, status: 'completed' };
                        if (hasWriter) return { label: step.label, status: 'running' };
                        return { label: step.label, status: 'running' }; // starting
                      }
                      if (step.key === 'quality') {
                        if (!improving) return { label: step.label, status: 'pending' };
                        const hasFactChecker = improvementLogs.some(l => l.agent_name.startsWith('fact_checker_attempt'));
                        const isFinished = pipelineStatus === 'Completed' || pipelineStatus === 'Failed' || pipelineStatus === 'Cancelled';
                        if (isFinished) return { label: step.label, status: 'completed' };
                        if (hasFactChecker) return { label: step.label, status: 'running' };
                        return { label: step.label, status: 'pending' };
                      }
                      if (step.key === 'complete') {
                        return {
                          label: step.label,
                          status: pipelineStatus === 'Completed' ? 'completed' : 'pending'
                        };
                      }
                      return { label: step.label, status: 'pending' };
                    });

                    const isFullyCompleted = pipelineStatus === 'Completed';
                    const finalSteps = mappedSteps.map(step => ({
                      ...step,
                      status: isFullyCompleted ? 'completed' : step.status
                    }));

                    return (
                      <div className="card" style={{ margin: 0, padding: '20px 24px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                          Pipeline Progress
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                          {finalSteps.map((step, idx) => {
                            let circleColor = 'var(--card-border)';
                            let textColor = 'var(--gray-muted)';
                            let isPulse = false;

                            if (step.status === 'completed') {
                              circleColor = 'var(--success)';
                              textColor = 'var(--success)';
                            } else if (step.status === 'running') {
                              circleColor = 'var(--primary)';
                              textColor = 'var(--primary)';
                              isPulse = true;
                            } else if (step.status === 'failed') {
                              circleColor = 'var(--error)';
                              textColor = 'var(--error)';
                            }

                            return (
                              <React.Fragment key={idx}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: circleColor,
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s ease',
                                    boxShadow: isPulse ? '0 0 6px var(--primary)' : 'none',
                                    animation: isPulse ? 'pulse 1.5s infinite' : 'none'
                                  }}>
                                    {step.status === 'completed' ? '✓' : idx + 1}
                                  </span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: textColor, transition: 'all 0.3s ease' }}>
                                    {step.label}
                                  </span>
                                </div>
                                {idx < finalSteps.length - 1 && (
                                  <div style={{
                                    flex: '1',
                                    height: '2px',
                                    background: step.status === 'completed' ? 'var(--success)' : 'var(--card-border)',
                                    margin: '0 8px',
                                    minWidth: '15px',
                                    alignSelf: 'center',
                                    transition: 'all 0.3s ease'
                                  }} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <style dangerouslySetInnerHTML={{ __html: `
                          @keyframes pulse {
                            0% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.1); opacity: 0.8; }
                            100% { transform: scale(1); opacity: 1; }
                          }
                        `}} />
                      </div>
                    );
                  })()}

                  {/* View Mode Toggle Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '10px' }}>
                    <div style={{
                      display: 'inline-flex',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--card-border)',
                      padding: '4px',
                      borderRadius: '8px',
                      gap: '4px'
                    }}>
                      <button
                        type="button"
                        onClick={() => setViewMode('tabs')}
                        style={{
                          background: viewMode === 'tabs' ? 'var(--primary)' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}
                      >
                        🏆 Tabbed Step-by-Step
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('timeline')}
                        style={{
                          background: viewMode === 'timeline' ? 'var(--primary)' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}
                      >
                        📜 Continuous Timeline
                      </button>
                    </div>
                  </div>

                  {/* Timeline/Tabbed Details logs view */}
                  {(() => {
                    const filterLogs = improvementLogs.filter(l => l.agent_name !== 'pipeline_status');
                    const stylePolisherLog = filterLogs.find((l) => l.agent_name === 'style-polisher');
                    const rubricGraderLog = filterLogs.find((l) => l.agent_name === 'rubric-grader');

                    let finalArticlePayload: Record<string, any> | null = null;
                    if (stylePolisherLog && stylePolisherLog.output) {
                      const parsedOut = parsePayload(stylePolisherLog.output);
                      const polished = (parsedOut.polishedDraft || (parsedOut.title ? parsedOut : null)) as Record<string, any> | undefined;
                      if (polished) {
                        finalArticlePayload = polished;
                      }
                    }
                    if (!finalArticlePayload) {
                      const writerLogs = filterLogs.filter(
                        (l) => l.agent_name.startsWith('writer_agent_attempt') || l.agent_name.startsWith('writer_agent_revision')
                      );
                      if (writerLogs.length > 0) {
                        const lastWriter = writerLogs[writerLogs.length - 1];
                        finalArticlePayload = parsePayload(lastWriter.output);
                      }
                    }

                    let rubricPayload: Record<string, any> | null = null;
                    if (rubricGraderLog && rubricGraderLog.output) {
                      rubricPayload = parsePayload(rubricGraderLog.output);
                    }

                    const readingTimeStats = getReadingTime(finalArticlePayload);

                    if (viewMode === 'tabs') {
                      return (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '240px 1fr',
                          gap: '24px',
                          alignItems: 'start'
                        }} className="tabs-layout">
                          
                          {/* Sidebar navigation */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '12px',
                            padding: '12px'
                          }} className="tabs-sidebar">
                            <button
                              type="button"
                              onClick={() => setActiveTabId('final-product')}
                              style={{
                                background: activeTabId === 'final-product' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                border: activeTabId === 'final-product' ? '1px solid var(--primary)' : '1px solid transparent',
                                color: activeTabId === 'final-product' ? 'var(--primary)' : 'var(--gray-muted)',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}
                            >
                              🏆 Final Product & Grade
                            </button>
                            {filterLogs.map((log, idx) => {
                              const output = parsePayload(log.output);
                              const config = getAgentConfig(log.agent_name, output);
                              return (
                                <button
                                  key={log.id}
                                  type="button"
                                  onClick={() => setActiveTabId(log.id)}
                                  style={{
                                    background: activeTabId === log.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    border: activeTabId === log.id ? '1px solid var(--primary)' : '1px solid transparent',
                                    color: activeTabId === log.id ? 'var(--primary)' : 'var(--gray-muted)',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  {`${idx + 1}. ${config.title}`}
                                </button>
                              );
                            })}
                          </div>

                          {/* Tab Content Panel */}
                          <div className="tab-panel">
                            {activeTabId === 'final-product' ? (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 300px',
                                gap: '24px',
                                alignItems: 'start'
                              }} className="final-product-grid">
                                
                                {/* Left: Polished Article Card */}
                                <div className="card final-article-card" style={{ margin: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }} className="export-actions">
                                    <div>
                                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--success)' }}>🤖 AI Optimized Version</h3>
                                      <p style={{ color: 'var(--gray-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Final fact-checked and polished output.</p>
                                    </div>
                                    {finalArticlePayload && (
                                      <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="btn btn-primary"
                                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                      >
                                        📄 Export to PDF
                                      </button>
                                    )}
                                  </div>

                                  {finalArticlePayload ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                      <div>
                                        <h4 style={{ fontSize: '1.25rem', color: 'var(--success)', fontWeight: 800 }}>{finalArticlePayload.title}</h4>
                                        {readingTimeStats && (
                                          <div style={{
                                            color: 'var(--gray-muted)',
                                            fontSize: '0.8rem',
                                            marginTop: '6px',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            gap: '12px',
                                            flexWrap: 'wrap',
                                            fontFamily: 'var(--font-mono)'
                                          }}>
                                            <span>{readingTimeStats.word_count} words</span>
                                            <span>•</span>
                                            <span>{readingTimeStats.reading_time_minutes} min read</span>
                                            <span>•</span>
                                            <span>Average reading speed: 225 wpm</span>
                                          </div>
                                        )}

                                        {/* Writing Style Preferences Metadata */}
                                        {(() => {
                                          const statusLog = improvementLogs.find(l => l.agent_name === 'pipeline_status');
                                          const inputPayload = statusLog ? parsePayload(statusLog.input) : null;
                                          const writingConfig = inputPayload?.writingConfiguration as any;
                                          if (!writingConfig) return null;
                                          return (
                                            <div style={{
                                              background: 'rgba(255, 255, 255, 0.02)',
                                              border: '1px solid var(--card-border)',
                                              borderRadius: '8px',
                                              padding: '10px 14px',
                                              marginBottom: '16px',
                                              display: 'flex',
                                              flexWrap: 'wrap',
                                              gap: '14px',
                                              fontSize: '0.85rem'
                                            }} className="writing-preferences-metadata">
                                              <div>
                                                <span style={{ color: 'var(--gray-muted)' }}>Audience:</span>{' '}
                                                <strong>{writingConfig.audienceType === 'Other' ? writingConfig.customAudience : writingConfig.audienceType}</strong>
                                              </div>
                                              <div>
                                                <span style={{ color: 'var(--gray-muted)' }}>Tone:</span>{' '}
                                                <strong>{writingConfig.primaryTone}{writingConfig.secondaryTone ? ` + ${writingConfig.secondaryTone}` : ''}</strong>
                                              </div>
                                              <div>
                                                <span style={{ color: 'var(--gray-muted)' }}>Length:</span>{' '}
                                                <strong>{writingConfig.customWordCount ? `${writingConfig.customWordCount} words` : `${writingConfig.lengthSlider}`}</strong>
                                              </div>
                                              <div>
                                                <span style={{ color: 'var(--gray-muted)' }}>Intent:</span>{' '}
                                                <strong>{writingConfig.contentIntent}</strong>
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--gray-muted)', marginTop: '6px' }}>{finalArticlePayload.introduction}</p>
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {finalArticlePayload.sections?.map((sec: any, idx: number) => (
                                          <div key={idx} className="section-box" style={{ margin: 0, padding: '10px 14px', background: 'rgba(255,255,255,0.01)' }}>
                                            <h5 style={{ color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 700 }}>{sec.heading}</h5>
                                            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--foreground)', marginTop: '4px' }}>{sec.content}</p>
                                          </div>
                                        ))}
                                      </div>

                                      <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{finalArticlePayload.conclusion}</p>
                                    </div>
                                  ) : (
                                    pipelineStatus !== 'Cancelled' && pipelineStatus !== 'Failed' && (
                                      <p style={{ fontStyle: 'italic', color: 'var(--gray-muted)', fontSize: '0.85rem' }}>
                                        Waiting for writing agent to generate content...
                                      </p>
                                    )
                                  )}
                                </div>

                                {/* Right: Rubric Grade Card */}
                                <div className="card final-evaluation-card" style={{ margin: 0 }}>
                                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--info)' }}>📊 Final Evaluation</h3>
                                  <p style={{ color: 'var(--gray-muted)', fontSize: '0.8rem', margin: '4px 0 16px 0' }}>Quality grading feedback from the Grader Agent.</p>

                                  {rubricPayload ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className="section-box" style={{ textAlign: 'center', margin: 0, padding: '8px 0', borderTop: '2px solid var(--primary)' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--gray-muted)', display: 'block' }}>Clarity</span>
                                          <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{String(rubricPayload.clarity || '0')}/5</strong>
                                        </div>
                                        <div className="section-box" style={{ textAlign: 'center', margin: 0, padding: '8px 0', borderTop: '2px solid var(--success)' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--gray-muted)', display: 'block' }}>Accuracy</span>
                                          <strong style={{ fontSize: '1.25rem', color: 'var(--success)' }}>{String(rubricPayload.accuracy || '0')}/5</strong>
                                        </div>
                                        <div className="section-box" style={{ textAlign: 'center', margin: 0, padding: '8px 0', borderTop: '2px solid var(--warning)' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--gray-muted)', display: 'block' }}>Completeness</span>
                                          <strong style={{ fontSize: '1.25rem', color: 'var(--warning)' }}>{String(rubricPayload.completeness || '0')}/5</strong>
                                        </div>
                                        <div className="section-box" style={{ textAlign: 'center', margin: 0, padding: '8px 0', borderTop: '2px solid var(--info)', background: 'rgba(99,102,241,0.05)' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--gray-muted)', display: 'block' }}>Overall</span>
                                          <strong style={{ fontSize: '1.25rem', color: 'var(--info)' }}>{String(rubricPayload.overall_score || '0')}/5</strong>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-muted)', textTransform: 'uppercase' }}>Grader Feedback</span>
                                        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--foreground)', marginTop: '4px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', lineHeight: '1.5' }}>
                                          {String(rubricPayload.feedback || '')}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <p style={{ fontStyle: 'italic', color: 'var(--gray-muted)', fontSize: '0.85rem' }}>Evaluation not available yet.</p>
                                  )}
                                </div>

                              </div>
                            ) : (
                              /* Specific Agent Tab Logs */
                              filterLogs.filter(l => l.id === activeTabId).map((log) => {
                                const input = parsePayload(log.input);
                                const output = parsePayload(log.output);
                                const config = getAgentConfig(log.agent_name, output);

                                return (
                                  <div key={log.id} className="card timeline-card" style={{ margin: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px', marginBottom: '14px' }}>
                                      <div>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>{config.title}</span>
                                        <span className={`badge ${config.badge}`} style={{ marginLeft: '8px', fontSize: '0.7rem', padding: '2px 6px' }}>{config.statusText}</span>
                                      </div>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)' }}>⏱️ {log.latency_ms} ms {log.token_count ? `| 🪙 ${log.token_count} tokens` : ''}</span>
                                    </div>

                                    {/* Agent Content renders */}
                                    {log.agent_name === 'research' && !output.error && (
                                      <div>
                                        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.5' }}>{String(output.summary || '')}</p>
                                        {Array.isArray(output.sources) && output.sources.length > 0 && (
                                          <div style={{ marginTop: '12px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Sources</span>
                                            {output.sources.map((src: any, sIdx: number) => (
                                              <a key={sIdx} href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'underline', marginBottom: '4px' }}>
                                                🔗 {src.title || src.url}
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {(log.agent_name.startsWith('writer_agent') || log.agent_name === 'style-polisher') && !output.error && (
                                      <div>
                                        {log.agent_name === 'style-polisher' ? (
                                          (() => {
                                            const polished = output.polishedDraft || (output.title ? output : null);
                                            if (!polished) return null;
                                            return (
                                              <div>
                                                <h4 style={{ color: 'var(--success)', fontWeight: 700 }}>{polished.title}</h4>
                                                <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--gray-muted)' }}>{polished.introduction}</p>
                                                {polished.sections?.map((s: any, sIdx: number) => (
                                                  <div key={sIdx} style={{ marginTop: '10px' }}>
                                                    <h5 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{s.heading}</h5>
                                                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{s.content}</p>
                                                  </div>
                                                ))}
                                                <p style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '10px' }}>{polished.conclusion}</p>
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <div>
                                            <h4 style={{ fontWeight: 700 }}>{output.title}</h4>
                                            <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--gray-muted)' }}>{output.introduction}</p>
                                            {output.sections?.map((s: any, sIdx: number) => (
                                              <div key={sIdx} style={{ marginTop: '10px' }}>
                                                <h5 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{s.heading}</h5>
                                                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{s.content}</p>
                                              </div>
                                            ))}
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '10px' }}>{output.conclusion}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {log.agent_name.startsWith('fact_checker') && !output.error && (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                          <span style={{ fontSize: '0.85rem' }}>Passed Verification:</span>
                                          <span className={`badge ${output.passed ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.75rem' }}>
                                            {output.passed ? 'Yes' : 'No'}
                                          </span>
                                        </div>
                                        {!output.passed && Array.isArray(output.unsupported_claims) && (
                                          <div style={{ marginBottom: '10px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--error)', textTransform: 'uppercase', display: 'block' }}>Claims to Correct</span>
                                            {output.unsupported_claims.map((claim: string, cIdx: number) => (
                                              <div key={cIdx} style={{ padding: '6px', background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid var(--error)', fontSize: '0.8rem', marginTop: '4px' }}>
                                                {claim}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {output.feedback && (
                                          <div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase' }}>Revision Feedback</span>
                                            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
                                              {output.feedback}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {log.agent_name === 'rubric-grader' && !output.error && (
                                      <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--gray-muted)' }}>Clarity</span>
                                            <strong style={{ fontSize: '1.1rem' }}>{output.clarity}/5</strong>
                                          </div>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--gray-muted)' }}>Accuracy</span>
                                            <strong style={{ fontSize: '1.1rem' }}>{output.accuracy}/5</strong>
                                          </div>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--gray-muted)' }}>Completeness</span>
                                            <strong style={{ fontSize: '1.1rem' }}>{output.completeness}/5</strong>
                                          </div>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--gray-muted)' }}>Overall</span>
                                            <strong style={{ fontSize: '1.1rem' }}>{output.overall_score}/5</strong>
                                          </div>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase' }}>Grading Feedback</span>
                                        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
                                          {output.feedback}
                                        </p>
                                      </div>
                                    )}

                                    {/* Raw JSON Accordion */}
                                    <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                                      <details>
                                        <summary style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', cursor: 'pointer' }}>View Raw JSON</summary>
                                        <pre style={{ fontSize: '0.75rem', background: '#0a0a0a', padding: '8px', borderRadius: '4px', overflowX: 'auto', marginTop: '6px' }}>
                                          {JSON.stringify({ input, output }, null, 2)}
                                        </pre>
                                      </details>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      /* Continuous Timeline View */
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {filterLogs.map((log) => {
                            const input = parsePayload(log.input);
                            const output = parsePayload(log.output);
                            const config = getAgentConfig(log.agent_name, output);

                            return (
                              <div key={log.id} className="card timeline-card" style={{ margin: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px', marginBottom: '14px' }}>
                                  <div>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>{config.title}</span>
                                    <span className={`badge ${config.badge}`} style={{ marginLeft: '8px', fontSize: '0.7rem', padding: '2px 6px' }}>{config.statusText}</span>
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)' }}>⏱️ {log.latency_ms} ms {log.token_count ? `| 🪙 ${log.token_count} tokens` : ''}</span>
                                </div>

                                {/* Render logic exact copy */}
                                {log.agent_name === 'research' && !output.error && (
                                  <div>
                                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.5' }}>{String(output.summary || '')}</p>
                                    {Array.isArray(output.sources) && output.sources.length > 0 && (
                                      <div style={{ marginTop: '12px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Sources</span>
                                        {output.sources.map((src: any, sIdx: number) => (
                                          <a key={sIdx} href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'underline', marginBottom: '4px' }}>
                                            🔗 {src.title || src.url}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(log.agent_name.startsWith('writer_agent') || log.agent_name === 'style-polisher') && !output.error && (
                                  <div>
                                    {log.agent_name === 'style-polisher' ? (
                                      (() => {
                                        const polished = output.polishedDraft || (output.title ? output : null);
                                        if (!polished) return null;
                                        return (
                                          <div>
                                            <h4 style={{ color: 'var(--success)', fontWeight: 700 }}>{polished.title}</h4>
                                            <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--gray-muted)' }}>{polished.introduction}</p>
                                            {polished.sections?.map((s: any, sIdx: number) => (
                                              <div key={sIdx} style={{ marginTop: '10px' }}>
                                                <h5 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{s.heading}</h5>
                                                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{s.content}</p>
                                              </div>
                                            ))}
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '10px' }}>{polished.conclusion}</p>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <div>
                                        <h4 style={{ fontWeight: 700 }}>{output.title}</h4>
                                        <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--gray-muted)' }}>{output.introduction}</p>
                                        {output.sections?.map((s: any, sIdx: number) => (
                                          <div key={sIdx} style={{ marginTop: '10px' }}>
                                            <h5 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{s.heading}</h5>
                                            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{s.content}</p>
                                          </div>
                                        ))}
                                        <p style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '10px' }}>{output.conclusion}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {log.agent_name.startsWith('fact_checker') && !output.error && (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                      <span style={{ fontSize: '0.85rem' }}>Passed Verification:</span>
                                      <span className={`badge ${output.passed ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.75rem' }}>
                                        {output.passed ? 'Yes' : 'No'}
                                      </span>
                                    </div>
                                    {!output.passed && Array.isArray(output.unsupported_claims) && (
                                      <div style={{ marginBottom: '10px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--error)', textTransform: 'uppercase', display: 'block' }}>Claims to Correct</span>
                                        {output.unsupported_claims.map((claim: string, cIdx: number) => (
                                          <div key={cIdx} style={{ padding: '6px', background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid var(--error)', fontSize: '0.8rem', marginTop: '4px' }}>
                                            {claim}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {output.feedback && (
                                      <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase' }}>Revision Feedback</span>
                                        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
                                          {output.feedback}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {log.agent_name === 'rubric-grader' && !output.error && (
                                  <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                      <div>
                                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--gray-muted)' }}>Clarity</span>
                                        <strong style={{ fontSize: '1.1rem' }}>{output.clarity}/5</strong>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--gray-muted)' }}>Accuracy</span>
                                        <strong style={{ fontSize: '1.1rem' }}>{output.accuracy}/5</strong>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--gray-muted)' }}>Completeness</span>
                                        <strong style={{ fontSize: '1.1rem' }}>{output.completeness}/5</strong>
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--gray-muted)' }}>Overall</span>
                                        <strong style={{ fontSize: '1.1rem' }}>{output.overall_score}/5</strong>
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', textTransform: 'uppercase' }}>Grading Feedback</span>
                                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
                                      {output.feedback}
                                    </p>
                                  </div>
                                )}

                                {/* Raw JSON Accordion */}
                                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                                  <details>
                                    <summary style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', cursor: 'pointer' }}>View Raw JSON</summary>
                                    <pre style={{ fontSize: '0.75rem', background: '#0a0a0a', padding: '8px', borderRadius: '4px', overflowX: 'auto', marginTop: '6px' }}>
                                      {JSON.stringify({ input, output }, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
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
