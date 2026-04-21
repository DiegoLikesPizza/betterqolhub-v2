import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export default async function ClientsPage() {
  const mods = await prisma.mod.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="container" style={{ paddingTop: '8rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1rem' }}>Verified Clients</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
          Browse our collection of thoroughly vetted, open-source Skyblock modifications.
        </p>
      </div>

      <div className="mod-grid">
        {mods.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No clients currently listed. Use the API to add some.</p>
        ) : (
          mods.map((mod) => (
            <div key={mod.id} className="mod-card">
              <div className="mod-header">
                <div>
                  <h3 className="mod-title">{mod.name}</h3>
                  <div className="mod-dev">by {mod.developer}</div>
                </div>
                <div className={`badge ${mod.isTrusted ? 'badge-trusted' : 'badge-unverified'}`}>
                  {mod.isTrusted ? 'Trusted' : 'Unverified'}
                </div>
              </div>
              
              <div className="mod-desc">
                {mod.description}
              </div>
              
              <div className="mod-footer">
                <a href={mod.downloadUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', width: '100%' }}>
                  Download
                </a>
                <a href={mod.sourceUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', width: '100%' }}>
                  Source
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
