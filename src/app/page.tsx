import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'The Editorial Engine: Home',
};

export default function HomePage() {
  const features = [
    {
      title: '📝 Generate Article',
      description: 'Create publication-ready content from scratch using live web research, collaborative drafts, automated fact-checking, and rubric grading.',
      link: '/generate',
      btnText: 'Start Generator',
    },
    {
      title: '⚙️ Optimize Existing Content',
      description: 'Audit your existing drafts against live search interest data, surface keyword gaps, and trigger factuality-grounded AI rewrites.',
      link: '/optimize',
      btnText: 'Audit & Optimize',
    },
    {
      title: '🔍 SEO Intelligence',
      description: 'Analyze keyword search trends and retrieve structural outlines, recommended titles, and secondary search terms before drafting.',
      link: '/seo',
      btnText: 'Explore Trends',
    },
    {
      title: '💡 Originality Analysis',
      description: 'Evaluate content uniqueness, extract untapped angles, and identify local context opportunities to stand out from the competition.',
      link: '/originality',
      btnText: 'Analyze Originality',
    },
    {
      title: '📋 Generation History',
      description: 'Access execution logs, token counts, multi-agent latency metrics, and previous drafts in one integrated timeline.',
      link: '/history',
      btnText: 'View History Logs',
    },
  ];

  return (
    <div className="container">
      <div className="header" style={{ marginBottom: '50px' }}>
        <h1 className="title-gradient" style={{ fontSize: '3rem' }}>The Editorial Engine</h1>
        <p className="subtitle" style={{ fontSize: '1.25rem', maxWidth: '750px', margin: '10px auto 0 auto', lineHeight: '1.6' }}>
          A facts-grounded, multi-agent content platform built for quality, clarity, and strategic impact.
        </p>
      </div>

      <div className="card" style={{ padding: '30px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--card-border)', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px' }}>⚙️ How It Works</h2>
        <p style={{ lineHeight: '1.6', fontSize: '1rem', color: 'var(--foreground)' }}>
          The Editorial Engine orchestrates a collaborative network of specialized AI agents to automate the entire writing and SEO research workflow. It combines <strong>search grounding</strong>, <strong>AI drafting</strong>, <strong>unsupported claim fact-checking</strong>, <strong>brand tone polishing</strong>, and <strong>rubric scoring</strong> into a single, seamless, and controllable publishing lifecycle.
        </p>
      </div>

      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', color: 'var(--foreground)' }}>🚀 Workspace Features</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {features.map((feat, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0, padding: '24px', background: 'var(--card-bg)' }}>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', color: 'var(--foreground)' }}>{feat.title}</h4>
              <p style={{ color: 'var(--gray-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>{feat.description}</p>
            </div>
            <Link href={feat.link} className="btn btn-primary" style={{ width: '100%', padding: '10px 16px', fontSize: '0.9rem', textDecoration: 'none' }}>
              {feat.btnText}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
