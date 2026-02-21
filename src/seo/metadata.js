const SITE_NAME = 'Waterpolo Hub';
const SITE_URL = 'https://waterpolo.paulzuiderduin.com';
const DEFAULT_IMAGE = `${SITE_URL}/favicon.svg`;

const DEFAULT_DESCRIPTION =
  'Waterpolo Hub helps coaches and players track shotmaps, scoring events, possessions, and video snippets in one platform.';

const DEFAULT_KEYWORDS = [
  'water polo analytics',
  'waterpolo shotmap',
  'water polo stats app',
  'water polo scoring',
  'water polo video analysis',
  'waterpolo coaching tools'
].join(', ');

const TAB_META = {
  hub: {
    title: 'Waterpolo Dashboard',
    description: 'Overview of your team season, modules, and recent analysis activity.'
  },
  matches: {
    title: 'Waterpolo Match Management',
    description: 'Create and manage matches per season and team for consistent analytics tracking.'
  },
  shotmap: {
    title: 'Waterpolo Shotmap Tracker',
    description: 'Track shot locations, outcomes, player caps, and attack types on an interactive water polo field.'
  },
  analytics: {
    title: 'Waterpolo Shot Analytics',
    description: 'Analyze shot volume, efficiency, saves, misses, and distance heatmaps by zone and player.'
  },
  video: {
    title: 'Waterpolo Video Analysis',
    description: 'Create local video snippets, add tactical drawings, and export clips for review and sharing.'
  },
  scoring: {
    title: 'Waterpolo Scoring Events',
    description: 'Log goals, exclusions, fouls, turnovers, and penalties with per-player event summaries.'
  },
  possession: {
    title: 'Waterpolo Possession Mapping',
    description: 'Track pass sequences and possession outcomes to evaluate offensive patterns.'
  },
  players: {
    title: 'Waterpolo Player Reports',
    description: 'Review player performance report cards from shotmap and scoring data.'
  },
  roster: {
    title: 'Waterpolo Team Roster',
    description: 'Manage roster profiles with cap numbers and player details for all modules.'
  },
  help: {
    title: 'Waterpolo Hub Help Center',
    description: 'Getting started guide, legends, and FAQs for using Waterpolo Hub modules.'
  },
  settings: {
    title: 'Waterpolo Hub Settings',
    description: 'Configure module visibility and user preferences in Waterpolo Hub.'
  },
  privacy: {
    title: 'Waterpolo Hub Privacy Policy',
    description: 'Read how Waterpolo Hub processes and stores personal and match data.'
  }
};

const getBaseUrl = () => {
  if (typeof window === 'undefined') return SITE_URL;
  return window.location.origin || SITE_URL;
};

export const getSeoMetadata = ({
  activeTab,
  isAuthenticated,
  selectedSeasonName = '',
  selectedTeamName = ''
}) => {
  const base = getBaseUrl();
  const tabMeta = TAB_META[activeTab] || {};
  const scope =
    isAuthenticated && (selectedTeamName || selectedSeasonName)
      ? ` · ${selectedSeasonName || 'Season'} · ${selectedTeamName || 'Team'}`
      : '';

  const titlePrefix = tabMeta.title || 'Waterpolo Shotmap, Scoring & Video Analytics';
  const title = `${titlePrefix}${scope} | ${SITE_NAME}`;
  const description = tabMeta.description || DEFAULT_DESCRIPTION;
  const canonical = `${base}/`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web',
    url: canonical,
    description,
    image: DEFAULT_IMAGE,
    inLanguage: 'en',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR'
    },
    creator: {
      '@type': 'Person',
      name: 'Paul Zuiderduin'
    }
  };

  return {
    title,
    description,
    keywords: DEFAULT_KEYWORDS,
    canonical,
    robots: 'index, follow',
    og: {
      type: 'website',
      title,
      description,
      url: canonical,
      image: DEFAULT_IMAGE,
      siteName: SITE_NAME
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      image: DEFAULT_IMAGE
    },
    jsonLd
  };
};

