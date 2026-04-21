import Link from 'next/link';

export default function Home() {
  return (
    <div className="container">
      <section className="hero">
        <h1 className="hero-title">Better QOLHub</h1>
        <p className="hero-subtitle">
          Your trusted source for quality-of-life improvements. Discover vetted, open-source solutions that enhance your Skyblock experience with complete transparency and security.
        </p>
        <div className="gap-4" style={{ justifyContent: 'center' }}>
          <Link href="/clients" className="btn btn-primary">
            Explore Clients
          </Link>
          <a href="https://discord.gg/E56QxrW9Jt" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Join Community
          </a>
        </div>
      </section>

      <section>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Built with trust in mind</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Every feature designed to keep you safe and informed.</p>
        </div>

        <div className="bento-grid">
          <div className="bento-item col-span-8">
            <div className="bento-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h3 className="bento-title">Security First</h3>
            <p className="bento-desc">
              Every tool is thoroughly scanned and tested for malware, backdoors, and suspicious behavior. Your safety and privacy are our highest priorities.
            </p>
          </div>

          <div className="bento-item col-span-4">
            <div className="bento-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <h3 className="bento-title">Open Source</h3>
            <p className="bento-desc">
              Transparency in code means transparency in functionality.
            </p>
          </div>

          <div className="bento-item col-span-4">
            <div className="bento-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <h3 className="bento-title">Performance</h3>
            <p className="bento-desc">
              Enhance gameplay without compromising on frame rates.
            </p>
          </div>

          <div className="bento-item col-span-8">
            <div className="bento-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <h3 className="bento-title">Thorough Vetting Process</h3>
            <p className="bento-desc">
              We test each mod extensively, check for compatibility issues, and verify the developer's reputation. You only get the best tools.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
