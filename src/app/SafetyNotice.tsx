/**
 * The download-safety warning, in one place.
 *
 * Shown wherever the site is about to hand someone off to a file it does not
 * host — every listing page, and the modpack pages. A directory that vouches for
 * clients is exactly the sort of place people stop checking what they run, so
 * the warning belongs next to the button rather than buried in a footer.
 *
 * Deliberately not dismissible and not a modal: it is a standing caveat, not an
 * interruption, and one that is clicked away once stops being a caveat at all.
 */
export default function SafetyNotice({
  variant = 'listing',
}: {
  variant?: 'listing' | 'modpack';
}) {
  return (
    <aside className="safety-notice" role="note">
      <span className="safety-icon" aria-hidden="true">
        !
      </span>
      <p className="safety-text">
        {variant === 'modpack' ? (
          <>
            <strong>Only run jars you can trace back to their source.</strong> Every mod
            here links to where it came from — check that a file you downloaded matches,
            and be suspicious of a ZIP handed to you in DMs, on a mirror, or through a
            link shortener. A trusted listing here is not a promise about a copy you got
            somewhere else.
          </>
        ) : (
          <>
            <strong>Download only from the developer&rsquo;s own link above.</strong> We
            check the project, not every file on the internet claiming to be it —
            re-uploads, mirrors and ZIPs sent in DMs are how account-stealing builds get
            around. If a download asks you to disable your antivirus or hand over your
            Minecraft login, close it.
          </>
        )}
      </p>
    </aside>
  );
}
