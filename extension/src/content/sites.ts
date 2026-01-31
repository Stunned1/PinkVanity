export type SupportedSite = 'american-eagle' | 'zara' | 'hm';

export function getSupportedSiteFromLocation(loc: Location): SupportedSite | null {
  const host = loc.hostname.toLowerCase();

  if (host === 'www.ae.com') return 'american-eagle';
  if (host === 'www.zara.com') return 'zara';
  if (host === 'www2.hm.com') return 'hm';

  return null;
}

