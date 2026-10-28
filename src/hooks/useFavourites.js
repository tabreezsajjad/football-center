import { useEffect, useState } from 'react';

const DEFAULT_FAVOURITES = [1, 2, 3, 4, 5];

export function useFavourites() {
  const [favourites, setFavourites] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fc-favourites'));

      return Array.isArray(saved)
        ? [...new Set(saved.filter((id) => Number.isInteger(id) && id > 0 && id !== 6))]
        : DEFAULT_FAVOURITES;
    } catch {
      return DEFAULT_FAVOURITES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('fc-favourites', JSON.stringify(favourites));
    } catch {
      // Favourites remain usable when browser storage is unavailable or full.
    }
  }, [favourites]);

  function toggleFavourite(id) {
    setFavourites((current) => {
      const updated = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      return updated;
    });
  }

  return { favourites, toggleFavourite };
}
