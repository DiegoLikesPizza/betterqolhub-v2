import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/authz';
import ForgotPasswordForm from './ForgotPasswordForm';

export default async function ForgotPasswordPage() {
  if (await currentUser()) redirect('/settings');

  return (
    <div className="container narrow-page">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel page-title">Forgot Password</h1>
        <p className="page-sub">
          If your account has a linked Discord, QOLHelper can DM you a reset code.
        </p>
      </div>

      <ForgotPasswordForm />

      <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Remembered it? <Link href="/login" style={{ color: 'var(--gold)' }}>Sign in</Link>
      </p>
    </div>
  );
}
