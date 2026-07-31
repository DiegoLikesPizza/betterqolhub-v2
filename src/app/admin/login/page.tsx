import { redirect } from 'next/navigation';

// Admin sign-in was folded into the public /login page when accounts were
// added — one credential form, with access decided by role. Kept as a redirect
// so existing bookmarks keep working.
export default function AdminLoginRedirect() {
  redirect('/login?callbackUrl=/admin');
}
