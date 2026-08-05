import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk, Public_Sans } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
});
const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-public-sans',
});

export const metadata: Metadata = {
  title: 'Crux',
  description: 'Plataforma de competencias de escalada',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${publicSans.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
