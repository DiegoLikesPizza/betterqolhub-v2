import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/site';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';
import { getModpackBySlug, getPublishedModpacks } from '@/lib/modpacks';
import { FILE_KINDS, modrinthUrl, formatBytes, splitAccent } from '@/lib/modpack';
import SafetyNotice from '@/app/SafetyNotice';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getModpackBySlug(slug);
  if (!pack) return { title: 'Modpack not found' };

  const description = `${pack.name}: ${pack.summary} ${pack.modCount} mods for Minecraft ${pack.minecraft} on ${pack.loader}.`;

  return {
    title: pack.name,
    description,
    alternates: { canonical: `${SITE_URL}/modpacks/${pack.slug}` },
    openGraph: {
      type: 'website',
      title: `${pack.name} — ${pack.summary}`,
      description,
      url: `${SITE_URL}/modpacks/${pack.slug}`,
    },
    twitter: { card: 'summary_large_image', description },
  };
}

export default async function ModpackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await getModpackBySlug(slug);
  if (!pack) notFound();

  await recordPageHitFor(PAGE_KEYS.modpacks, (await headers()).get('user-agent'));

  const others = (await getPublishedModpacks()).filter((p) => p.slug !== pack.slug);
  const { head, tail } = splitAccent(pack.name);

  return (
    <div className="container modpack-page">
      <section className="pack-hero">
        <div className="hero-eyebrow pixel">
          <Link href="/modpacks" className="pack-back">
            Modpacks
          </Link>
        </div>
        <h1 className="pixel pack-title">
          {head}
          {tail && <span className="accent">{tail}</span>}
        </h1>
        <p className="pack-subtitle">{pack.summary}</p>

        <div className="pack-meta">
          <span className="pack-chip">{pack.modCount} mods</span>
          <span className="pack-chip">MC {pack.minecraft}</span>
          <span className="pack-chip">{pack.loader}</span>
          <span className="pack-chip">v{pack.version}</span>
        </div>
      </section>

      <section className="download-grid">
        {pack.files.map((file) => {
          const copy = FILE_KINDS[file.kind];
          return (
            // Points at the counting route, which redirects to the real file in
            // /downloads/. `download` stays on so the browser saves rather than
            // navigates once it lands there.
            <a
              key={file.kind}
              href={`/download/${pack.slug}/${file.kind}`}
              download
              className="download-card"
            >
              <div className="download-head">
                <span className="download-label pixel">{copy.label}</span>
                <span className="download-size">{formatBytes(file.bytes)}</span>
              </div>
              <p className="download-blurb">{copy.blurb}</p>
              <span className="download-file">{file.filename}</span>
              <span className="btn btn-primary download-btn">Download</span>
            </a>
          );
        })}
      </section>

      <SafetyNotice />

      {pack.files.length > 1 && (
        <p className="pack-note">
          Both files contain the same {pack.modCount} mods — only the packaging differs.
          Pick the ZIP if you are not sure.
        </p>
      )}

      {pack.groups.length > 0 && (
        <section className="admin-section" style={{ marginTop: '4rem' }}>
          <div className="section-head">
            <h2 className="section-title">What is inside</h2>
            <p className="section-sub">
              Every mod in the pack, grouped by what it does. Names link to their source.
            </p>
          </div>

          <div className="mod-groups">
            {pack.groups.map((group) => (
              <section
                key={group.key}
                className="mod-group"
                style={{ '--group': group.color } as CSSProperties}
              >
                <header className="mod-group-head">
                  <h3 className="pixel mod-group-title">{group.title}</h3>
                  <span className="mod-group-count">{group.mods.length}</span>
                </header>
                <p className="mod-group-blurb">{group.blurb}</p>

                <ul className="mod-list">
                  {group.mods.map((mod) => (
                    <li key={`${mod.name}-${mod.version}`} className="mod-row">
                      {mod.modrinth ? (
                        <a
                          href={modrinthUrl(mod.modrinth)}
                          target="_blank"
                          rel="noreferrer"
                          className="mod-name mod-name-link"
                        >
                          {mod.name}
                        </a>
                      ) : (
                        <span className="mod-name">{mod.name}</span>
                      )}
                      <span className="mod-version">{mod.version}</span>
                      {mod.bundledOnly && <span className="mod-flag">bundled</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      )}

      <section className="admin-section">
        <div className="section-head">
          <h2 className="section-title">Installing</h2>
        </div>
        <div className="form-card install-card">
          <ol className="install-steps">
            <li>
              <strong>Modrinth pack (.mrpack)</strong> — open it with the Modrinth App,
              Prism Launcher or ATLauncher. The launcher downloads the mods and sets up
              the profile for you.
            </li>
            <li>
              <strong>Full ZIP</strong> — unpack it and copy the <code>mods</code> folder
              into your {pack.loader.split(' ')[0]} instance&apos;s <code>.minecraft</code>{' '}
              directory. Make sure the instance is {pack.loader} on MC {pack.minecraft}.
            </li>
          </ol>
          {/* Only shown when the pack actually ships overrides — the warning is
              about those specific jars, so on a pack without them it would be
              a scary sentence about nothing. */}
          {pack.hasBundled && (
            <p className="install-warning">
              The mods marked <strong>bundled</strong> are not hosted on Modrinth and can
              get your account banned. If you only want the safe half, delete those jars
              from the mods folder before launching.
            </p>
          )}
        </div>
      </section>

      {others.length > 0 && (
        <section className="admin-section">
          <div className="section-head">
            <h2 className="section-title">Other packs</h2>
          </div>
          <div className="pack-grid">
            {others.map((other) => (
              <Link key={other.slug} href={`/modpacks/${other.slug}`} className="pack-card">
                <span className="pixel pack-card-title">{other.name}</span>
                <span className="pack-card-summary">{other.summary}</span>
                <span className="pack-card-meta">
                  {other.modCount} mods · MC {other.minecraft}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
