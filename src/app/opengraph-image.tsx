import { ImageResponse } from 'next/og';

// The card Discord shows for any page without its own image.
export const alt = 'Better QOLHub — the community-vetted hub for Hypixel Skyblock';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// No webfont is loaded on purpose: fetching one at build time makes the build
// depend on the network, and a failed font fetch would break deploys for the
// sake of an image. Brand identity comes from the palette and layout instead.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0d0b14',
          // The site's faint pixel grid, at a scale that survives Discord's
          // downscaling.
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          border: '12px solid #34235c',
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#ffaa00',
            marginBottom: 12,
          }}
        >
          Hypixel Skyblock
        </div>

        <div style={{ display: 'flex', fontSize: 116, fontWeight: 700, lineHeight: 1 }}>
          <span style={{ color: '#ece8f5' }}>Better&nbsp;</span>
          <span style={{ color: '#ffaa00' }}>QOLHub</span>
        </div>

        <div
          style={{
            fontSize: 34,
            color: '#9c92b8',
            marginTop: 28,
            maxWidth: 900,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Cheat clients, macros, legit mods and shops — every listing vetted
          before it lands.
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 44 }}>
          {[
            ['Cheat Clients', '#ff5555'],
            ['Macros', '#ff55ff'],
            ['Legit Mods', '#55ff55'],
            ['Shops', '#ffaa00'],
          ].map(([label, color]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                fontSize: 24,
                color,
                border: `3px solid ${color}55`,
                backgroundColor: `${color}14`,
                padding: '8px 18px',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
