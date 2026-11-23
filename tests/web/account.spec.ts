import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STORAGE, AppStore, MemoryStorage, createDefaultWordState } from '@shared/store';
import { NotificationService } from '../../src/web/app/components';
import { HomeComponent } from '../../src/web/app/screens/home/home.component';
import { AUTH_CONFIG, AuthService } from '../../src/web/app/services/auth.service';

const amplify = vi.hoisted(() => ({
  configure: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('aws-amplify', () => ({ Amplify: { configure: amplify.configure } }));
vi.mock('aws-amplify/auth', () => ({
  signUp: amplify.signUp,
  confirmSignUp: amplify.confirmSignUp,
  resendSignUpCode: amplify.resendSignUpCode,
  signIn: amplify.signIn,
  signOut: amplify.signOut,
  resetPassword: amplify.resetPassword,
  confirmResetPassword: amplify.confirmResetPassword,
  getCurrentUser: amplify.getCurrentUser,
}));

const CONFIG = { userPoolId: 'pool', userPoolClientId: 'client', region: 'us-east-1' };
const err = (name: string) => Object.assign(new Error(name), { name });

function setup(config = CONFIG) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '', component: HomeComponent }]),
      { provide: APP_STORAGE, useValue: new MemoryStorage() },
      { provide: AUTH_CONFIG, useValue: config },
    ],
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  for (const fn of Object.values(amplify)) fn.mockReset();
  amplify.getCurrentUser.mockRejectedValue(err('UserUnAuthenticatedException'));
});

describe('AuthService', () => {
  it('sign up succeeds and asks for the code', async () => {
    setup();
    amplify.signUp.mockResolvedValue({ nextStep: { signUpStep: 'CONFIRM_SIGN_UP' } });
    const r = await TestBed.inject(AuthService).signUp(' a@b.co ', 'Passw0rdx');
    expect(r).toEqual({ ok: true, value: 'confirm' });
    expect(amplify.signUp.mock.calls[0][0].username).toBe('a@b.co');
  });

  it('sign up with an existing email fails inline on the email field', async () => {
    setup();
    amplify.signUp.mockRejectedValue(err('UsernameExistsException'));
    const r = await TestBed.inject(AuthService).signUp('a@b.co', 'Passw0rdx');
    expect(r.ok === false && r.failure).toMatchObject({ treatment: 'inline', field: 'email' });
  });

  it('confirm code succeeds, and a wrong code fails inline on the code field', async () => {
    setup();
    const auth = TestBed.inject(AuthService);
    amplify.confirmSignUp.mockResolvedValueOnce({});
    expect((await auth.confirmSignUp('a@b.co', '123456')).ok).toBe(true);
    amplify.confirmSignUp.mockRejectedValueOnce(err('CodeMismatchException'));
    const r = await auth.confirmSignUp('a@b.co', '000000');
    expect(r.ok === false && r.failure).toMatchObject({ treatment: 'inline', field: 'code' });
  });

  it('sign in succeeds and sets the email', async () => {
    setup();
    const auth = TestBed.inject(AuthService);
    amplify.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    expect(await auth.signIn('a@b.co', 'pw')).toEqual({ ok: true, value: 'done' });
    expect(auth.signedIn()).toBe(true);
    expect(auth.email()).toBe('a@b.co');
  });

  it('sign in with a bad password fails with a modal and stays signed out', async () => {
    setup();
    const auth = TestBed.inject(AuthService);
    amplify.signIn.mockRejectedValue(err('NotAuthorizedException'));
    const r = await auth.signIn('a@b.co', 'bad');
    expect(r.ok === false && r.failure.treatment).toBe('modal');
    expect(auth.signedIn()).toBe(false);
  });

  it('sign in with an offline network fails with a toast', async () => {
    setup();
    amplify.signIn.mockRejectedValue(err('NetworkError'));
    const r = await TestBed.inject(AuthService).signIn('a@b.co', 'pw');
    expect(r.ok === false && r.failure.treatment).toBe('toast');
  });

  it('reset password: request and confirm succeed, an expired code fails inline', async () => {
    setup();
    const auth = TestBed.inject(AuthService);
    amplify.resetPassword.mockResolvedValue({});
    amplify.confirmResetPassword.mockResolvedValueOnce(undefined);
    expect((await auth.requestPasswordReset('a@b.co')).ok).toBe(true);
    expect((await auth.confirmPasswordReset('a@b.co', '123456', 'Passw0rdx')).ok).toBe(true);
    amplify.confirmResetPassword.mockRejectedValueOnce(err('ExpiredCodeException'));
    const r = await auth.confirmPasswordReset('a@b.co', '1', 'Passw0rdx');
    expect(r.ok === false && r.failure).toMatchObject({ treatment: 'inline', field: 'code' });
  });

  it('sign out clears the email, and still signs out locally when the network fails', async () => {
    setup();
    const auth = TestBed.inject(AuthService);
    amplify.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    await auth.signIn('a@b.co', 'pw');
    amplify.signOut.mockRejectedValue(err('NetworkError'));
    expect((await auth.signOut()).ok).toBe(true);
    expect(auth.signedIn()).toBe(false);
  });

  it('fails with a plain modal and never calls Amplify when Cognito is not set up', async () => {
    setup({ userPoolId: '', userPoolClientId: '', region: '' });
    const r = await TestBed.inject(AuthService).signIn('a@b.co', 'pw');
    expect(r.ok === false && r.failure.treatment).toBe('modal');
    expect(amplify.signIn).not.toHaveBeenCalled();
    expect(amplify.configure).not.toHaveBeenCalled();
  });
});

describe('Account panel', () => {
  async function open() {
    setup();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    harness.detectChanges();
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const click = (id: string) => {
      q(id)!.click();
      harness.detectChanges();
    };
    const type = (id: string, value: string) => {
      const el = q(id) as HTMLInputElement;
      el.value = value;
      el.dispatchEvent(new Event('input'));
      harness.detectChanges();
    };
    const settle = async () => {
      await new Promise((r) => setTimeout(r));
      harness.detectChanges();
    };
    const submit = async () => {
      click('account-submit');
      await settle();
    };
    click('settings');
    click('toggle-cloudSyncEnabled');
    return { harness, q, click, type, submit, settle };
  }

  it('shows inline errors for empty fields without calling Amplify', async () => {
    const { q, submit } = await open();
    await submit();
    expect(document.body.textContent).toContain('Please enter your email address.');
    expect(q('account-panel')).not.toBeNull();
    expect(amplify.signIn).not.toHaveBeenCalled();
  });

  it('sign-in failure opens a modal and keeps the panel open', async () => {
    const { q, type, submit } = await open();
    amplify.signIn.mockRejectedValue(err('NotAuthorizedException'));
    type('account-email', 'a@b.co');
    type('account-password', 'wrongpass');
    await submit();
    expect(TestBed.inject(NotificationService).modal()?.actionLabel).toBe('Try again');
    expect(q('account-panel')).not.toBeNull();
  });

  it('sign-up flow: create, then verify, lands on sign in with a toast', async () => {
    const { q, click, type, submit } = await open();
    const notes = TestBed.inject(NotificationService);
    click('account-go-sign-up');
    amplify.signUp.mockResolvedValue({ nextStep: { signUpStep: 'CONFIRM_SIGN_UP' } });
    type('account-email', 'a@b.co');
    type('account-password', 'Passw0rdx');
    await submit();
    expect(q('account-code')).not.toBeNull();
    amplify.confirmSignUp.mockRejectedValueOnce(err('CodeMismatchException'));
    type('account-code', '000000');
    await submit();
    expect(document.body.textContent).toContain('That code does not match');
    amplify.confirmSignUp.mockResolvedValueOnce({});
    type('account-code', '123456');
    await submit();
    expect(q('account-password')).not.toBeNull();
    expect(notes.toasts().map((t) => t.message)).toContain('Email verified. Please sign in.');
  });

  it('reset password flow moves from email to code and back to sign in', async () => {
    const { q, click, type, submit } = await open();
    const notes = TestBed.inject(NotificationService);
    click('account-go-forgot');
    amplify.resetPassword.mockResolvedValue({});
    type('account-email', 'a@b.co');
    await submit();
    expect(q('account-code')).not.toBeNull();
    amplify.confirmResetPassword.mockResolvedValue(undefined);
    type('account-code', '123456');
    type('account-password', 'NewPassw0rd');
    await submit();
    expect(notes.toasts().map((t) => t.message)).toContain('Password changed. Please sign in.');
    expect(q('account-go-forgot')).not.toBeNull();
  });

  it('unverified sign-in modal action jumps to the code view', async () => {
    const { q, type, submit } = await open();
    const notes = TestBed.inject(NotificationService);
    amplify.signIn.mockRejectedValue(err('UserNotConfirmedException'));
    type('account-email', 'a@b.co');
    type('account-password', 'Passw0rdx');
    await submit();
    expect(notes.modal()?.actionLabel).toBe('Enter code');
    notes.confirmModal();
    TestBed.tick();
    expect(q('account-code')).not.toBeNull();
    expect(q('account-resend')).not.toBeNull();
  });

  it('sign-in success turns on Save to Cloud and closes the panel', async () => {
    const { harness, q, type, submit } = await open();
    const store = TestBed.inject(AppStore);
    expect(store.settings().cloudSyncEnabled).toBe(false);
    amplify.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    type('account-email', 'a@b.co');
    type('account-password', 'Passw0rdx');
    await submit();
    harness.detectChanges();
    expect(store.settings().cloudSyncEnabled).toBe(true);
    expect(q('account-panel')).toBeNull();
    expect((q('toggle-cloudSyncEnabled') as HTMLInputElement).checked).toBe(true);
  });

  it('turning Save to Cloud off signs out and keeps word states untouched', async () => {
    const { harness, q, click, type, submit } = await open();
    const store = TestBed.inject(AppStore);
    store.setWordState({ ...createDefaultWordState('cat'), confidenceScore: 0.67, timesSeenCount: 3 });
    const before = structuredClone(store.wordStates());
    amplify.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    type('account-email', 'a@b.co');
    type('account-password', 'Passw0rdx');
    await submit();
    harness.detectChanges();
    amplify.signOut.mockResolvedValue(undefined);
    click('toggle-cloudSyncEnabled');
    await harness.fixture.whenStable();
    expect(amplify.signOut).toHaveBeenCalled();
    expect(TestBed.inject(AuthService).signedIn()).toBe(false);
    expect(store.settings().cloudSyncEnabled).toBe(false);
    expect(store.wordStates()).toEqual(before);
    expect(q('account-panel')).toBeNull();
  });

  it('signing out of a restored session leaves word states untouched', async () => {
    setup();
    const store = TestBed.inject(AppStore);
    store.setWordState({ ...createDefaultWordState('cat'), confidenceScore: 0.5, timesSeenCount: 1 });
    const before = structuredClone(store.wordStates());
    amplify.getCurrentUser.mockResolvedValue({ username: 'u', signInDetails: { loginId: 'a@b.co' } });
    amplify.signOut.mockResolvedValue(undefined);
    const auth = TestBed.inject(AuthService);
    await auth.restore();
    expect(auth.email()).toBe('a@b.co');
    await auth.signOut();
    expect(auth.signedIn()).toBe(false);
    expect(store.wordStates()).toEqual(before);
  });
});
