import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Financial Events Monitor',
  description: 'Real-time IPO, dividend, and price mover dashboard',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#020617', color: '#e2e8f0' }}>
        {children}
      </body>
    </html>
  );
}
