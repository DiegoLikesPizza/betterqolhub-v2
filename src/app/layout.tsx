import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Better QOLHub - Your Trusted Skyblock Hub',
  description: 'Discover vetted, open-source solutions that enhance your Skyblock experience',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="container navbar-content">
            <Link href="/" className="navbar-logo">
              <span>Better QOLHub</span>
            </Link>
            <ul className="navbar-menu">
              <li><Link href="/" className="navbar-link">Home</Link></li>
              <li><Link href="/clients" className="navbar-link">Clients</Link></li>
              <li><a href="https://discord.gg/E56QxrW9Jt" target="_blank" rel="noreferrer" className="navbar-link">Discord</a></li>
            </ul>
          </div>
        </nav>
        
        <main className="main-content">
          {children}
        </main>
        
        <footer className="footer">
          <div className="container">
            <p style={{ fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Better QOLHub</p>
            <p>© 2026 Better QOLHub. Built for the Skyblock community.</p>
            <p style={{ opacity: 0.6, marginTop: '0.5rem' }}>Open source, transparent, and always improving.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
