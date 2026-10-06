import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'SPARK', template: '%s · SPARK' },
  description: 'Sponsor & Professor Automated Reach Kit. Personal outreach, sent from your own Gmail.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="relative min-h-full text-zinc-100">
        <AnimatedBackground />
        {children}
      </body>
    </html>
  );
}
