import { parseEmoji, emojiUrl } from '@/lib/emoji';

/**
 * Renders a review body, turning Discord custom-emoji tokens into images.
 *
 * Built from React elements rather than an HTML string, so user text can never
 * become markup. Unicode emoji need no handling — they are just characters and
 * fall through in the text segments.
 */
export default function EmojiText({ children }: { children: string }) {
  const segments = parseEmoji(children);

  return (
    <>
      {segments.map((segment, i) =>
        segment.type === 'text' ? (
          <span key={i}>{segment.value}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            className="custom-emoji"
            src={emojiUrl(segment.id, segment.animated)}
            alt={`:${segment.name}:`}
            title={`:${segment.name}:`}
            loading="lazy"
            draggable={false}
          />
        )
      )}
    </>
  );
}
