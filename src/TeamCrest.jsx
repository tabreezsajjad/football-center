import { useState } from 'react';
import { crestUrl } from '../shared/crests';

export default function TeamCrest({ src, name, short }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = crestUrl(src);
  const initials =
    short ||
    name
      ?.split(/\s+/)
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .toUpperCase() ||
    '?';
  return (
    <span className="team-crest" aria-hidden="true">
      {source && source !== failedSource ? (
        <img
          src={source}
          alt=""
          width="32"
          height="32"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span className="crest-initials">{initials}</span>
      )}
    </span>
  );
}
