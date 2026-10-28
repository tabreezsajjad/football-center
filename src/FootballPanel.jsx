import { useEffect, useState } from 'react';
import {
  RefreshCw,
  ExternalLink,
  CalendarDays,
  Trophy,
  Tv,
  ChevronDown,
  MapPin,
  CalendarPlus,
} from 'lucide-react';
import {
  getFootballConfig,
  getClubFootball,
  getStandings,
  getNationsLeague,
} from './api/footballApi';
import { useResource } from './hooks/useResource';
import { downloadMatchCalendar } from './api/calendar';
import TeamCrest from './TeamCrest';

function ChoicePicker({ label, options, preferred, value, onChange, moreLabel }) {
  const [showAll, setShowAll] = useState(false);
  const primary = options.filter((item) => preferred.includes(item.id) || item.id === value);
  const visible = showAll || !primary.length ? options : primary;
  return (
    <div className="choice-picker">
      <div className="choice-heading">
        <p>{label}</p>
        {primary.length > 0 && primary.length < options.length && (
          <button className="text-button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? 'Show fewer' : moreLabel}
          </button>
        )}
      </div>
      <div className="choice-buttons" role="group" aria-label={label}>
        {visible.map((item) => (
          <button
            key={item.id}
            className={`choice-button ${value === item.id ? 'is-selected' : ''}`}
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
          >
            {item.short && (
              <span
                className="choice-badge"
                style={{ '--club-color': item.color || '#59dbdf' }}
                aria-hidden="true"
              >
                <TeamCrest src={item.crest} name={item.label} short={item.short} />
              </span>
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const matchLabels = {
  IN_PLAY: 'Playing now',
  PAUSED: 'Half-time',
  POSTPONED: 'Postponed',
  SUSPENDED: 'Suspended',
  EXTRA_TIME: 'Extra time',
  PENALTY_SHOOTOUT: 'Penalties',
};

function LoadMessage({ resource }) {
  const [now, setNow] = useState(() => Date.now());
  const retryAt = resource.error?.retryAt;
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const remaining = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  if (resource.loading)
    return (
      <p className="empty-state" role="status">
        Loading…
      </p>
    );
  if (!resource.error) return null;
  return (
    <div className="data-message" role="status">
      <p>{resource.error.message}</p>
      <button className="text-button" onClick={resource.retry} disabled={remaining > 0}>
        <RefreshCw size={16} />
        {remaining > 0 ? `Try again in ${remaining}s` : 'Try again'}
      </button>
    </div>
  );
}

function DataFooter({ resource }) {
  if (!resource.data) return null;
  const sources = resource.data.sources || [
    {
      name: 'football-data.org',
      url: 'https://www.football-data.org/',
      fetchedAt: resource.data.fetchedAt,
    },
  ];
  return (
    <footer className="data-footer">
      <p>
        {sources.map((source) => (
          <span key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.name}
            </a>
            {source.fetchedAt &&
              Number.isFinite(Date.parse(source.fetchedAt)) &&
              ` · Data fetched ${new Date(source.fetchedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          </span>
        ))}
        <span>Schedules and scores may be delayed.</span>
      </p>
      {resource.refreshMs > 0 && (
        <div className="update-status">
          <p role="status">
            {resource.refreshing
              ? 'Checking for updates…'
              : resource.checkedAt
                ? `Last successful check: ${new Date(resource.checkedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
                : ''}
          </p>
          <details className="explanation">
            <summary>How updates work</summary>
            <p>
              Checks every 5 minutes while this page is visible and online, and when you return
              after that interval. Existing matches stay visible during updates.
            </p>
            <p>
              League fixtures are cached for 10 minutes, tables for 15 minutes, and cup or Nations
              League fixtures for 30 minutes. Checking again can return the same saved data. Scores
              are not guaranteed live.
            </p>
            <p>
              India streaming information is manually verified against official sources. Its review
              date is shown under Watch in India; expired entries become “Not confirmed”. Team logos
              follow the providers’ images and browser caching.
            </p>
          </details>
        </div>
      )}
      <button
        className="text-button"
        onClick={resource.retry}
        disabled={resource.refreshing || Boolean(resource.error)}
      >
        <RefreshCw size={15} />
        {resource.refreshing ? 'Checking…' : 'Check for updates'}
      </button>
    </footer>
  );
}

function SavedCopyNotice({ resource }) {
  if (!resource.data || (!resource.data.stale && !resource.error)) return null;
  return (
    <p className="saved-copy-notice" role="status">
      Showing the last saved update. New information is temporarily unavailable.
    </p>
  );
}

function IndiaWatch({ watch }) {
  const platform = watch?.platform;
  const checkedAt = watch?.checkedAt;
  return (
    <details className="watch-info">
      <summary>
        <Tv size={14} aria-hidden="true" />
        <span>Watch in India</span>
        <strong>{platform?.name || 'Not confirmed'}</strong>
        {watch?.selectedMatches && <small>Selected matches</small>}
        <ChevronDown size={14} className="watch-chevron" aria-hidden="true" />
      </summary>
      <div className="watch-panel">
        <p>{watch?.note || 'Streaming details for this match in India are not confirmed yet.'}</p>
        {platform && (
          <>
            <a className="watch-link" href={platform.url} target="_blank" rel="noreferrer">
              Open {platform.name}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <p className="watch-cost-note">A subscription or match pass may be needed.</p>
          </>
        )}
        {watch?.sources?.length > 0 && (
          <ul className="watch-sources">
            {watch.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        )}
        {checkedAt && Number.isFinite(Date.parse(checkedAt)) && (
          <p className="watch-checked">
            Broadcast information checked{' '}
            {new Date(checkedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone: 'UTC',
            })}
            . {watch.reviewBy && `Review due ${watch.reviewBy}. `}Competition rights; this match’s
            listing is not verified.
          </p>
        )}
      </div>
    </details>
  );
}

function FixtureList({ resource, clubName, international = false }) {
  const [competition, setCompetition] = useState('all');
  const data = resource.data;
  const upcoming =
    data?.fixtures.filter((game) => !['FINISHED', 'CANCELLED', 'AWARDED'].includes(game.status)) ||
    [];
  const choices = [
    ...new Map(upcoming.map((game) => [game.competitionCode, game.competition])).entries(),
  ];
  const activeCode = choices.some(([code]) => code === competition) ? competition : 'all';
  const fixtures = upcoming.filter(
    (game) => activeCode === 'all' || game.competitionCode === activeCode,
  );
  return (
    <>
      <LoadMessage resource={resource} />
      <SavedCopyNotice resource={resource} />
      {data && (
        <>
          <div className="list-heading">
            <div>
              <h2>{clubName} matches</h2>
              <p>
                {upcoming.length} upcoming · {choices.length}{' '}
                {choices.length === 1 ? 'competition' : 'competitions'}
              </p>
            </div>
            <p>Next 30 days · Your local time</p>
          </div>
          {!international && (
            <div
              className="competition-filters"
              role="group"
              aria-label="Filter matches by competition"
            >
              <button
                className={activeCode === 'all' ? 'is-active' : ''}
                aria-pressed={activeCode === 'all'}
                onClick={() => setCompetition('all')}
              >
                All matches
              </button>
              {choices.map(([code, name]) => (
                <button
                  key={code}
                  className={activeCode === code ? 'is-active' : ''}
                  aria-pressed={activeCode === code}
                  onClick={() => setCompetition(code)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {data.cupCoverage && (
            <p className="coverage-status">
              {data.cupCoverage.some((cup) => !cup.complete)
                ? 'Some cup feeds are unavailable. Matches may be missing.'
                : `Cup feeds checked: ${data.cupCoverage.map((cup) => cup.name).join(', ')}. Other competitions may be missing.`}
            </p>
          )}
          {international && <p className="coverage-status">National teams · {data.coverageNote}</p>}
          <div className="fixtures-list">
            {fixtures.map((game, index) => {
              const date = new Date(game.utcDate);
              const hasScore =
                Number.isInteger(game.score?.home) && Number.isInteger(game.score?.away);
              const timeUnknown = ['SCHEDULED', 'POSTPONED', 'SUSPENDED'].includes(game.status);
              return (
                <article className={`fixture-row ${index === 0 ? 'next-match' : ''}`} key={game.id}>
                  <time className="fixture-date" dateTime={game.utcDate}>
                    <span>
                      {date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <strong>
                      {timeUnknown
                        ? 'Time to be confirmed'
                        : date.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </strong>
                  </time>
                  <div className="match-content">
                    <p
                      className="fixture-competition"
                      data-competition={game.competitionCode}
                      aria-label={`Competition: ${game.competition}`}
                    >
                      <Trophy size={14} aria-hidden="true" />
                      {game.competition}
                    </p>
                    <div className="fixture-teams">
                      <span className="fixture-team">
                        <TeamCrest src={game.homeCrest} name={game.home} />
                        <span>{game.home}</span>
                      </span>
                      <span className="versus">
                        {hasScore ? `${game.score.home} – ${game.score.away}` : 'vs'}
                      </span>
                      <span className="fixture-team">
                        <TeamCrest src={game.awayCrest} name={game.away} />
                        <span>{game.away}</span>
                      </span>
                    </div>
                    {matchLabels[game.status] && (
                      <p className="match-status">{matchLabels[game.status]}</p>
                    )}
                    <div className="fixture-facts">
                      {game.homeAway && (
                        <span className="home-away">
                          {game.homeAway === 'home' ? 'Home game' : 'Away game'}
                        </span>
                      )}
                      {game.round && <span className="match-round">{game.round}</span>}
                      {game.venue && (
                        <span>
                          <MapPin size={13} aria-hidden="true" />
                          {game.venue}
                        </span>
                      )}
                    </div>
                    <div className="match-actions">
                      <IndiaWatch watch={game.watchInIndia} />
                      {game.status === 'TIMED' && (
                        <button
                          className="calendar-button"
                          onClick={() => downloadMatchCalendar(game)}
                          aria-label={`Add ${game.home} vs ${game.away} to calendar`}
                        >
                          <CalendarPlus size={14} />
                          Add to calendar
                        </button>
                      )}
                    </div>
                  </div>
                  {index === 0 && (
                    <span className="next-label">
                      {['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(game.status)
                        ? 'Now'
                        : 'Up next'}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
          {!fixtures.length && (
            <div className="empty-state">
              <CalendarDays size={30} />
              <h2>No upcoming matches to show</h2>
              <p>
                No matches were listed for the next 30 days.{' '}
                {international
                  ? 'Check the coverage notice above for feed availability.'
                  : 'Some cup fixtures may be unavailable.'}
              </p>
            </div>
          )}
          {!international && (
            <details className="explanation competition-details">
              <summary>
                Competitions this season <span>{data.competitions.length}</span>
              </summary>
              <p>
                These are the competitions this club entered this season. It may have already
                finished playing in some of them.
              </p>
              <ul>
                {data.competitions.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <small>{item.covered ? 'Matches included' : 'Match dates unavailable'}</small>
                  </li>
                ))}
              </ul>
              <p>Some domestic cup matches are not included in this app.</p>
            </details>
          )}
          <DataFooter resource={resource} />
        </>
      )}
    </>
  );
}

function StandingsTable({ resource }) {
  const data = resource.data;
  const [fullTable, setFullTable] = useState(false);
  const startYear = data?.season?.start?.slice(0, 4);
  const endYear = data?.season?.end?.slice(0, 4);
  const season = startYear
    ? endYear && endYear !== startYear
      ? `${startYear}/${endYear.slice(2)}`
      : startYear
    : null;
  return (
    <>
      <LoadMessage resource={resource} />
      <SavedCopyNotice resource={resource} />
      {data && (
        <>
          <div className="list-heading">
            <div>
              <h2>{data.competition}</h2>
              {season && <p>{season} season</p>}
            </div>
            <label className="table-toggle">
              <input
                type="checkbox"
                checked={fullTable}
                onChange={(event) => setFullTable(event.target.checked)}
              />
              Show full stats
            </label>
          </div>
          {data.groups.map((group, index) => (
            <div
              className="standings-scroll"
              key={`${group.name}-${index}`}
              tabIndex={0}
              role="region"
              aria-label={`${data.competition} league table`}
            >
              <table className={`standings-table ${fullTable ? 'full-stats' : ''}`}>
                <caption className={data.groups.length === 1 ? 'sr-only' : ''}>
                  {data.groups.length === 1
                    ? `${data.competition} standings`
                    : group.name.replaceAll('_', ' ')}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" aria-label="Position">
                      #
                    </th>
                    <th scope="col">Club</th>
                    <th scope="col">Played</th>
                    {fullTable && (
                      <>
                        <th scope="col">Won</th>
                        <th scope="col">Drawn</th>
                        <th scope="col">Lost</th>
                      </>
                    )}
                    <th
                      className="goal-difference"
                      scope="col"
                      title="Goals scored minus goals conceded"
                    >
                      Goal diff.
                    </th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {group.table.map((row) => (
                    <tr key={row.teamId}>
                      <td>{row.position}</td>
                      <th scope="row">
                        <span className="table-team">
                          <TeamCrest src={row.crest} name={row.team} />
                          <span>{row.team}</span>
                        </span>
                      </th>
                      <td>{row.played}</td>
                      {fullTable && (
                        <>
                          <td>{row.won}</td>
                          <td>{row.drawn}</td>
                          <td>{row.lost}</td>
                        </>
                      )}
                      <td className="goal-difference">
                        {row.goalDifference > 0 ? '+' : ''}
                        {row.goalDifference}
                      </td>
                      <td className="table-points">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {(!data.groups.length || data.groups.every((group) => !group.table.length)) && (
            <p className="empty-state">
              There is no league table to show right now. Knockout competitions may not have a
              table.
            </p>
          )}
          <details className="explanation">
            <summary>How to read this table</summary>
            <p>
              Teams are ordered by their league position. A win usually earns 3 points and a draw 1
              point. Goal difference is goals scored minus goals conceded. Choose “Show full stats”
              to see wins, draws and losses.
            </p>
          </details>
          <DataFooter resource={resource} />
        </>
      )}
    </>
  );
}

export default function FootballPanel({ clubs, favourites, mode, selectedClubId, onSelectClub }) {
  const config = useResource(getFootballConfig, 'config');
  const [code, setCode] = useState('PL');
  const [matchScope, setMatchScope] = useState('clubs');
  const selected =
    clubs.find((club) => club.id === selectedClubId) ||
    clubs.find((club) => favourites.includes(club.id)) ||
    clubs[0];
  const configured = config.data?.configured === true;
  const isFixtures = mode === 'fixtures';
  const international = isFixtures && matchScope === 'nations';
  const nations = useResource(getNationsLeague, international ? 'UNL' : null, 5 * 60000);
  const club = useResource(
    getClubFootball,
    isFixtures && !international && configured && selected ? selected.id : null,
    5 * 60000,
  );
  const standings = useResource(getStandings, !isFixtures && configured ? code : null, 5 * 60000);
  return (
    <section
      className="football-panel"
      aria-label={isFixtures ? 'Upcoming matches' : 'Competition standings'}
    >
      <LoadMessage resource={config} />
      {config.data && (
        <>
          {isFixtures && (
            <div className="competition-filters" role="group" aria-label="Match type">
              <button
                className={!international ? 'is-active' : ''}
                aria-pressed={!international}
                onClick={() => setMatchScope('clubs')}
              >
                Club matches
              </button>
              <button
                className={international ? 'is-active' : ''}
                aria-pressed={international}
                onClick={() => setMatchScope('nations')}
              >
                Nations League
              </button>
            </div>
          )}
          {isFixtures ? (
            !international && (
              <ChoicePicker
                key="clubs"
                label="Your clubs"
                options={clubs.map((item) => ({
                  id: item.id,
                  label: item.name,
                  short: item.short,
                  crest: item.crest,
                  color: item.color,
                }))}
                preferred={favourites}
                value={selected?.id}
                onChange={onSelectClub}
                moreLabel="Browse all clubs"
              />
            )
          ) : (
            <ChoicePicker
              key="leagues"
              label="Choose a competition"
              options={config.data.competitions.map((item) => ({
                id: item.code,
                label: item.name,
              }))}
              preferred={['PL', 'PD', 'BL1', 'FL1', 'SA', 'CL']}
              value={code}
              onChange={setCode}
              moreLabel="More competitions"
            />
          )}
          {!configured && !international && (
            <div className="setup-panel">
              <h2>Football data isn’t connected yet</h2>
              <p>
                Add your free account token in the server settings to load matches and league
                tables.
              </p>
              <a
                href="https://www.football-data.org/client/register"
                target="_blank"
                rel="noreferrer"
              >
                Get a free token <ExternalLink size={15} />
              </a>
              <button className="text-button" onClick={config.retry}>
                Check connection
              </button>
            </div>
          )}
          {(configured || international) &&
            (isFixtures ? (
              <FixtureList
                key={international ? 'nations' : selected?.id}
                resource={international ? nations : club}
                clubName={international ? 'Nations League' : selected?.name || 'Club'}
                international={international}
              />
            ) : (
              <StandingsTable resource={standings} />
            ))}
        </>
      )}
    </section>
  );
}
