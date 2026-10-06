import React from 'react';
import BusinessIdeaWizard from '@/components/wizard/BusinessIdeaWizard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Business Idea & Location Wizard | Feasibility Advisor',
  description: 'Submit your commercial idea, target location, and capital runway for AI feasibility analysis.',
};

export default function WizardPage() {
  return <BusinessIdeaWizard />;
}
