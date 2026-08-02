import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/site';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';
import { getPublishedModpacks } from '@/lib/modpacks';
import { FILE_KINDS, formatBytes, splitAccent } from '@/lib/modpack';

export const revalidate = 0;

const MODPACK_DESCRIPTION =
  'Our picks for Hypixel Skyblock, packaged and ready to install. Download as a Modrinth pack or a full ZIP.';

export const metadata: Metadata = {
  title: 'Modpacks',
  description: MODPACK_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/modpacks` },
  openGraph: {
    type: 'website',
    title: 'Modpacks — our picks, in one install',
    description: MODPACK_DESCRIPTION,
    url: `${SITE_URL}/modpacks`,
  },
  twitter: { card: 'summary_large_image', description: MODPACK_DESCRIPTION },
};

export default async function ModpacksPage() {
  await recordPageHitFor(PAGE_KEYS.modpacks, (await headers()).get('user-agent'));

  const packs = await getPublishedModpacks();

  return (
    <div className="container modpack-page">
      <section className="pack-hero">
        <div className="hero-eyebrow pixel">Our Picks</div>
        <h1 className="pixel pack-title">Modpacks</h1>
        <p className="pack-subtitle">
          Everything we actually run, in one install — vetted, versioned, and kept
          current.
        </p>
      </section>

      {packs.length === 0 ? (
        <p className="pack-note">No packs are published right now. Check back soon.</p>
      ) : (
        <div className="pack-grid pack-grid-wide">
          {packs.map((pack) => {
            const { head, tail } = splitAccent(pack.name);
            return (
              <Link key={pack.slug} href={`/modpacks/${pack.slug}`} className="pack-card">
                <span className="pixel pack-card-title">
                  {head}
                  {tail && <span className="accent">{tail}</span>}
                </span>
                <span className="pack-card-summary">{pack.summary}</span>

                <span className="pack-meta pack-card-chips">
                  <span className="pack-chip">{pack.modCount} mods</span>
                  <span className="pack-chip">MC {pack.minecraft}</span>
                  <span className="pack-chip">{pack.loader}</span>
                </span>

                <span className="pack-card-files">
                  {pack.files.map((file) => (
                    <span key={file.kind} className="pack-card-file">
                      {FILE_KINDS[file.kind].label} · {formatBytes(file.bytes)}
                    </span>
                  ))}
                </span>

                <span className="btn btn-primary download-btn">View pack</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
