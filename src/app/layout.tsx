import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Scene3DBackground from '@/components/ui/Scene3DBackground';
import MouseGlow from '@/components/ui/MouseGlow';
import PageTransition from '@/components/ui/PageTransition';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FeasibilityAdvisor | E-Commerce Feasibility & Store Drafts',
  description:
    'Review Pakistan-focused market evidence and provisional feasibility scores, then configure a multi-tenant e-commerce store draft.',
  keywords: [
    'Pakistan E-Commerce',
    'Business Feasibility Advisor',
    'Provisional MCDA',
    'COD Storefront Generator',
    'Lahore Karachi Islamabad Retail',
    'OpenStreetMap Overpass',
  ],
  authors: [{ name: 'Muhammad Arslan' }],
  metadataBase: new URL('https://feasibilityadvisor.pk'),
  openGraph: {
    title: 'FeasibilityAdvisor | E-Commerce Feasibility & Store Drafts',
    description:
      'Evaluate Pakistan-focused business ideas with available competitor data, disclosed cost estimates, and a provisional MCDA index.',
    type: 'website',
    locale: 'en_PK',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${plusJakartaSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans antialiased selection:bg-[#10b981]/30 selection:text-[#4edea3]">
        <Scene3DBackground />
        <MouseGlow />
        <PageTransition />
        {children}
      </body>
    </html>
  );
}
