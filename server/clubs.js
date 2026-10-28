// Stable local IDs preserve browser favourites; provider IDs stay server-side.
const directory = [
  { id: 1, name: 'Manchester City', league: 'Premier League', short: 'MCI', color: '#6CABDD' },
  { id: 2, name: 'FC Barcelona', league: 'La Liga', short: 'BAR', color: '#A50044' },
  { id: 3, name: 'Real Madrid', league: 'La Liga', short: 'RMA', color: '#D9B85F' },
  { id: 4, name: 'Bayern Munich', league: 'Bundesliga', short: 'BAY', color: '#DC052D' },
  { id: 5, name: 'Paris Saint-Germain', league: 'Ligue 1', short: 'PSG', color: '#3062AA' },
  { id: 7, name: 'Arsenal', league: 'Premier League', short: 'ARS', color: '#EF0107' },
  { id: 8, name: 'Liverpool', league: 'Premier League', short: 'LIV', color: '#C8102E' },
  { id: 9, name: 'Chelsea', league: 'Premier League', short: 'CHE', color: '#034694' },
  { id: 10, name: 'Juventus', league: 'Serie A', short: 'JUV', color: '#949494' },
  { id: 11, name: 'Borussia Dortmund', league: 'Bundesliga', short: 'BVB', color: '#FDE100' },
  { id: 12, name: 'AC Milan', league: 'Serie A', short: 'MIL', color: '#FB090B' },
];
const crestIds = { 1: 65, 2: 81, 3: 86, 4: 5, 5: 524, 7: 57, 8: 64, 9: 61, 10: 109, 11: 4, 12: 98 };
export const clubs = directory.map((club) => ({
  ...club,
  crest: `https://crests.football-data.org/${crestIds[club.id]}.png`,
}));
