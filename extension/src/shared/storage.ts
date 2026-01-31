export type FitPreference = 'fitted' | 'regular' | 'relaxed';

export type Measurements = {
  readonly bustIn?: number;
  readonly waistIn?: number;
  readonly hipsIn?: number;
};

export type UserSettings = {
  readonly measurements: Measurements;
  readonly fitPreference: FitPreference;
};

export type WidgetPosition = {
  readonly left: number;
  readonly top: number;
};

const DEFAULT_SETTINGS: UserSettings = {
  measurements: {},
  fitPreference: 'regular',
};

const SETTINGS_KEY = 'pinkvanity:userSettings' as const;
const WIDGET_POSITION_KEY = 'pinkvanity:widgetPosition' as const;

export async function getUserSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const value = result[SETTINGS_KEY] as unknown;
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;

  // Minimal runtime shaping without pulling in a schema library for hackathon speed.
  const maybe = value as Partial<UserSettings>;
  const fitPreference: FitPreference =
    maybe.fitPreference === 'fitted' || maybe.fitPreference === 'relaxed'
      ? maybe.fitPreference
      : 'regular';

  const measurements = (maybe.measurements ?? {}) as Partial<Measurements>;

  return {
    measurements: {
      bustIn: typeof measurements.bustIn === 'number' ? measurements.bustIn : undefined,
      waistIn:
        typeof measurements.waistIn === 'number' ? measurements.waistIn : undefined,
      hipsIn: typeof measurements.hipsIn === 'number' ? measurements.hipsIn : undefined,
    },
    fitPreference,
  };
}

export async function setUserSettings(next: UserSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
}

export async function resetUserSettings(): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
}

export async function getWidgetPosition(): Promise<WidgetPosition | null> {
  const result = await chrome.storage.local.get(WIDGET_POSITION_KEY);
  const value = result[WIDGET_POSITION_KEY] as unknown;
  if (!value || typeof value !== 'object') return null;

  const maybe = value as Partial<WidgetPosition>;
  if (typeof maybe.left !== 'number' || typeof maybe.top !== 'number') return null;
  if (!Number.isFinite(maybe.left) || !Number.isFinite(maybe.top)) return null;
  return { left: maybe.left, top: maybe.top };
}

export async function setWidgetPosition(pos: WidgetPosition): Promise<void> {
  await chrome.storage.local.set({ [WIDGET_POSITION_KEY]: pos });
}

