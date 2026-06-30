'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SeoRecommendations {
  primaryKeyword: string;
  secondaryKeywords: string[];
  contentIdeas: string[];
  recommendedTitles: string[];
  seoStrategy: string;
}

export default function GeneratePage() {
  const [prd, setPrd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seoRecs, setSeoRecs] = useState<{ keyword: string; recommendations: SeoRecommendations } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('seo_recommendations');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSeoRecs(parsed);
        
        // Prefill PRD if currently empty
        setPrd((prev) => {
          if (prev.trim() === '') {
            const firstTitle = parsed.recommendations.recommendedTitles?.[0] || 'Optimized Blog Article';
            return `# Product Requirement Document (PRD) / Content Spec

## 1. Title Goal
${firstTitle}

## 2. Core Focus
Create a comprehensive and useful marketing blog article targeting the keyword "${parsed.recommendations.primaryKeyword}".

## 3. SEO Instructions
- Primary Keyword: ${parsed.recommendations.primaryKeyword}
- Secondary Keywords: ${parsed.recommendations.secondaryKeywords.join(', ')}
- Content Strategy Focus: ${parsed.recommendations.seoStrategy}

## 4. Key Elements to Discuss
${parsed.recommendations.contentIdeas.map((idea: string) => `- ${idea}`).join('\n')}
`;
          }
          return prev;
        });
      } catch (e) {
        console.error('Failed to parse SEO recommendations from localStorage:', e);
      }
    }
  }, []);

  const handleClearSeo = () => {
    localStorage.removeItem('seo_recommendations');
    setSeoRecs(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prd.trim()) {
      setError('Please enter a Product Requirement Document (PRD) before submitting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prd, 
          seoRecommendations: seoRecs?.recommendations 
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

      router.push(`/timeline/${data.run_id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(err);
      setError(errorMessage || 'An unexpected error occurred during generation.');
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title-gradient">AI Marketing Content Agent</h1>
        <p className="subtitle">Transform your Product Requirements (PRD) into high-quality, fact-checked blog articles.</p>
      </div>

      {loading ? (
        <div className="card loader-container">
          <div className="spinner"></div>
          <p className="loading-text">Pipeline Executing...</p>
          <p className="loading-subtext">
            Running Research Agent (Grounding), Writer Agent, Fact Checker, and Style Polishing.
            This takes about 30-60 seconds.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card">
          {seoRecs && (
            <div style={{
              background: 'var(--success-bg)',
              color: 'var(--success)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.9rem'
            }}>
              <span>
                📈 <strong>SEO Keywords Loaded:</strong> Targeted for keyword "<strong>{seoRecs.recommendations.primaryKeyword}</strong>" (Topic: {seoRecs.keyword}).
              </span>
              <button 
                type="button"
                onClick={handleClearSeo}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--error)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Clear SEO
              </button>
            </div>
          )}

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
            <label className="form-label" htmlFor="prd-input">
              Product Requirement Document (PRD) Content
            </label>
            <textarea
              id="prd-input"
              className="textarea-input"
              value={prd}
              onChange={(e) => setPrd(e.target.value)}
              placeholder="Paste your PRD here..."
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            Start Content Generation Pipeline
          </button>
        </form>
      )}
    </div>
  );
}
