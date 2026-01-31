import { logger } from '@/utils/logger';
import { err, ok, type Result } from '@/utils/result';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';
import { usernameToEmail } from '@/utils/auth/username-email';

export type AuthFailure = {
  readonly message: string;
  readonly code?: string;
};

export async function signInWithUsernameAndPassword(input: {
  readonly username: string;
  readonly password: string;
}): Promise<Result<void, AuthFailure>> {
  let email: string;
  try {
    email = usernameToEmail(input.username);
  } catch (e) {
    if (e instanceof Error) return err({ message: e.message });
    return err({ message: 'Invalid username.' });
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password
    });

    if (error) {
      return err({ message: error.message, code: String(error.status ?? '') || undefined });
    }

    return ok(undefined);
  } catch (e) {
    logger.error('Unexpected sign-in error', e);
    return err({ message: 'Unexpected error signing in. Please try again.' });
  }
}

export async function signUpWithUsernameAndPassword(input: {
  readonly username: string;
  readonly password: string;
}): Promise<Result<void, AuthFailure>> {
  let email: string;
  try {
    email = usernameToEmail(input.username);
  } catch (e) {
    if (e instanceof Error) return err({ message: e.message });
    return err({ message: 'Invalid username.' });
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          username: input.username
        }
      }
    });

    if (error) {
      return err({ message: error.message, code: String(error.status ?? '') || undefined });
    }

    return ok(undefined);
  } catch (e) {
    logger.error('Unexpected sign-up error', e);
    return err({ message: 'Unexpected error signing up. Please try again.' });
  }
}

