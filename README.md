## Wayfourth

### What you have now

- **Login page**: `app/(auth)/login/page.tsx`
- **Signup page**: `app/(auth)/signup/page.tsx`
- **Supabase browser client**: `src/utils/supabase/browser-client.ts`
- **Auth calls (sign in / sign up)**: `src/utils/auth/supabase-auth.ts`

### Where to “stick the Supabase stuff”

- **Credentials**: copy `.env.example` to `.env.local`, then fill in:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Create the Supabase client**: `src/utils/supabase/browser-client.ts`
  - This is the place to adjust client options, add headers, swap to SSR helpers, etc.
- **Call Supabase auth methods**: `src/utils/auth/supabase-auth.ts`
  - This is where `supabase.auth.signInWithPassword(...)` and `supabase.auth.signUp(...)` live.
  - Note: for hackathon “username + password”, we map username → a deterministic fake email in `src/utils/auth/username-email.ts`.

### Run it

```bash
npm install
npm run dev
```

Then open `/login` or `/signup`.
