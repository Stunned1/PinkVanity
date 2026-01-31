const HACKATHON_DOMAIN = 'hack.local';

export function usernameToEmail(rawUsername: string): string {
  const username = rawUsername.trim().toLowerCase();

  // Keep it simple and deterministic for quick testing.
  // If you want stricter rules, change this regex.
  if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(username)) {
    throw new Error('Username must be 3-32 chars (letters/numbers/._-), and start/end with a letter/number.');
  }

  return `${username}@${HACKATHON_DOMAIN}`;
}

