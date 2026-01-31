import { mountOverlay } from './overlay';
import { getSupportedSiteFromLocation } from './sites';

async function main(): Promise<void> {
  const supportedSite = getSupportedSiteFromLocation(window.location);
  if (!supportedSite) return;

  // Avoid double-inject during SPA navigations.
  if (document.getElementById('pinkvanity-root')) return;

  await mountOverlay(supportedSite);
}

void main();

