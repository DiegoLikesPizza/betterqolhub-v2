/**
 * A 302 that is safe to send from behind a reverse proxy.
 *
 * `NextResponse.redirect()` needs an absolute URL, and the obvious way to build
 * one — `new URL(path, request.url)` — resolves against the URL Next itself
 * received. Behind nginx that is `http://localhost:3003`, so a same-site
 * redirect would send the visitor to a host that only exists on the server.
 * This does not show up in local testing, where there is no proxy in front.
 *
 * The fix is to emit a *relative* Location. HTTP allows it, and the browser
 * resolves it against the URL it actually requested, which is the public one —
 * so this stays correct without depending on any env var being set right.
 *
 * Pass an absolute URL for outbound links; it is sent through unchanged.
 */
export function redirectTo(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      // A cached redirect would skip the server on every later request, and the
      // counter behind it would quietly stop moving.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
