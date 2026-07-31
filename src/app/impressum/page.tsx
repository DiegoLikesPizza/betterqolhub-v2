import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Site notice and legal disclosure. Yes, really.',
};

// NOTE: these are placeholder details, not a valid § 5 TMG disclosure. If this
// site ever needs a real Impressum, the operator's actual legal name, address
// and a working contact address have to replace them.
const OPERATOR = {
  name: 'John Fortnite',
  street: 'qolstraße 69',
  city: '69420 Pleasant Park',
  country: 'Agartha',
  email: '[soonTM]',
};

export default async function ImpressumPage() {
  await recordPageHitFor(PAGE_KEYS.impressum, (await headers()).get('user-agent'));

  return (
    <div className="container narrow-page impressum">
      <h1 className="pixel page-title">Impressum</h1>
      <p className="page-sub">
        The most legally binding page on this website, and the only one without stars on it.
      </p>

      <section className="impressum-section">
        <h2 className="admin-section-title">Site operator</h2>
        <div className="form-card">
          <p className="impressum-address">
            {OPERATOR.name}
            <br />
            {OPERATOR.street}
            <br />
            {OPERATOR.city}
            <br />
            {OPERATOR.country}
          </p>
          <p className="impressum-note">
            No, this is not a limited company. There is no legal department. There is
            one person, a server in Nuremberg, and a bot called QOLHelper who does most
            of the actual work.
          </p>
        </div>
      </section>

      <section className="impressum-section">
        <h2 className="admin-section-title">Contact</h2>
        <div className="form-card">
          <p>
            <strong>Email:</strong> {OPERATOR.email}
          </p>
          <p>
            <strong>Discord:</strong>{' '}
            <a
              href="https://discord.gg/E56QxrW9Jt"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--gold)' }}
            >
              the server
            </a>{' '}
            — realistically the fastest way, and the only one with emoji.
          </p>
          <p className="impressum-note">
            Response time: somewhere between four minutes and the heat death of the
            universe, depending on whether Skyblock has an update out.
          </p>
        </div>
      </section>

      <section className="impressum-section">
        <h2 className="admin-section-title">Liability for content</h2>
        <div className="form-card">
          <p>
            We are responsible for our own content on these pages under general law.
            We are not obliged to monitor third-party information that is transmitted
            or stored here, nor to investigate circumstances that suggest unlawful
            activity.
          </p>
          <p className="impressum-note">
            In plain terms: we vet what gets listed, and we take that seriously — it is
            the entire point of the site. But we did not write these mods, we do not
            host them, and we cannot promise that a macro someone published at 3am is
            going to be kind to your account. Read the reviews. That is what they are for.
          </p>
        </div>
      </section>

      <section className="impressum-section">
        <h2 className="admin-section-title">Liability for links</h2>
        <div className="form-card">
          <p>
            This site contains links to external websites over which we have no
            control. The respective provider is always responsible for the content of
            any linked page. Links are checked before they are published; permanent
            monitoring is not reasonable without concrete evidence of a violation.
          </p>
          <p className="impressum-note">
            Every listing here is a door to somewhere else. We checked the door. We
            cannot follow you through it.
          </p>
        </div>
      </section>

      <section className="impressum-section">
        <h2 className="admin-section-title">User-submitted reviews</h2>
        <div className="form-card">
          <p>
            Reviews are written by members and represent their own opinions, not ours.
            Each review is tied to a verified Discord account. We remove reviews that
            are abusive, fraudulent, or posted in bad faith.
          </p>
          <p className="impressum-note">
            One star because it did not work is a review. One star because you got
            caught is a diary entry.
          </p>
        </div>
      </section>

      <section className="impressum-section">
        <h2 className="admin-section-title">Not affiliated with</h2>
        <div className="form-card">
          <p>
            Better QOLHub is a community project. It is <strong>not</strong> affiliated
            with, endorsed by, or in any way blessed by Hypixel Inc., Mojang AB, or
            Microsoft. &ldquo;Minecraft&rdquo; and &ldquo;Hypixel&rdquo; belong to their
            respective owners, who have never heard of us and would probably prefer it
            stayed that way.
          </p>
        </div>
      </section>

      <section className="impressum-section">
        <h2 className="admin-section-title">Dispute resolution</h2>
        <div className="form-card">
          <p>
            The European Commission provides a platform for online dispute resolution
            at{' '}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--gold)' }}
            >
              ec.europa.eu/consumers/odr
            </a>
            . We are neither obliged nor willing to participate in dispute resolution
            proceedings before a consumer arbitration board.
          </p>
          <p className="impressum-note">
            We would like to formally note that the European Commission has, to date,
            declined to mediate any disputes about whether Dungeons or Mining is the
            better grind. We remain hopeful.
          </p>
        </div>
      </section>

      <p className="impressum-foot">
        You have reached the bottom of the Impressum. Genuinely, well done — most
        people bounce at &ldquo;liability&rdquo;.{' '}
        <Link href="/listings" style={{ color: 'var(--gold)' }}>
          Go look at some mods instead.
        </Link>
      </p>
    </div>
  );
}
