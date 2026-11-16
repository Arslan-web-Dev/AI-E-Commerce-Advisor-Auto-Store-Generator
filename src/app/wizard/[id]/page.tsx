import React from 'react';
import BusinessIdeaWizard from '@/components/wizard/BusinessIdeaWizard';
import Reveal from '@/components/ui/Reveal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Resume Business Idea Draft | Feasibility Advisor',
  description: 'Continue editing your saved business idea draft for AI feasibility analysis.',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResumeWizardPage({ params }: PageProps) {
  const { id } = await params;
  return <Reveal><BusinessIdeaWizard initialProjectId={id} /></Reveal>;
}
