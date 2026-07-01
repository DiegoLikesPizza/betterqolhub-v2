import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { logout } from './actions';
import AddListingForm from './AddListingForm';

export default async function AdminPage() {
  const session = await auth();
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="pixel" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', fontWeight: 700, marginBottom: '1rem' }}>Add Listing</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>
            Signed in as {session.user?.name}. Add a new entry to the hub.
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-secondary">Log out</button>
        </form>
      </div>

      <AddListingForm />
    </div>
  );
}
