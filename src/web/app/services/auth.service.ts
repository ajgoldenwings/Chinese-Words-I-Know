import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Amplify } from 'aws-amplify';
import {
  confirmResetPassword,
  confirmSignUp,
  getCurrentUser,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import { environment } from '../../environments/environment';

export interface AuthConfig {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
}

/** Cognito settings. Defaults to the build environment; tests can override it. */
export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    userPoolId: environment.userPoolId,
    userPoolClientId: environment.userPoolClientId,
    region: environment.region,
  }),
});

/** Which field an error belongs to, when the treatment is inline. */
export type AuthField = 'email' | 'password' | 'code';

/** Error treatment from ux/error-handling.md. */
export type AuthFailure =
  | { treatment: 'inline'; field: AuthField; message: string }
  | { treatment: 'modal'; message: string; actionLabel: string }
  | { treatment: 'toast'; message: string };

export type AuthResult<T = void> = { ok: true; value: T } | { ok: false; failure: AuthFailure };

/** Where a sign-up or sign-in left off. */
export type SignUpStep = 'confirm' | 'done';
export type SignInStep = 'done' | 'confirm-sign-up';

const NOT_SET_UP = 'Saving to the cloud is not set up in this version of the app yet.';

/**
 * Account flows on top of Amplify Auth. Amplify is configured only when the
 * user pool values are present; otherwise every call fails with a plain message.
 * Errors are mapped to parent-friendly text and a treatment. Raw errors are logged only.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(AUTH_CONFIG);
  private readonly _email = signal<string | null>(null);
  private readonly _busy = signal(false);
  private initialised = false;

  /** True when Cognito values are set and Amplify is configured. */
  readonly configured = computed(() => this.isConfigured());
  /** Email of the signed-in account, or null when signed out. */
  readonly email = this._email.asReadonly();
  readonly signedIn = computed(() => this._email() !== null);
  readonly busy = this._busy.asReadonly();

  private isConfigured(): boolean {
    return !!this.config.userPoolId && !!this.config.userPoolClientId;
  }

  /** Configures Amplify once, only when the values are set. Returns false when not set up. */
  private ensureConfigured(): boolean {
    if (!this.isConfigured()) return false;
    if (!this.initialised) {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: this.config.userPoolId,
            userPoolClientId: this.config.userPoolClientId,
          },
        },
      });
      this.initialised = true;
    }
    return true;
  }

  /** Restores the signed-in state from stored tokens. Never throws. */
  async restore(): Promise<void> {
    if (!this.ensureConfigured()) return;
    try {
      const user = await getCurrentUser();
      this._email.set(user.signInDetails?.loginId ?? user.username);
    } catch {
      this._email.set(null);
    }
  }

  signUp(email: string, password: string): Promise<AuthResult<SignUpStep>> {
    return this.run(async () => {
      const out = await signUp({
        username: email.trim(),
        password,
        options: { userAttributes: { email: email.trim() } },
      });
      return out.nextStep.signUpStep === 'DONE' ? 'done' : 'confirm';
    });
  }

  confirmSignUp(email: string, code: string): Promise<AuthResult> {
    return this.run(async () => {
      await confirmSignUp({ username: email.trim(), confirmationCode: code.trim() });
    });
  }

  resendCode(email: string): Promise<AuthResult> {
    return this.run(async () => {
      await resendSignUpCode({ username: email.trim() });
    });
  }

  signIn(email: string, password: string): Promise<AuthResult<SignInStep>> {
    return this.run(async () => {
      try {
        const out = await signIn({ username: email.trim(), password });
        if (out.nextStep.signInStep === 'CONFIRM_SIGN_UP') return 'confirm-sign-up';
        if (!out.isSignedIn) throw new Error(`Unsupported sign-in step ${out.nextStep.signInStep}`);
      } catch (err) {
        // Already signed in on this device: treat as success.
        if (errorName(err) !== 'UserAlreadyAuthenticatedException') throw err;
      }
      this._email.set(email.trim());
      return 'done';
    });
  }

  /** Sends a reset code to the email address. */
  requestPasswordReset(email: string): Promise<AuthResult> {
    return this.run(async () => {
      await resetPassword({ username: email.trim() });
    });
  }

  confirmPasswordReset(email: string, code: string, newPassword: string): Promise<AuthResult> {
    return this.run(async () => {
      await confirmResetPassword({
        username: email.trim(),
        confirmationCode: code.trim(),
        newPassword,
      });
    });
  }

  /** Clears tokens. Local progress stays on the device. Signs out locally even if the network fails. */
  async signOut(): Promise<AuthResult> {
    this._email.set(null);
    if (!this.ensureConfigured()) return { ok: true, value: undefined };
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out failed', err);
    }
    return { ok: true, value: undefined };
  }

  private async run<T>(action: () => Promise<T>): Promise<AuthResult<T>> {
    if (!this.ensureConfigured()) {
      return { ok: false, failure: { treatment: 'modal', message: NOT_SET_UP, actionLabel: 'OK' } };
    }
    this._busy.set(true);
    try {
      return { ok: true, value: await action() };
    } catch (err) {
      console.warn('Account request failed', err);
      return { ok: false, failure: toFailure(err) };
    } finally {
      this._busy.set(false);
    }
  }
}

function errorName(err: unknown): string {
  return typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
}

/** Maps an Amplify/Cognito error to plain text for a parent and a treatment. */
export function toFailure(err: unknown): AuthFailure {
  switch (errorName(err)) {
    case 'InvalidParameterException':
    case 'InvalidPasswordException':
      return {
        treatment: 'inline',
        field: 'password',
        message: 'Please choose a password with at least 8 characters, including upper and lower case letters and a number.',
      };
    case 'UsernameExistsException':
      return {
        treatment: 'inline',
        field: 'email',
        message: 'There is already an account with this email. Try signing in instead.',
      };
    case 'CodeMismatchException':
      return { treatment: 'inline', field: 'code', message: 'That code does not match. Please check the email and try again.' };
    case 'ExpiredCodeException':
      return { treatment: 'inline', field: 'code', message: 'That code has expired. Ask for a new one and try again.' };
    case 'UserNotFoundException':
    case 'NotAuthorizedException':
      return {
        treatment: 'modal',
        message: 'The email or password is not right. Please check them and try again.',
        actionLabel: 'Try again',
      };
    case 'UserNotConfirmedException':
      return {
        treatment: 'modal',
        message: 'This email has not been verified yet. Enter the code we emailed you.',
        actionLabel: 'Enter code',
      };
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return {
        treatment: 'modal',
        message: 'Too many tries. Please wait a few minutes and try again.',
        actionLabel: 'OK',
      };
    case 'NetworkError':
      return { treatment: 'toast', message: 'No internet connection. Please try again when you are online.' };
    default:
      return {
        treatment: 'modal',
        message: 'Something went wrong. Please try again in a moment.',
        actionLabel: 'Try again',
      };
  }
}
