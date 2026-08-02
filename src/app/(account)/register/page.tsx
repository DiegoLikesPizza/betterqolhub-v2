import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/authz';
import RegisterForm from './RegisterForm';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Already signed in? Nothing to do here.
  if (await currentUser()) redirect('/');

  // Read on the server so the form does not need useSearchParams, which would
  // pull a Suspense boundary onto this page for one string.
  const { callbackUrl } = await searchParams;

  return (
    <div className="container narrow-page">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel page-title">Create Account</h1>
        <p className="page-sub">
          An account lets you review listings and tell the community what actually works.
        </p>
      </div>

      <RegisterForm callbackUrl={callbackUrl} />

      <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Already have one?{' '}
        <Link
          href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'}
          style={{ color: 'var(--gold)' }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
