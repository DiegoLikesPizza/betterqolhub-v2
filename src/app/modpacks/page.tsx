import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/site';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';
import {
  PACK,
  MOD_GROUPS,
  TOTAL_MODS,
  modrinthUrl,
  formatBytes,
} from '@/lib/modpack';

const MODPACK_DESCRIPTION =
  'QOLPack: our picks for Hypixel Skyblock, packaged for Fabric. Download as a Modrinth pack or a full ZIP.';

export const metadata: Metadata = {
  title: 'Modpacks',
  description: MODPACK_DESCRIPTION,
  openGraph: {
    type: 'website',
    title: 'QOLPack — our picks, in one install',
    description: MODPACK_DESCRIPTION,
    url: `${SITE_URL}/modpacks`,
  },
  twitter: { card: 'summary_large_image', description: MODPACK_DESCRIPTION },
};

export default async function ModpacksPage() {
  await recordPageHitFor(PAGE_KEYS.modpacks, (await headers()).get('user-agent'));

  const { mrpack, zip } = PACK.files;

  return (
    <div className="container modpack-page">
      <section className="pack-hero">
        <div className="hero-eyebrow pixel">Our Picks</div>
        <h1 className="pixel pack-title">
          QOL<span className="accent">Pack</span>
        </h1>
        <p className="pack-subtitle">
          Everything we actually run, in one install. {TOTAL_MODS} mods for Minecraft{' '}
          {PACK.minecraft} on {PACK.loader} — vetted, versioned, and kept current.
        </p>

        <div className="pack-meta">
          <span className="pack-chip">{TOTAL_MODS} mods</span>
          <span className="pack-chip">MC {PACK.minecraft}</span>
          <span className="pack-chip">{PACK.loader}</span>
        </div>
      </section>

      <section className="download-grid">
        {[
          { ...mrpack, go: '/download/mrpack' },
          { ...zip, go: '/download/zip' },
        ].map((file) => (
          // Points at the counting route, which redirects to the real file in
          // /downloads/. `download` stays on so the browser saves rather than
          // navigates once it lands there.
          <a key={file.filename} href={file.go} download className="download-card">
            <div className="download-head">
              <span className="download-label pixel">{file.label}</span>
              <span className="download-size">{formatBytes(file.bytes)}</span>
            </div>
            <p className="download-blurb">{file.blurb}</p>
            <span className="download-file">{file.filename}</span>
            <span className="btn btn-primary download-btn">Download</span>
          </a>
        ))}
      </section>

      <p className="pack-note">
        Both files contain the same {TOTAL_MODS} mods — only the packaging differs. Pick
        the ZIP if you are not sure.
      </p>

      <section className="admin-section" style={{ marginTop: '4rem' }}>
        <div className="section-head">
          <h2 className="section-title">What is inside</h2>
          <p className="section-sub">
            Every mod in the pack, grouped by what it does. Names link to their source.
          </p>
        </div>

        <div className="mod-groups">
          {MOD_GROUPS.map((group) => (
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
                  <li key={mod.name} className="mod-row">
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
              into your Fabric instance&apos;s <code>.minecraft</code> directory. Make sure
              the instance is Fabric {PACK.loader.replace('Fabric ', '')} on MC{' '}
              {PACK.minecraft}.
            </li>
          </ol>
          <p className="install-warning">
            The two mods marked <strong>bundled</strong> are not hosted on Modrinth and
            can get your account banned. If you only want the safe half, delete those two
            jars from the mods folder before launching.
          </p>
        </div>
      </section>
    </div>
  );
}
