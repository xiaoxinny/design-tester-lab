import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { Toaster } from '@/components/ui/toaster';
import { themeInitScript } from '@/lib/theme';

import './globals.css';

export const metadata: Metadata = {
  title: 'design-tester-lab',
  description:
    'Evaluate AI models on UI generation against an objective design-quality rubric.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-base text-text-primary font-sans antialiased min-h-screen lab-grid">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
