// Manually reviewed official sources. Competition rights are NOT confirmation
// that a specific fixture is listed or included in a customer's subscription.
const checkedAt = '2026-10-28';
const reviewBy = '2026-11-27';
const jiostar = { name: 'JioHotstar', url: 'https://www.hotstar.com/in' };
const zee = { name: 'ZEE5', url: 'https://www.zee5.com/' };

const broadcasts = {
  EFL_CUP: {
    platform: {
      name: 'FanCode',
      url: 'https://www.fancode.com/football/tour/carabao-cup-2026-27-19789287/matches',
    },
    from: '2026-07-01',
    until: '2027-06-30',
    selectedMatches: true,
    sources: [
      {
        title: 'EFL: India broadcast partners',
        url: 'https://www.efl.com/how-to-watch/broadcast-partners/',
      },
      {
        title: 'FanCode: Carabao Cup 2026/27 fixtures',
        url: 'https://www.fancode.com/football/tour/carabao-cup-2026-27-19789287/matches',
      },
    ],
  },
  PL: {
    platform: jiostar,
    from: '2025-08-01',
    until: '2028-06-30',
    sources: [
      {
        title: 'Premier League: 2025–2028 broadcast partners',
        url: 'https://www.premierleague.com/en/media/broadcasters',
      },
      {
        title: 'JioStar: Premier League on JioHotstar',
        url: 'https://www.jiostar.com/news/jiohotstar-unveiling-infinite-possibilities/',
      },
    ],
  },
  PD: {
    platform: {
      name: 'FanCode',
      url: 'https://www.fancode.com/football/tour/laliga-2026-27-19782952/matches',
    },
    from: '2026-07-01',
    until: '2027-06-30',
    sources: [
      {
        title: 'FanCode / Dream Sports: La Liga rights for India',
        url: 'https://www.dreamsports.group/media-and-blog/fancode-enters-into-multi-year-partnership-with-laliga-to-become-exclusive-broadcast-partner-for-india',
      },
    ],
  },
  CL: {
    platform: {
      name: 'Sony LIV',
      url: 'https://www.sonyliv.com/sports/football-uefa-champions-league-2026-27-1590016457',
    },
    from: '2026-07-01',
    until: '2027-06-30',
    sources: [
      {
        title: 'Sony LIV: Champions League 2026/27',
        url: 'https://www.sonyliv.com/sports/football-uefa-champions-league-2026-27-1590016457',
      },
    ],
  },
  BL1: {
    platform: zee,
    from: '2026-07-01',
    until: '2031-06-30',
    sources: [
      {
        title: 'ZEE: Bundesliga rights from 2026/27',
        url: 'https://www.zee.com/in-the-news/z-strengthens-football-portfolio-secures-exclusive-rights-for-german-bundesliga-in-india/',
      },
    ],
  },
  SA: {
    platform: zee,
    from: '2026-08-22',
    until: '2031-06-30',
    sources: [
      {
        title: 'ZEE: Serie A rights from August 2026',
        url: 'https://www.zee.com/in-the-news/z-secures-exclusive-media-rights-for-prestigious-italian-football-leagues-serie-a-coppa-italia-and-supercoppa-italiana/',
      },
    ],
  },
  FL1: {
    platform: jiostar,
    from: '2026-08-21',
    until: '2027-06-30',
    selectedMatches: true,
    sources: [
      {
        title: 'LFP: 2026/27 India agreement; selected matches',
        url: 'https://www.lfp.fr/article/la-ligue-1-mc-donald-s-accelere-son-developpement-international-avec-de-nouveaux-accords-de-diffusion-strategiques',
      },
    ],
  },
};

export function getIndiaBroadcast(code, kickoff, now = Date.now()) {
  const entry = broadcasts[code];
  const matchDate = Number.isFinite(Date.parse(kickoff))
    ? new Date(kickoff).toISOString().slice(0, 10)
    : null;
  const currentDate = new Date(now).toISOString().slice(0, 10);
  const current =
    entry &&
    matchDate &&
    matchDate >= entry.from &&
    matchDate <= entry.until &&
    currentDate <= reviewBy;
  return {
    region: 'India',
    status: current ? 'listed' : entry ? 'needs-review' : 'unverified',
    platform: current ? { ...entry.platform } : null,
    selectedMatches: current ? Boolean(entry.selectedMatches) : false,
    matchListingVerified: false,
    checkedAt: entry ? checkedAt : null,
    reviewBy: entry ? reviewBy : null,
    sources: entry ? entry.sources.map((source) => ({ ...source })) : [],
    note: !current
      ? 'Streaming details for this match in India are not confirmed. Check the competition’s official broadcast information.'
      : entry.selectedMatches
        ? 'Only selected matches are covered. Confirm this fixture in the platform’s schedule before subscribing.'
        : 'This is the competition’s streaming partner in India. Confirm this fixture in the platform’s schedule before subscribing.',
  };
}
