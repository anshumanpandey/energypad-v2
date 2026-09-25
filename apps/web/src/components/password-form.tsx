import { ArrowUpRight } from 'lucide-react';
import { SubmitButton } from './submit-button';

export function PasswordForm({
  action,
  mode,
  callbackUrl,
}: {
  action: (form: FormData) => Promise<void>;
  mode: 'login' | 'signup';
  callbackUrl: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label>
        Email address
        <input name="email" type="email" placeholder="you@company.com" autoComplete="email" required maxLength={254} />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={mode === 'signup' ? 12 : undefined}
          maxLength={128}
          aria-describedby={mode === 'signup' ? 'password-help' : undefined}
        />
      </label>
      {mode === 'signup' && (
        <small id="password-help" className="muted">
          Use 12–128 characters. A longer passphrase works well.
        </small>
      )}
      {mode === 'signup' && (
        <label>
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
      )}
      <SubmitButton>
        {mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowUpRight size={17} />
      </SubmitButton>
    </form>
  );
}
