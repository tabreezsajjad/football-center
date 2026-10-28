function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
const utcStamp = (value) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

function foldLine(line) {
  const encoder = new TextEncoder();
  let result = '';
  let size = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) {
      result += '\r\n ';
      size = 1;
    }
    result += character;
    size += bytes;
  }
  return result;
}

export function buildMatchCalendar(match) {
  if (
    !Number.isFinite(Date.parse(match.utcDate)) ||
    ['SCHEDULED', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'FINISHED'].includes(match.status)
  )
    throw new Error('A confirmed kickoff time is required.');
  const description = `${match.competition}${match.round ? ` · ${match.round}` : ''}. Planned 150-minute calendar block. Kickoff may change; check the latest schedule.`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Football Center//Match calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${match.id}@football-center.local`,
    `DTSTAMP:${utcStamp(Date.now())}`,
    `DTSTART:${utcStamp(match.utcDate)}`,
    `DTEND:${utcStamp(Date.parse(match.utcDate) + 150 * 60000)}`,
    `SUMMARY:${escapeText(`${match.home} vs ${match.away}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(match.venue ? [`LOCATION:${escapeText(match.venue)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldLine)
    .join('\r\n');
}

export function downloadMatchCalendar(match) {
  const file = new Blob([buildMatchCalendar(match)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `football-match-${match.id}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
