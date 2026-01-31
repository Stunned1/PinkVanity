import { getUserSettings, getWidgetPosition, setWidgetPosition } from '../../shared/storage';
import type { SupportedSite } from '../sites';
import { el, setStyles } from './dom';
import { createSettingsForm } from './settings-form';
import { fontFamily, theme } from './theme';

const WIDGET_ROOT_ID = 'pinkvanity-root';

type WidgetState = {
  expanded: boolean;
  settingsSavedAt?: number;
};

function ensureRoot(): HTMLElement {
  const existing = document.getElementById(WIDGET_ROOT_ID);
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = WIDGET_ROOT_ID;
  setStyles(root, {
    zIndex: '2147483647',
    position: 'fixed',
    right: '16px',
    top: '16px',
    width: '340px',
    pointerEvents: 'none',
  });

  document.documentElement.appendChild(root);
  return root;
}

function buttonStyles(): Partial<CSSStyleDeclaration> {
  return {
    padding: '8px 10px',
    borderRadius: '10px',
    border: `1px solid ${theme.btnBorder}`,
    background: theme.btnBg,
    color: theme.text,
    cursor: 'pointer',
    fontFamily,
    fontSize: '13px',
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

type WidgetUi = {
  readonly root: HTMLElement;
  readonly card: HTMLElement;
  readonly dragHandle: HTMLElement;
  readonly toggleBtn: HTMLButtonElement;
  readonly summaryEl: HTMLElement;
  readonly savedEl: HTMLElement;
  readonly panelOuter: HTMLElement;
  readonly panelInner: HTMLElement;
};

function createUi(root: HTMLElement, supportedSite: SupportedSite): WidgetUi {
  root.innerHTML = '';

  const dragTab = el('div');
  setStyles(dragTab, {
    pointerEvents: 'auto',
    width: '132px',
    height: '22px',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: '8px',
    borderRadius: '999px',
    background: 'rgba(20, 20, 26, 0.92)',
    border: '1px solid rgba(255, 182, 193, 0.22)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.40)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'grab',
    userSelect: 'none',
  });
  dragTab.setAttribute('aria-label', 'Drag PinkVanity widget');

  const grip = el('div', { text: '⋮⋮' });
  setStyles(grip, {
    color: theme.pink,
    fontSize: '14px',
    lineHeight: '1',
    letterSpacing: '2px',
    transform: 'translateY(-1px)',
  });

  const dragText = el('div', { text: 'Drag' });
  setStyles(dragText, { color: theme.muted, fontSize: '12px' });

  dragTab.appendChild(grip);
  dragTab.appendChild(dragText);

  root.appendChild(dragTab);

  const card = el('div');
  setStyles(card, {
    pointerEvents: 'auto',
    borderRadius: '14px',
    padding: '12px',
    background: theme.bg,
    color: theme.text,
    boxShadow: '0 14px 50px rgba(0,0,0,0.55)',
    backdropFilter: 'blur(8px)',
    fontFamily,
  });

  const header = el('div');
  setStyles(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  });

  const titleWrap = el('div');
  setStyles(titleWrap, { userSelect: 'none' });
  const title = el('div', { text: 'PinkVanity' });
  setStyles(title, { fontWeight: '800', color: theme.pink, lineHeight: '1.1' });
  const subtitle = el('div', { text: `AE / ZARA / H&M • ${supportedSite}` });
  setStyles(subtitle, { fontSize: '12px', color: theme.muted, marginTop: '2px' });
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const headerActions = el('div');
  setStyles(headerActions, { display: 'flex', gap: '8px' });

  const toggle = el('button', { text: 'Expand' }) as HTMLButtonElement;
  setStyles(toggle, buttonStyles());

  const hide = el('button', { text: 'Hide' });
  setStyles(hide, buttonStyles());
  hide.addEventListener('click', () => root.remove());

  headerActions.appendChild(toggle);
  headerActions.appendChild(hide);

  header.appendChild(titleWrap);
  header.appendChild(headerActions);

  const divider = el('div');
  setStyles(divider, {
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
    marginTop: '10px',
    marginBottom: '10px',
  });

  const summary = el('div');
  setStyles(summary, { fontSize: '13px', lineHeight: '1.35' });

  const saved = el('div');
  setStyles(saved, { fontSize: '12px', color: theme.muted, marginTop: '8px' });
  saved.textContent = '';

  card.appendChild(header);
  card.appendChild(divider);
  card.appendChild(summary);
  card.appendChild(saved);

  const panelOuter = el('div');
  setStyles(panelOuter, {
    overflow: 'hidden',
    maxHeight: '0px',
    opacity: '0',
    transform: 'translateY(-4px)',
    transition: 'max-height 220ms ease, opacity 220ms ease, transform 220ms ease',
    willChange: 'max-height, opacity, transform',
    marginTop: '12px',
  });
  const panelInner = el('div');
  panelOuter.appendChild(panelInner);
  card.appendChild(panelOuter);

  root.appendChild(card);

  return {
    root,
    card,
    dragHandle: dragTab,
    toggleBtn: toggle,
    summaryEl: summary,
    savedEl: saved,
    panelOuter,
    panelInner,
  };
}

async function syncSummary(ui: WidgetUi, state: WidgetState): Promise<void> {
  const settings = await getUserSettings();
  const hasMeasurements =
    typeof settings.measurements.bustIn === 'number' ||
    typeof settings.measurements.waistIn === 'number' ||
    typeof settings.measurements.hipsIn === 'number';

  ui.summaryEl.textContent = hasMeasurements
    ? `Vanity sizing: ready (fit: ${settings.fitPreference}). Pink tax: ready for side-by-side compare.`
    : 'Vanity sizing: add your measurements to get a size recommendation.';

  ui.savedEl.textContent = typeof state.settingsSavedAt === 'number' ? 'Saved.' : '';
}

function setExpanded(ui: WidgetUi, state: WidgetState, expanded: boolean): void {
  state.expanded = expanded;
  ui.toggleBtn.textContent = expanded ? 'Collapse' : 'Expand';

  if (!expanded) {
    ui.panelOuter.style.maxHeight = '0px';
    ui.panelOuter.style.opacity = '0';
    ui.panelOuter.style.transform = 'translateY(-4px)';
    return;
  }

  // Measure content and animate.
  ui.panelOuter.style.opacity = '1';
  ui.panelOuter.style.transform = 'translateY(0px)';
  const h = ui.panelInner.scrollHeight;
  ui.panelOuter.style.maxHeight = `${h}px`;
}

function installDrag(ui: WidgetUi): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const margin = 8;

  const onMove = (ev: PointerEvent) => {
    if (!isDragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    const rect = ui.card.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;

    const nextLeft = clamp(startLeft + dx, margin, Math.max(margin, maxLeft));
    const nextTop = clamp(startTop + dy, margin, Math.max(margin, maxTop));

    ui.root.style.left = `${nextLeft}px`;
    ui.root.style.top = `${nextTop}px`;
    ui.root.style.right = '';
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    ui.dragHandle.style.cursor = 'grab';

    const left = Number.parseFloat(ui.root.style.left);
    const top = Number.parseFloat(ui.root.style.top);
    if (Number.isFinite(left) && Number.isFinite(top)) {
      void setWidgetPosition({ left, top });
    }
  };

  ui.dragHandle.addEventListener('pointerdown', (ev: PointerEvent) => {
    // Only left click / primary pointer.
    if (ev.button !== 0) return;
    isDragging = true;
    ui.dragHandle.style.cursor = 'grabbing';

    const rootRect = ui.root.getBoundingClientRect();
    startX = ev.clientX;
    startY = ev.clientY;
    startLeft = rootRect.left;
    startTop = rootRect.top;

    // Switch to left/top anchoring for dragging.
    ui.root.style.left = `${startLeft}px`;
    ui.root.style.top = `${startTop}px`;
    ui.root.style.right = '';

    ui.dragHandle.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  ui.dragHandle.addEventListener('pointermove', onMove);
  ui.dragHandle.addEventListener('pointerup', endDrag);
  ui.dragHandle.addEventListener('pointercancel', endDrag);
}

export async function mountWidget(supportedSite: SupportedSite): Promise<void> {
  const root = ensureRoot();
  const state: WidgetState = { expanded: false };

  const savedPos = await getWidgetPosition();
  if (savedPos) {
    root.style.left = `${savedPos.left}px`;
    root.style.top = `${savedPos.top}px`;
    root.style.right = '';
  }

  const ui = createUi(root, supportedSite);
  await syncSummary(ui, state);

  installDrag(ui);

  // Load and attach the settings form once (no rerenders = smooth UX).
  const form = await createSettingsForm({
    onSaved: () => {
      state.settingsSavedAt = Date.now();
      void syncSummary(ui, state);

      // If expanded, re-measure the panel to keep animation correct.
      if (state.expanded) {
        requestAnimationFrame(() => setExpanded(ui, state, true));
      }
    },
  });
  ui.panelInner.appendChild(form);

  ui.toggleBtn.addEventListener('click', () => {
    setExpanded(ui, state, !state.expanded);
  });

  // Ensure correct maxHeight after async form insert when expanded later.
  setExpanded(ui, state, false);
}

