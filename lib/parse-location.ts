export type ParsedLocation = {
  raw: string;
  page: number | null;
  title: string;
  exposure: string | null;
};

export function parseLocation(raw: string): ParsedLocation {
  const trimmed = raw.trim();
  const pageMatch = trimmed.match(/^(\d+)\s*쪽/);
  if (!pageMatch) {
    return { raw: trimmed, page: null, title: trimmed, exposure: null };
  }

  const page = Number(pageMatch[1]);
  if (!Number.isInteger(page) || page < 1) {
    return { raw: trimmed, page: null, title: trimmed, exposure: null };
  }

  const nameMatch = trimmed.match(/「([^」]+)」/);
  const exposureMatch = trimmed.match(/\(([^)]+)\)\s*$/);
  return {
    raw: trimmed,
    page,
    title: nameMatch?.[1]?.trim() || `${page}쪽`,
    exposure: exposureMatch?.[1]?.trim() || null,
  };
}

export function locationHeading(location: ParsedLocation): string {
  if (location.page == null) return location.raw;
  if (!location.title || location.title === `${location.page}쪽`) return `${location.page}쪽`;
  return `${location.page}쪽 · ${location.title}`;
}
