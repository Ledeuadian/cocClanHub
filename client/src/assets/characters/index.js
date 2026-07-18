/**
 * Clash-of-Clans-style character asset registry.
 *
 * Each section in the scrolling Dashboard references one of these
 * characters. The PNG files are user-supplied — drop them into
 *   client/src/assets/characters/<key>.png
 * using the same `key` value below. Until the actual PNG is present,
 * the <DashboardSection> component falls back to a stylised CSS card
 * with the character's emoji + name so the layout still looks correct.
 *
 * Asset path note: webpack will resolve these via the SVG/PNG loader
 * at build time. Public folder PNGs work too — see
 *   client/public/characters/<key>.png
 * In that case change src to `/characters/<key>.png`. We default to
 * the public folder because Vite serves it as-is and the bundle
 * doesn't inline it (keeping the APK smaller).
 */
export const CHARACTERS = {
  barbarian: {
    key: 'barbarian',
    name: 'Barbarian',
    emoji: '⚔️',
    accent: '#ef4444',  // red
    src: '/characters/barbarian.png',
    tagline: 'Brute-force your way in.',
  },
  archer: {
    key: 'archer',
    name: 'Archer',
    emoji: '🏹',
    accent: '#10b981',  // green
    src: '/characters/archer.png',
    tagline: 'Long-range precision.',
  },
  giant: {
    key: 'giant',
    name: 'Giant',
    emoji: '🛡️',
    accent: '#f59e0b',  // amber
    src: '/characters/giant.png',
    tagline: 'Soak the damage.',
  },
  wizard: {
    key: 'wizard',
    name: 'Wizard',
    emoji: '🪄',
    accent: '#a855f7',  // purple
    src: '/characters/wizard.png',
    tagline: 'Splash damage everywhere.',
  },
  dragon: {
    key: 'dragon',
    name: 'Dragon',
    emoji: '🐉',
    accent: '#dc2626',  // crimson
    src: '/characters/dragon.png',
    tagline: 'Scorched-earth siege.',
  },
  goblin: {
    key: 'goblin',
    name: 'Goblin',
    emoji: '💰',
    accent: '#84cc16',  // lime
    src: '/characters/goblin.png',
    tagline: 'Loot first, ask later.',
  },
  minion: {
    key: 'minion',
    name: 'Minion',
    emoji: '🦇',
    accent: '#ec4899',  // pink
    src: '/characters/minion.png',
    tagline: 'Terror of the skies.',
  },
  valkyrie: {
    key: 'valkyrie',
    name: 'Valkyrie',
    emoji: '🪓',
    accent: '#06b6d4',  // cyan
    src: '/characters/valkyrie.png',
    tagline: 'Spin through anything.',
  },
  builder: {
    key: 'builder',
    name: 'Builder',
    emoji: '🔨',
    accent: '#f97316',  // orange
    src: '/characters/builder.png',
    tagline: 'Always building, always.',
  },
}

/**
 * Returns a character record by key, or a generic fallback.
 */
export function getCharacter(key) {
  return CHARACTERS[key] || {
    key: 'default',
    name: 'Trooper',
    emoji: '🛡️',
    accent: '#64748b',
    src: null,
    tagline: '',
  }
}
