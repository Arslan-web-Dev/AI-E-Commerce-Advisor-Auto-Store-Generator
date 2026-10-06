import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

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
  title: 'FeasibilityAdvisor | AI-Powered E-Commerce Feasibility & Auto Store Generator',
  description:
    'Validate commercial footfall, competitor saturation, and rent-to-budget feasibility across Pakistani commercial hubs with XGBoost & Multi-LLMs, then generate a live e-commerce storefront in minutes.',
  keywords: [
    'Pakistan E-Commerce',
    'Business Feasibility Advisor',
    'XGBoost Spatial ML',
    'COD Storefront Generator',
    'Lahore Karachi Islamabad Retail',
    'OpenStreetMap Overpass',
  ],
  authors: [{ name: 'Muhammad Arslan' }],
  metadataBase: new URL('https://feasibilityadvisor.pk'),
  openGraph: {
    title: 'FeasibilityAdvisor | AI-Powered E-Commerce Feasibility & Auto Store Generator',
    description:
      'Evaluate Pakistani retail feasibility with XGBoost spatial ML, OSM competitor density & rent intelligence, then launch a live online store.',
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
        {children}
      </body>
    </html>
  );
}
