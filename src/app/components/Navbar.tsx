'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Unified premium responsive navigation bar across pages.
 */
export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: '📝 Generate Article', path: '/generate' },
    { name: '🔍 SEO Intelligence', path: '/seo' },
    { name: '⚙️ Optimize Existing Article', path: '/optimize' },
  ];

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 24px',
      background: 'rgba(18, 22, 30, 0.75)',
      borderBottom: '1px solid var(--card-border)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      marginBottom: '30px'
    }} className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.4rem' }}>🤖</span>
        <strong style={{
          fontSize: '1.2rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #a5b4fc, #6366f1)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Antigravity Content Suite
        </strong>
      </div>
      <div style={{ display: 'flex', gap: '8px' }} className="nav-links">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`view-toggle-btn ${isActive ? 'active' : ''}`}
              style={{
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--gray-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
