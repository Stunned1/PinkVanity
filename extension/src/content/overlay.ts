import { getUserSettings } from '../shared/storage';
import type { SupportedSite } from './sites';

type OverlayState = {
  readonly supportedSite: SupportedSite;
};

const OVERLAY_ROOT_ID = 'pinkvanity-root';

function ensureRoot(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ROOT_ID);
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = OVERLAY_ROOT_ID;
  // Highest practical z-index while staying reasonable.
  root.style.zIndex = '2147483647';
  root.style.position = 'fixed';
  root.style.right = '16px';
  root.style.bottom = '16px';
  root.style.width = '320px';
  root.style.pointerEvents = 'none';

  document.documentElement.appendChild(root);
  return root;
}

function render(root: HTMLElement, state: OverlayState, summary: string): void {
  root.innerHTML = '';

  const card = document.createElement('div');
  card.style.pointerEvents = 'auto';
  card.style.border = '1px solid rgba(0,0,0,0.12)';
  card.style.borderRadius = '14px';
  card.style.padding = '12px';
  card.style.background = 'rgba(255,255,255,0.98)';
  card.style.color = '#111';
  card.style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)';
  card.style.fontFamily =
    'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

  const title = document.createElement('div');
  title.textContent = 'PinkVanity (MVP)';
  title.style.fontWeight = '700';
  title.style.marginBottom = '6px';

  const site = document.createElement('div');
  site.textContent = `Site: ${state.supportedSite}`;
  site.style.opacity = '0.8';
  site.style.fontSize = '12px';

  const body = document.createElement('div');
  body.textContent = summary;
  body.style.marginTop = '10px';
  body.style.fontSize = '13px';
  body.style.lineHeight = '1.3';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '10px';

  const optionsBtn = document.createElement('button');
  optionsBtn.textContent = 'Options';
  optionsBtn.style.flex = '1';
  optionsBtn.style.padding = '8px 10px';
  optionsBtn.style.borderRadius = '10px';
  optionsBtn.style.border = '1px solid rgba(0,0,0,0.2)';
  optionsBtn.style.background = '#fff';
  optionsBtn.style.cursor = 'pointer';
  optionsBtn.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  const hideBtn = document.createElement('button');
  hideBtn.textContent = 'Hide';
  hideBtn.style.flex = '1';
  hideBtn.style.padding = '8px 10px';
  hideBtn.style.borderRadius = '10px';
  hideBtn.style.border = '1px solid rgba(0,0,0,0.2)';
  hideBtn.style.background = '#fff';
  hideBtn.style.cursor = 'pointer';
  hideBtn.addEventListener('click', () => {
    root.remove();
  });

  actions.appendChild(optionsBtn);
  actions.appendChild(hideBtn);

  card.appendChild(title);
  card.appendChild(site);
  card.appendChild(body);
  card.appendChild(actions);

  root.appendChild(card);
}

export async function mountOverlay(supportedSite: SupportedSite): Promise<void> {
  const root = ensureRoot();

  const settings = await getUserSettings();
  const hasMeasurements =
    typeof settings.measurements.bustIn === 'number' ||
    typeof settings.measurements.waistIn === 'number' ||
    typeof settings.measurements.hipsIn === 'number';

  const summary = hasMeasurements
    ? `Vanity sizing: ready (fit pref: ${settings.fitPreference}). Pink tax: ready for side-by-side compare.`
    : 'Set your measurements in Options to enable vanity sizing suggestions.';

  render(root, { supportedSite }, summary);
}

