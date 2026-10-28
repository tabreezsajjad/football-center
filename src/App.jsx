import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Trophy, Shield, Search, Plus, X, Check, ChevronRight } from 'lucide-react';
import { getClubs } from './api/footballApi';
import { useFavourites } from './hooks/useFavourites';
import { useResource } from './hooks/useResource';
import FootballPanel from './FootballPanel';
import TeamCrest from './TeamCrest';
import './App.css';

const pages = [
  {
    id: 'clubs',
    label: 'My clubs',
    icon: Shield,
    description: 'Choose a club to see who they play next.',
  },
  {
    id: 'fixtures',
    label: 'Matches',
    icon: CalendarDays,
    description: 'League and cup games, in one match list.',
  },
  {
    id: 'standings',
    label: 'League tables',
    icon: Trophy,
    description: 'See where every team stands this season.',
  },
];
const loadDirectory = (_key, options) => getClubs(options);

function ClubBadge({ club }) {
  return (
    <span
      className="club-badge"
      style={{ '--club-color': club.color || '#39d9f5' }}
      aria-hidden="true"
    >
      <TeamCrest src={club.crest} name={club.name} short={club.short} />
    </span>
  );
}

function Navigation({ activePage, navigate, mobile = false }) {
  return (
    <nav
      className={mobile ? 'bottom-nav' : 'side-nav'}
      aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}
    >
      {pages.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={activePage === id ? 'nav-link active' : 'nav-link'}
          aria-current={activePage === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function MyClubs({ clubs, loading, error, openSearch, openMatches, onRemove }) {
  if (loading)
    return (
      <p className="empty-state" role="status">
        Loading your clubs…
      </p>
    );
  if (error) return null;
  if (!clubs.length)
    return (
      <div className="empty-state">
        <Shield size={32} />
        <h2>Start with a club you love</h2>
        <p>Follow a team, then open its upcoming matches.</p>
        <button className="primary-button" onClick={openSearch}>
          <Plus size={18} />
          Add your first club
        </button>
      </div>
    );
  return (
    <section aria-label="Clubs you follow">
      <p className="section-intro">
        {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'} followed
      </p>
      <div className="clubs-grid">
        {clubs.map((club) => (
          <article className="club-card" key={club.id}>
            <div className="club-card-heading">
              <ClubBadge club={club} />
              <div className="club-info">
                <h2>{club.name}</h2>
                <p>{club.league}</p>
              </div>
            </div>
            <div className="club-card-actions">
              <button
                className="club-open"
                onClick={() => openMatches(club.id)}
                aria-label={`View matches for ${club.name}`}
              >
                View matches
                <ChevronRight size={18} />
              </button>
              <button
                className="unfollow-button"
                onClick={() => onRemove(club.id)}
                aria-label={`Unfollow ${club.name}`}
              >
                Unfollow
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClubSearch({ onClose, clubs, favourites, toggleFavourite }) {
  const [search, setSearch] = useState('');
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input')?.focus();
    function onKey(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll('button, input');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [onClose]);
  const query = search.trim().toLowerCase();
  const results = clubs.filter((club) =>
    `${club.name} ${club.league} ${club.short || ''}`.toLowerCase().includes(query),
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-search-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2 id="club-search-title">Add clubs</h2>
            <p>Follow teams to keep them on your home screen.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close club search">
            <X size={21} />
          </button>
        </div>
        <div className="modal-search">
          <Search size={19} />
          <input
            aria-label="Find a club or league"
            placeholder="Club or league name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="search-summary" aria-live="polite">
          {results.length} {results.length === 1 ? 'club' : 'clubs'}
        </p>
        <div className="search-results">
          {results.map((club) => {
            const followed = favourites.includes(club.id);
            return (
              <div className="search-result" key={club.id}>
                <ClubBadge club={club} />
                <div className="club-info">
                  <h3>{club.name}</h3>
                  <p>{club.league}</p>
                </div>
                <button
                  className={`follow-button ${followed ? 'following' : ''}`}
                  aria-pressed={followed}
                  aria-label={followed ? `Unfollow ${club.name}` : `Follow ${club.name}`}
                  onClick={() => toggleFavourite(club.id)}
                >
                  {followed ? <Check size={16} /> : <Plus size={16} />}
                  {followed ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
          {!results.length && (
            <p className="empty-state">No clubs match that name. Try a different club or league.</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('clubs');
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const directory = useResource(loadDirectory, 'clubs');
  const clubs = directory.data || [];
  const { favourites, toggleFavourite } = useFavourites();
  const followedClubs = clubs.filter((club) => favourites.includes(club.id));
  const page = pages.find((item) => item.id === activePage);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  function navigate(id) {
    setActivePage(id);
    window.scrollTo(0, 0);
  }
  function openMatches(id) {
    setSelectedClubId(id);
    navigate('fixtures');
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            ⚽
          </span>
          <div>
            <strong>FOOTBALL</strong>
            <small>CENTER</small>
          </div>
        </div>
        <p className="sidebar-label">YOUR FOOTBALL</p>
        <Navigation activePage={activePage} navigate={navigate} />
        <p className="sidebar-footer">
          Your clubs. The next match.
          <br />
          One place.
        </p>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">Football Center</span>
          {activePage !== 'clubs' && (
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
              disabled={directory.loading || Boolean(directory.error)}
            >
              <Plus size={18} />
              <span>Add clubs</span>
            </button>
          )}
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <h1>{page.label}</h1>
              <p>{page.description}</p>
            </div>
            {activePage === 'clubs' && (
              <button
                className="primary-button"
                onClick={() => setSearchOpen(true)}
                disabled={directory.loading || Boolean(directory.error)}
              >
                <Plus size={18} />
                Add clubs
              </button>
            )}
          </div>
          {directory.error && (
            <div className="data-message" role="status">
              <h2>We couldn’t load your clubs</h2>
              <p>Your followed teams are saved. Please try connecting again.</p>
              <button className="text-button" onClick={directory.retry}>
                Try again
              </button>
            </div>
          )}
          {activePage === 'clubs' && (
            <MyClubs
              clubs={followedClubs}
              loading={directory.loading}
              error={directory.error}
              openSearch={() => setSearchOpen(true)}
              openMatches={openMatches}
              onRemove={toggleFavourite}
            />
          )}
          {activePage !== 'clubs' && (
            <FootballPanel
              clubs={clubs}
              favourites={favourites}
              mode={activePage}
              selectedClubId={selectedClubId}
              onSelectClub={setSelectedClubId}
            />
          )}
        </main>
      </div>
      <Navigation activePage={activePage} navigate={navigate} mobile />
      {searchOpen && (
        <ClubSearch
          onClose={closeSearch}
          clubs={clubs}
          favourites={favourites}
          toggleFavourite={toggleFavourite}
        />
      )}
    </div>
  );
}
