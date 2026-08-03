// Release notes: the versioned half of what a developer publishes here.
//
// Kept apart from src/lib/announcements.ts on purpose. An announcement is news
// with a short life — an outage, a warning about a fake copy. A changelog entry
// is a record: it is read months later by someone working out which version
// broke something. See the ChangelogEntry model for why that is two tables and
// not one column.

/**
 * Long enough for a real release, short enough that it stays a changelog.
 *
 * Twice the announcement limit, because these are bullet lists rather than a
 * paragraph — but well short of the feature list, which is a standing document
 * rather than one entry among many.
 */
export const MAX_CHANGELOG_LENGTH = 4000;

/**
 * Enough for "1.8.9-fabric build 12", short of a sentence.
 *
 * The cap exists because this renders as a badge beside the date: a version
 * string long enough to wrap would break the row it sits in, and anything that
 * long is a title, not a version.
 */
export const MAX_VERSION_LENGTH = 32;

/** How many entries the listing page renders before "Show older releases". */
export const CHANGELOG_PAGE_SIZE = 3;

/**
 * How many the page loads at all.
 *
 * A listing that has shipped weekly for three years would otherwise put its
 * entire history into every page render, for the handful of readers who expand
 * the section. Older entries are not lost — this is the point at which "show
 * older" would need to become a paginated route, and nothing here is near it.
 */
export const CHANGELOG_HISTORY_LIMIT = 50;

/** Shown above the composer, in the same spirit as the announcement rule. */
export const CHANGELOG_RULE =
  'Published under your name as this listing’s developer, and shown to everyone. Markdown works — a bullet list of what changed reads best.';
