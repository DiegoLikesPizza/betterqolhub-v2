/**
 * The download-safety warning shown on the modpack pages.
 *
 * Deliberately scoped to modpacks: those are the pages where the site hands over
 * an actual jar, so "check what you are running" is advice the reader can act on
 * there. On a listing page the same warning was noise — the link goes to the
 * developer's own project page, not to a file, and a warning shown everywhere is
 * one that gets read nowhere.
 *
 * Not dismissible and not a modal: it is a standing caveat, not an interruption,
 * and one that is clicked away once stops being a caveat at all.
 */
export default function SafetyNotice() {
  return (
    <aside className="safety-notice" role="note">
      <span className="safety-icon" aria-hidden="true">
        !
      </span>
      <p className="safety-text">
        <strong>Only run jars you can trace back to their source.</strong> Every mod
        here links to where it came from — check that a file you downloaded matches, and
        be suspicious of a ZIP handed to you in DMs, on a mirror, or through a link
        shortener. A pack downloaded from here is not a promise about a copy you got
        somewhere else.
      </p>
    </aside>
  );
}
