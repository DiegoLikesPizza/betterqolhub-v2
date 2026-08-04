// A small Markdown subset, rendered as React elements.
//
// This exists to display text developers wrote about their own product. The
// single most important property is stated here rather than left implicit:
// **nothing in this file produces an HTML string, and nothing uses
// dangerouslySetInnerHTML.** Every output is a React element with text as
// children, so React escapes it. A parsing bug here is a cosmetic bug — a
// mangled list — and cannot become script execution. That is what makes a
// hand-written subset defensible where hand-written HTML sanitising would not
// be.
//
// The subset is deliberately small: headings, bullet and numbered lists, bold,
// italic, inline code, links, and paragraphs. No images (they would let a third
// party track every visitor to a listing page, and be a way to put arbitrary
// pictures on a page that vouches for someone), no raw HTML, no tables.

import type { ReactNode } from 'react';

/** Protocols a link may use. Anything else renders as plain text. */
const SAFE_PROTOCOLS = ['http:', 'https:'];

function isSafeHref(href: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    // Relative links have nowhere sensible to point from a listing page.
    return false;
  }
}

/**
 * Inline formatting, applied inside a single line.
 *
 * One pass with a combined pattern rather than nested replaces, so the segments
 * cannot overlap and a stray marker degrades to a literal character instead of
 * swallowing the rest of the line.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](');
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      nodes.push(
        isSafeHref(href) ? (
          <a key={key} href={href} target="_blank" rel="noreferrer nofollow">
            {label}
          </a>
        ) : (
          // Not silently dropped: the reader should see that something was
          // meant to be a link, without it being clickable.
          <span key={key}>{label}</span>
        )
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: 'heading'; level: 3 | 4; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; lines: string[] };

/** Groups lines into blocks. Blank lines separate paragraphs. */
function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  // Headings deeper than #### are flattened rather than honoured: this sits
  // inside a page that already has its own heading hierarchy, and letting the
  // text introduce an <h1> would break the document outline.
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const previous = blocks[blocks.length - 1];

    if (!trimmed) {
      // A blank line ends whatever was open.
      if (previous) blocks.push({ kind: 'paragraph', lines: [] });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length <= 2 ? 3 : 4,
        text: heading[2]!,
      });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const item = (bullet ?? numbered)![1]!;
      if (previous?.kind === 'list' && previous.ordered === ordered) {
        previous.items.push(item);
      } else {
        blocks.push({ kind: 'list', ordered, items: [item] });
      }
      continue;
    }

    if (previous?.kind === 'paragraph' && previous.lines.length > 0) {
      previous.lines.push(trimmed);
    } else {
      blocks.push({ kind: 'paragraph', lines: [trimmed] });
    }
  }

  return blocks.filter((b) => b.kind !== 'paragraph' || b.lines.length > 0);
}

/**
 * Renders a Markdown subset. Returns null for empty input so callers can decide
 * whether to draw a container at all.
 */
export function renderMarkdown(source: string | null | undefined): ReactNode {
  if (!source || !source.trim()) return null;

  return parseBlocks(source).map((block, index) => {
    const key = `b${index}`;

    if (block.kind === 'heading') {
      const Tag = block.level === 3 ? 'h3' : 'h4';
      return (
        <Tag key={key} className="md-heading">
          {renderInline(block.text, key)}
        </Tag>
      );
    }

    if (block.kind === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={key} className="md-list">
          {block.items.map((item, i) => (
            <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </Tag>
      );
    }

    return (
      <p key={key} className="md-paragraph">
        {block.lines.map((line, i) => (
          <span key={`${key}-${i}`}>
            {i > 0 && ' '}
            {renderInline(line, `${key}-${i}`)}
          </span>
        ))}
      </p>
    );
  });
}

/**
 * Normalises line endings on text submitted from a `<textarea>`.
 *
 * The HTML form-submission rules turn every newline in a textarea into CRLF,
 * so what the server receives is one character longer per line than what the
 * writer typed and the character counter beside the field showed. On a 4 000
 * limit nobody noticed; on a long feature list it means a list that reads as
 * 100 000 characters in the browser arrives as 100 900 and is refused with a
 * message that appears to contradict the counter.
 *
 * Applied before both the length check and the write, so the stored text is
 * exactly what was typed. Rendering never depended on this — parseBlocks
 * normalises too — but a database full of stray CRs is a trap for anything that
 * later reads the column without doing the same.
 */
export function normaliseLineEndings(raw: string): string {
  return raw.replace(/\r\n?/g, '\n');
}

/**
 * Cap on the feature list.
 *
 * Raised from 4 000 after a developer hit it: a client with a few dozen
 * features, each with a line of explanation, runs past 4 000 characters long
 * before it stops being a feature list and starts being an essay.
 *
 * The ceiling is now set by what the page can carry rather than by taste. The
 * list is rendered into the listing page's HTML — collapsed, but present — so
 * its length is paid by every visitor to that listing. 100 000 is the point at
 * which that cost is still measured in tens of kilobytes, and it stays inside
 * the 1 MB body limit Next puts on a Server Action even if every character is
 * a four-byte one.
 */
export const MAX_FEATURES_LENGTH = 100_000;
