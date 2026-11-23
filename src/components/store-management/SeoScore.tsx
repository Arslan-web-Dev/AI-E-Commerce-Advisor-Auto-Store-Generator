'use client';

import React from 'react';

interface Props {
  title?: string;
  description?: string;
  keywords?: string[];
}

export function computeSeoScore(title?: string, description?: string): { score: number; tips: string[] } {
  let score = 0;
  const tips: string[] = [];

  // Title checks
  if (!title || title.trim().length === 0) {
    tips.push('Add a product title');
  } else if (title.length < 10) {
    score += 15;
    tips.push('Title is short — aim for 20-60 characters');
  } else if (title.length > 70) {
    score += 25;
    tips.push('Title may be truncated in search results (>70 chars)');
  } else {
    score += 35;
  }

  // Description checks
  if (!description || description.trim().length === 0) {
    tips.push('Add a product description');
  } else if (description.length < 50) {
    score += 20;
    tips.push('Description is short — add key features and specifications');
  } else if (description.length >= 100 && description.length <= 300) {
    score += 45;
  } else {
    score += 35;
  }

  // Commercial intent keywords
  const lower = `${title || ''} ${description || ''}`.toLowerCase();
  const commercialTerms = ['pakistan', 'lahore', 'cash on delivery', 'cod', 'quality', 'price', 'original', 'buy', 'warranty'];
  const matches = commercialTerms.filter((term) => lower.includes(term));
  if (matches.length > 0) {
    score += Math.min(20, matches.length * 10);
  } else {
    tips.push('Mention "Cash on Delivery" or location (Punjab/Pakistan) for local search relevance');
  }

  return { score: Math.min(100, score), tips };
}

export default function SeoScoreBadge({ title, description }: Props) {
  const { score, tips } = computeSeoScore(title, description);

  let color = '#ef4444';
  let label = 'Needs Work';
  if (score >= 80) {
    color = '#4edea3';
    label = 'Excellent';
  } else if (score >= 60) {
    color = '#4cd7f6';
    label = 'Good';
  } else if (score >= 40) {
    color = '#f59e0b';
    label = 'Fair';
  }

  return (
    <div style={{ backgroundColor: '#131b2e', border: '1px solid #2d3449', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dae2fd', opacity: 0.8 }}>SEO Optimization Score</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>
          {score}/100 ({label})
        </span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#2d3449', borderRadius: '100px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', backgroundColor: color, transition: 'width 0.4s' }} />
      </div>
      {tips.length > 0 && (
        <p style={{ fontSize: '0.7rem', color: '#bbcabf', marginTop: '0.4rem', lineHeight: 1.3 }}>
          💡 {tips[0]}
        </p>
      )}
    </div>
  );
}
