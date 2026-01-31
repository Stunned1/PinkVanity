import {
  getUserSettings,
  resetUserSettings,
  setUserSettings,
  type FitPreference,
} from '../shared/storage';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function setStatus(message: string): void {
  const status = byId('status');
  status.textContent = message;
}

async function load(): Promise<void> {
  const settings = await getUserSettings();

  (byId('bust') as HTMLInputElement).value = settings.measurements.bustIn?.toString() ?? '';
  (byId('waist') as HTMLInputElement).value =
    settings.measurements.waistIn?.toString() ?? '';
  (byId('hips') as HTMLInputElement).value = settings.measurements.hipsIn?.toString() ?? '';
  (byId('fitPreference') as HTMLInputElement).value = settings.fitPreference;
}

async function save(): Promise<void> {
  const bustIn = parseOptionalNumber((byId('bust') as HTMLInputElement).value);
  const waistIn = parseOptionalNumber((byId('waist') as HTMLInputElement).value);
  const hipsIn = parseOptionalNumber((byId('hips') as HTMLInputElement).value);
  const fitPreferenceRaw = (byId('fitPreference') as HTMLInputElement).value.trim();

  const fitPreference: FitPreference =
    fitPreferenceRaw === 'fitted' || fitPreferenceRaw === 'relaxed'
      ? fitPreferenceRaw
      : 'regular';

  await setUserSettings({
    measurements: { bustIn, waistIn, hipsIn },
    fitPreference,
  });

  setStatus('Saved.');
}

async function reset(): Promise<void> {
  await resetUserSettings();
  await load();
  setStatus('Reset to defaults.');
}

async function main(): Promise<void> {
  await load();

  byId('save').addEventListener('click', () => {
    void save().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Save failed.');
    });
  });

  byId('reset').addEventListener('click', () => {
    void reset().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Reset failed.');
    });
  });
}

void main();

