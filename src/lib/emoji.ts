// Emoji handling for reviews.
//
// Two kinds exist, and they are handled differently on purpose:
//
//   Unicode emoji (😀)   — ordinary text. They already survive the database
//                          (Postgres UTF-8 stores 4-byte code points fine) and
//                          render everywhere without help. Nothing to do but
//                          offer them in the picker.
//
//   Custom server emoji  — Discord-only images, written `<:name:id>` or
//                          `<a:name:id>` when animated. Stored in exactly that
//                          form so the same string renders as an <img> here and
//                          natively in Discord when the bot mirrors the review.

export type CustomEmoji = {
  id: string;
  name: string;
  animated: boolean;
};

/** Matches Discord's own custom-emoji syntax. */
const CUSTOM_EMOJI = /<(a?):([a-zA-Z0-9_]{2,32}):(\d{15,25})>/g;

export function emojiUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}`;
}

export function emojiToken(e: CustomEmoji): string {
  return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
}

export type Segment =
  | { type: 'text'; value: string }
  | { type: 'emoji'; id: string; name: string; animated: boolean };

/**
 * Splits a review body into plain text and custom-emoji segments.
 *
 * The id/name shapes are enforced by the regex rather than trusted, so a body
 * containing something like `<:x:javascript:...>` cannot produce an image URL
 * pointing anywhere except Discord's CDN. Rendering is done with React elements
 * (never dangerouslySetInnerHTML), so the text segments stay inert.
 */
export function parseEmoji(body: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  // Fresh regex state per call — the global flag makes lastIndex stateful.
  const re = new RegExp(CUSTOM_EMOJI.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, match.index) });
    }
    segments.push({
      type: 'emoji',
      animated: match[1] === 'a',
      name: match[2],
      id: match[3],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) });
  }
  return segments;
}

/** How many custom emoji a body contains — used to cap spam. */
export function countCustomEmoji(body: string): number {
  return [...body.matchAll(new RegExp(CUSTOM_EMOJI.source, 'g'))].length;
}

/**
 * Replaces custom emoji with a space, for checks that should see only what the
 * reader would read as words.
 */
export function stripCustomEmoji(body: string): string {
  return body.replace(new RegExp(CUSTOM_EMOJI.source, 'g'), ' ');
}

export const MAX_CUSTOM_EMOJI_PER_REVIEW = 20;

/**
 * Length as a reader perceives it: a custom emoji is one glyph on screen but
 * ~25 characters of markup, so counting raw length would let a couple of emoji
 * eat the whole limit.
 */
export function displayLength(body: string): number {
  const withoutCustom = body.replace(new RegExp(CUSTOM_EMOJI.source, 'g'), '*');
  // Count by code points so astral-plane emoji count as one, not two.
  return [...withoutCustom].length;
}

// A broad, categorised Unicode set for the picker. This is not every emoji in
// Unicode (there are thousands) — but the textarea accepts any emoji the user
// types or pastes from their OS picker, so anything missing here still works.
export const UNICODE_EMOJI: { group: string; emoji: string[] }[] = [
  {
    group: 'Smileys',
    emoji: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
      '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕',
      '😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖',
      '😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡',
    ],
  },
  {
    group: 'Gestures',
    emoji: [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋',
      '🤚','🖐️','🖖','👋','🤝','🙏','✍️','💪','🦾','🖕','👏','🙌','👐','🤲','🫡','🫠',
    ],
  },
  {
    group: 'Hearts',
    emoji: [
      '❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💯','💢','💥','💫','💦','💨','🕳️','💬','💭','🗯️','♨️','🔥','✨','⭐',
    ],
  },
  {
    group: 'Gaming',
    emoji: [
      '🎮','🕹️','🎲','🎯','🎰','🃏','🀄','🎴','🧩','🏆','🥇','🥈','🥉','🏅','🎖️','⚔️',
      '🛡️','🗡️','🏹','🔫','💣','🧨','⚙️','🔧','🔨','⛏️','🪓','🧱','💎','💰','🪙','👑',
    ],
  },
  {
    group: 'Objects',
    emoji: [
      '💻','🖥️','⌨️','🖱️','📱','📲','☎️','📞','📷','🎥','📺','🔍','🔎','💡','🔦','🔋',
      '🔌','📦','📜','📄','📝','✏️','📌','📎','🔗','🔒','🔓','🔑','🗝️','🚪','🪤','⏰',
    ],
  },
  {
    group: 'Symbols',
    emoji: [
      '✅','❌','⛔','🚫','⚠️','❗','❓','‼️','⁉️','♻️','🔰','✔️','☑️','🆗','🆕','🆓',
      '🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜',
    ],
  },
];
