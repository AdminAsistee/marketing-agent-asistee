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

  // Basic Settings States
  const [primaryTone, setPrimaryTone] = useState('Professional');
  const [secondaryTone, setSecondaryTone] = useState('');
  const [audienceType, setAudienceType] = useState('General audience');
  const [customAudience, setCustomAudience] = useState('');
  const [domainIndustry, setDomainIndustry] = useState('');
  const [customDomainIndustry, setCustomDomainIndustry] = useState('');
  const [contentIntent, setContentIntent] = useState('Inform readers');

  // Advanced Settings States
  const [formalityLevel, setFormalityLevel] = useState(3); // Default 3 (Balanced)
  const [paragraphStyle, setParagraphStyle] = useState<'Short' | 'Long' | 'Balanced'>('Balanced');
  const [allowBullets, setAllowBullets] = useState(true);
  const [allowNumberedLists, setAllowNumberedLists] = useState(true);
  const [allowTables, setAllowTables] = useState(true);
  const [allowHeadings, setAllowHeadings] = useState(true);
  const [allowExamples, setAllowExamples] = useState(true);
  const [lengthSlider, setLengthSlider] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [customWordCount, setCustomWordCount] = useState<string>('');

  // Expand/collapse states for sections
  const [showBasicSettings, setShowBasicSettings] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Dynamic document title update
  useEffect(() => {
    if (seoRecs?.keyword) {
      document.title = `Generate Article: ${seoRecs.keyword}`;
    } else {
      document.title = `Generate Article`;
    }
  }, [seoRecs]);

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
      const writingConfiguration = {
        primaryTone,
        secondaryTone: secondaryTone || undefined,
        audienceType,
        customAudience: customAudience || undefined,
        formalityLevel,
        domainIndustry: domainIndustry || undefined,
        customDomainIndustry: customDomainIndustry || undefined,
        contentIntent,
        paragraphStyle,
        allowBullets,
        allowNumberedLists,
        allowTables,
        allowHeadings,
        allowExamples,
        lengthSlider,
        customWordCount: customWordCount ? parseInt(customWordCount) : undefined
      };

      const response = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prd, 
          seoRecommendations: seoRecs?.recommendations,
          writingConfiguration
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
        <h1 className="title-gradient">The Editorial Engine</h1>
        <p className="subtitle">A facts-grounded, multi-agent content platform built for quality, clarity, and strategic impact.</p>
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

          {/* Content Customization Layer */}
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--card-border)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', color: 'var(--primary)' }}>✍️ Content Customization</h3>
            
            {/* Basic Settings Collapsible */}
            <div className="card" style={{ background: 'rgba(255, 255, 255, 0.01)', margin: '0 0 16px 0', border: '1px solid var(--card-border)' }}>
              <div 
                onClick={() => setShowBasicSettings(!showBasicSettings)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '12px 16px' }}
              >
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>⚙️ Basic Writing Settings</h4>
                <span style={{ fontSize: '0.9rem', color: 'var(--gray-muted)' }}>{showBasicSettings ? '▲ Collapse' : '▼ Expand'}</span>
              </div>
              
              {showBasicSettings && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    
                    {/* Audience Dropdown */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Target Audience</label>
                      <select 
                        value={audienceType} 
                        onChange={(e) => setAudienceType(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px' }}
                      >
                        <option value="General audience">General audience</option>
                        <option value="Beginners">Beginners</option>
                        <option value="Experts">Experts</option>
                        <option value="Customers">Customers</option>
                        <option value="Investors">Investors</option>
                        <option value="Business executives">Business executives</option>
                        <option value="Students">Students</option>
                        <option value="Technical users">Technical users</option>
                        <option value="Other">Other (Specify below)</option>
                      </select>
                    </div>

                    {/* Content Intent Dropdown */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Content Intent (Goal)</label>
                      <select 
                        value={contentIntent} 
                        onChange={(e) => setContentIntent(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px' }}
                      >
                        <option value="Inform readers">Inform readers</option>
                        <option value="Rank on Google">Rank on Google</option>
                        <option value="Generate leads">Generate leads</option>
                        <option value="Sell a product">Sell a product</option>
                        <option value="Explain a concept">Explain a concept</option>
                        <option value="Build authority">Build authority</option>
                        <option value="Compare options">Compare options</option>
                        <option value="Announce news">Announce news</option>
                      </select>
                    </div>

                    {/* Domain Industry Dropdown */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Industry / Domain</label>
                      <select 
                        value={domainIndustry} 
                        onChange={(e) => setDomainIndustry(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px' }}
                      >
                        <option value="">Select industry (optional)</option>
                        <option value="Finance">Finance</option>
                        <option value="Technology">Technology</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Food">Food</option>
                        <option value="Ecommerce">Ecommerce</option>
                        <option value="Education">Education</option>
                        <option value="Gaming">Gaming</option>
                        <option value="Trading cards">Trading cards</option>
                        <option value="Other">Other (Specify below)</option>
                      </select>
                    </div>

                  </div>

                  {/* Custom Audience Text Input */}
                  {(audienceType === 'Other' || audienceType === 'General audience' || audienceType === 'Beginners') && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Custom Audience Details / Profile</label>
                      <input 
                        type="text" 
                        placeholder="e.g. First-time Pokemon card collectors"
                        value={customAudience}
                        onChange={(e) => setCustomAudience(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem' }}
                      />
                    </div>
                  )}

                  {/* Custom Domain/Industry Input */}
                  {domainIndustry === 'Other' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Specify Custom Industry/Domain</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Specialty Coffee Brewing"
                        value={customDomainIndustry}
                        onChange={(e) => setCustomDomainIndustry(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem' }}
                      />
                    </div>
                  )}

                  {/* Tones (Primary & Secondary) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Primary Tone</label>
                      <select 
                        value={primaryTone} 
                        onChange={(e) => setPrimaryTone(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px' }}
                      >
                        <option value="Professional">Professional</option>
                        <option value="Friendly">Friendly</option>
                        <option value="Conversational">Conversational</option>
                        <option value="Educational">Educational</option>
                        <option value="Authoritative">Authoritative</option>
                        <option value="Casual">Casual</option>
                        <option value="Persuasive">Persuasive</option>
                        <option value="Storytelling">Storytelling</option>
                        <option value="Technical">Technical</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Secondary Tone (Optional)</label>
                      <select 
                        value={secondaryTone} 
                        onChange={(e) => setSecondaryTone(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px' }}
                      >
                        <option value="">(None)</option>
                        <option value="Professional">Professional</option>
                        <option value="Friendly">Friendly</option>
                        <option value="Conversational">Conversational</option>
                        <option value="Educational">Educational</option>
                        <option value="Authoritative">Authoritative</option>
                        <option value="Casual">Casual</option>
                        <option value="Persuasive">Persuasive</option>
                        <option value="Storytelling">Storytelling</option>
                        <option value="Technical">Technical</option>
                      </select>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Advanced Settings Collapsible */}
            <div className="card" style={{ background: 'rgba(255, 255, 255, 0.01)', margin: '0 0 24px 0', border: '1px solid var(--card-border)' }}>
              <div 
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '12px 16px' }}
              >
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🛠️ Advanced Style & Structure</h4>
                <span style={{ fontSize: '0.9rem', color: 'var(--gray-muted)' }}>{showAdvancedSettings ? '▲ Collapse' : '▼ Expand'}</span>
              </div>

              {showAdvancedSettings && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Formality Level Slider */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Formality Level</label>
                      <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
                        {formalityLevel === 1 ? 'Very casual (1/5)' : (formalityLevel === 2 ? 'Casual (2/5)' : (formalityLevel === 3 ? 'Balanced (3/5)' : (formalityLevel === 4 ? 'Professional (4/5)' : 'Highly formal (5/5)')))}
                      </strong>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      step="1"
                      value={formalityLevel}
                      onChange={(e) => setFormalityLevel(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--gray-muted)', marginTop: '4px' }}>
                      <span>Informal</span>
                      <span>Balanced</span>
                      <span>Formal</span>
                    </div>
                  </div>

                  {/* Paragraph Style Selector */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>Paragraph Structure Style</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      {[
                        { key: 'Short', label: 'Short paragraphs', desc: 'Mobile-friendly writing with frequent breaks.' },
                        { key: 'Balanced', label: 'Balanced', desc: 'Combination of readability and depth.' },
                        { key: 'Long', label: 'Long-form paragraphs', desc: 'More traditional article style.' }
                      ].map((item) => (
                        <div 
                          key={item.key}
                          onClick={() => setParagraphStyle(item.key as any)}
                          style={{
                            background: paragraphStyle === item.key ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0, 0, 0, 0.15)',
                            border: paragraphStyle === item.key ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                            borderRadius: '8px',
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <strong style={{ fontSize: '0.85rem', display: 'block', color: paragraphStyle === item.key ? 'var(--primary)' : 'var(--foreground)' }}>
                            {item.label}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-muted)', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                            {item.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Formatting Preferences Checklist */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>Allowed Formatting Elements</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                      {[
                        { state: allowBullets, setter: setAllowBullets, label: 'Bullet points' },
                        { state: allowNumberedLists, setter: setAllowNumberedLists, label: 'Numbered lists' },
                        { state: allowTables, setter: setAllowTables, label: 'Tables' },
                        { state: allowHeadings, setter: setAllowHeadings, label: 'Headings (H2/H3)' },
                        { state: allowExamples, setter: setAllowExamples, label: 'Concrete examples' }
                      ].map((pref, pIdx) => (
                        <label 
                          key={pIdx} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--card-border)',
                            margin: 0
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={pref.state} 
                            onChange={(e) => pref.setter(e.target.checked)}
                            style={{ accentColor: 'var(--primary)', margin: 0 }}
                          />
                          <span>{pref.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Article Length Controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '20px', alignItems: 'start' }}>
                    
                    {/* Length Slider */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Target Article Length</label>
                        <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
                          {lengthSlider === 'Short' ? 'Short (500-800 words)' : (lengthSlider === 'Long' ? 'Long (2000+ words)' : 'Medium (1000-1500 words)')}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['Short', 'Medium', 'Long'].map((lVal) => (
                          <button
                            key={lVal}
                            type="button"
                            onClick={() => setLengthSlider(lVal as any)}
                            style={{
                              flex: 1,
                              background: lengthSlider === lVal && !customWordCount ? 'var(--primary)' : 'rgba(0,0,0,0.15)',
                              border: '1px solid var(--card-border)',
                              color: '#fff',
                              padding: '8px 0',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              opacity: customWordCount ? 0.4 : 1
                            }}
                            disabled={!!customWordCount}
                          >
                            {lVal}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Word Count */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Custom Word Count</label>
                      <input 
                        type="number" 
                        min="100"
                        step="50"
                        placeholder="e.g. 1200 words"
                        value={customWordCount}
                        onChange={(e) => setCustomWordCount(e.target.value)}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem' }}
                      />
                      {customWordCount && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                          ✓ Overriding slider length
                        </span>
                      )}
                    </div>

                  </div>

                </div>
              )}
            </div>

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
