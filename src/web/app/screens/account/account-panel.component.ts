import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, model, signal, untracked } from '@angular/core';
import { AppStore } from '@shared/store';
import { FieldErrorComponent, NotificationService } from '../../components';
import { AuthService, type AuthFailure, type AuthField } from '../../services/auth.service';

export type AccountView = 'sign-in' | 'sign-up' | 'confirm' | 'forgot' | 'reset' | 'account';

const FIELD_IDS: Record<AuthField, string> = {
  email: 'account-email',
  password: 'account-password',
  code: 'account-code',
};

const BUTTON = 'min-h-11 min-w-11 w-full rounded-xl px-5 py-3 text-lg font-semibold';
const PRIMARY = `${BUTTON} bg-slate-800 dark:bg-slate-200 text-white disabled:opacity-60 dark:text-slate-900`;
const LINK = 'min-h-11 min-w-11 px-2 text-base font-medium text-slate-700 dark:text-slate-200 underline';
const INPUT = 'min-h-11 w-full rounded-lg border-2 border-slate-400 dark:border-slate-500 px-3 py-2 text-lg';

/**
 * Account overlay: sign up, verify, sign in, reset password, sign out.
 * Opened by setting `open` (two-way bindable), e.g. from the Save to Cloud button.
 * Bind it with `[(open)]="someSignal"`.
 */
@Component({
  selector: 'app-account-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldErrorComponent, NgTemplateOutlet],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-40 flex justify-end bg-black/40" data-testid="account-backdrop" (click)="close()">
        <section
          class="flex h-full w-full max-w-sm flex-col gap-3 overflow-y-auto bg-white dark:bg-slate-900 p-5 text-slate-900 dark:text-slate-100 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-title"
          data-testid="account-panel"
          (click)="$event.stopPropagation()"
        >
          <header class="flex items-center justify-between">
            <h2 id="account-title" class="text-2xl font-semibold">{{ title() }}</h2>
            <button
              type="button"
              class="flex min-h-11 min-w-11 items-center justify-center rounded-full text-2xl"
              aria-label="Close account"
              data-testid="account-close"
              (click)="close()"
            >
              ✕
            </button>
          </header>

          @switch (view()) {
            @case ('account') {
              <p class="text-lg" data-testid="account-signed-in">Signed in as {{ auth.email() }}.</p>
              <p class="text-base text-slate-600 dark:text-slate-300">Your progress on this device stays here when you sign out.</p>
              <button type="button" [class]="primary" data-testid="account-sign-out" (click)="signOut()">Logout</button>
            }
            @case ('sign-in') {
              <form class="flex flex-col gap-3" novalidate (submit)="submit($event)">
                <ng-container *ngTemplateOutlet="emailField" />
                <ng-container *ngTemplateOutlet="passwordField" />
                <button type="submit" [class]="primary" [disabled]="auth.busy()" data-testid="account-submit">Sign in</button>
              </form>
              <button type="button" [class]="link" data-testid="account-go-forgot" (click)="go('forgot')">Forgot your password?</button>
              <button type="button" [class]="link" data-testid="account-go-sign-up" (click)="go('sign-up')">Create account</button>
            }
            @case ('sign-up') {
              <form class="flex flex-col gap-3" novalidate (submit)="submit($event)">
                <ng-container *ngTemplateOutlet="emailField" />
                <ng-container *ngTemplateOutlet="passwordField" />
                <p class="text-sm text-slate-600 dark:text-slate-300">At least 8 characters, with upper and lower case letters and a number.</p>
                <button type="submit" [class]="primary" [disabled]="auth.busy()" data-testid="account-submit">Create account</button>
              </form>
              <button type="button" [class]="link" data-testid="account-go-sign-in" (click)="go('sign-in')">I already have an account</button>
            }
            @case ('confirm') {
              <form class="flex flex-col gap-3" novalidate (submit)="submit($event)">
                <p class="text-base">We emailed a code to {{ email() }}. Enter it below.</p>
                <ng-container *ngTemplateOutlet="codeField" />
                <button type="submit" [class]="primary" [disabled]="auth.busy()" data-testid="account-submit">Verify email</button>
              </form>
              <button type="button" [class]="link" data-testid="account-resend" (click)="resend()">Send a new code</button>
              <button type="button" [class]="link" data-testid="account-go-sign-in" (click)="go('sign-in')">Back to sign in</button>
            }
            @case ('forgot') {
              <form class="flex flex-col gap-3" novalidate (submit)="submit($event)">
                <p class="text-base">Enter your email and we will send you a code to choose a new password.</p>
                <ng-container *ngTemplateOutlet="emailField" />
                <button type="submit" [class]="primary" [disabled]="auth.busy()" data-testid="account-submit">Send code</button>
              </form>
              <button type="button" [class]="link" data-testid="account-go-sign-in" (click)="go('sign-in')">Back to sign in</button>
            }
            @case ('reset') {
              <form class="flex flex-col gap-3" novalidate (submit)="submit($event)">
                <p class="text-base">We emailed a code to {{ email() }}. Enter it and choose a new password.</p>
                <ng-container *ngTemplateOutlet="codeField" />
                <ng-container *ngTemplateOutlet="passwordField" />
                <button type="submit" [class]="primary" [disabled]="auth.busy()" data-testid="account-submit">Set new password</button>
              </form>
              <button type="button" [class]="link" data-testid="account-go-sign-in" (click)="go('sign-in')">Back to sign in</button>
            }
          }
        </section>
      </div>
    }

    <ng-template #emailField>
      <div>
        <label for="account-email" class="block text-lg font-medium">Email</label>
        <input
          id="account-email"
          type="email"
          autocomplete="email"
          [class]="input"
          [value]="email()"
          [attr.aria-describedby]="'account-email-error'"
          data-testid="account-email"
          (input)="email.set($any($event.target).value); clear('email')"
        />
        <app-field-error fieldId="account-email" />
      </div>
    </ng-template>
    <ng-template #passwordField>
      <div>
        <label for="account-password" class="block text-lg font-medium">
          {{ view() === 'reset' ? 'New password' : 'Password' }}
        </label>
        <input
          id="account-password"
          type="password"
          [attr.autocomplete]="view() === 'sign-in' ? 'current-password' : 'new-password'"
          [class]="input"
          [value]="password()"
          [attr.aria-describedby]="'account-password-error'"
          data-testid="account-password"
          (input)="password.set($any($event.target).value); clear('password')"
        />
        <app-field-error fieldId="account-password" />
      </div>
    </ng-template>
    <ng-template #codeField>
      <div>
        <label for="account-code" class="block text-lg font-medium">Code from the email</label>
        <input
          id="account-code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          [class]="input"
          [value]="code()"
          [attr.aria-describedby]="'account-code-error'"
          data-testid="account-code"
          (input)="code.set($any($event.target).value); clear('code')"
        />
        <app-field-error fieldId="account-code" />
      </div>
    </ng-template>
  `,
})
export class AccountPanelComponent {
  protected readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(AppStore);

  /** Two-way bindable. Set to true to show the panel. */
  readonly open = model(false);
  readonly view = signal<AccountView>('sign-in');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly code = signal('');

  protected readonly primary = PRIMARY;
  protected readonly link = LINK;
  protected readonly input = INPUT;

  constructor() {
    void this.auth.restore();
    // Each time the panel opens, start on the right view with empty fields.
    effect(() => {
      if (this.open()) untracked(() => this.reset());
    });
  }

  protected title(): string {
    switch (this.view()) {
      case 'account':
        return 'Account';
      case 'sign-up':
        return 'Create account';
      case 'confirm':
        return 'Check your email';
      case 'forgot':
      case 'reset':
        return 'Reset password';
      default:
        return 'Sign in';
    }
  }

  private reset(): void {
    this.clearAll();
    this.password.set('');
    this.code.set('');
    this.view.set(this.auth.signedIn() ? 'account' : 'sign-in');
  }

  close(): void {
    this.clearAll();
    this.password.set('');
    this.open.set(false);
  }

  protected go(view: AccountView): void {
    this.clearAll();
    this.password.set('');
    this.code.set('');
    this.view.set(view);
  }

  protected clear(field: AuthField): void {
    this.notifications.clearFieldError(FIELD_IDS[field]);
  }

  private clearAll(): void {
    (Object.keys(FIELD_IDS) as AuthField[]).forEach((f) => this.clear(f));
  }

  private fieldError(field: AuthField, message: string): void {
    this.notifications.setFieldError(FIELD_IDS[field], message);
  }

  /** Checks the fields the current view needs. Returns true when all are fine. */
  private validate(): boolean {
    this.clearAll();
    const view = this.view();
    let ok = true;
    const email = this.email().trim();
    if (view !== 'confirm' && view !== 'reset') {
      if (!email) {
        this.fieldError('email', 'Please enter your email address.');
        ok = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.fieldError('email', 'That does not look like an email address. Please check it.');
        ok = false;
      }
    }
    if (view === 'sign-in' || view === 'sign-up' || view === 'reset') {
      const pw = this.password();
      if (!pw) {
        this.fieldError('password', 'Please enter a password.');
        ok = false;
      } else if (view !== 'sign-in' && pw.length < 8) {
        this.fieldError('password', 'Please use at least 8 characters.');
        ok = false;
      }
    }
    if ((view === 'confirm' || view === 'reset') && !this.code().trim()) {
      this.fieldError('code', 'Please enter the code from the email.');
      ok = false;
    }
    return ok;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.auth.busy() || !this.validate()) return;
    const email = this.email();
    switch (this.view()) {
      case 'sign-in': {
        const r = await this.auth.signIn(email, this.password());
        if (!r.ok) return this.fail(r.failure, () => this.view.set('confirm'));
        if (r.value === 'confirm-sign-up') return this.go('confirm');
        this.finish('Signed in.');
        return;
      }
      case 'sign-up': {
        const r = await this.auth.signUp(email, this.password());
        if (!r.ok) return this.fail(r.failure);
        this.password.set('');
        this.view.set('confirm');
        return;
      }
      case 'confirm': {
        const r = await this.auth.confirmSignUp(email, this.code());
        if (!r.ok) return this.fail(r.failure);
        this.notifications.showToast('Email verified. Please sign in.');
        this.code.set('');
        this.view.set('sign-in');
        return;
      }
      case 'forgot': {
        const r = await this.auth.requestPasswordReset(email);
        if (!r.ok) return this.fail(r.failure);
        this.view.set('reset');
        return;
      }
      case 'reset': {
        const r = await this.auth.confirmPasswordReset(email, this.code(), this.password());
        if (!r.ok) return this.fail(r.failure);
        this.notifications.showToast('Password changed. Please sign in.');
        this.code.set('');
        this.password.set('');
        this.view.set('sign-in');
        return;
      }
    }
  }

  protected async resend(): Promise<void> {
    const r = await this.auth.resendCode(this.email());
    if (!r.ok) return this.fail(r.failure);
    this.notifications.showToast('A new code is on its way.');
  }

  protected async signOut(): Promise<void> {
    this.store.updateSettings({ cloudSyncEnabled: false });
    await this.auth.signOut();
    this.notifications.showToast('Logged out. Your progress is saved on this device.');
    this.close();
  }

  private finish(message: string): void {
    this.store.updateSettings({ cloudSyncEnabled: true });
    this.notifications.showToast(message);
    this.close();
  }

  /** Shows a failure with its treatment. `onModalAction` overrides what a modal button does. */
  private fail(failure: AuthFailure, onModalAction?: () => void): void {
    switch (failure.treatment) {
      case 'inline':
        this.fieldError(failure.field, failure.message);
        return;
      case 'toast':
        this.notifications.showToast(failure.message);
        return;
      case 'modal':
        this.notifications.showModal({
          message: failure.message,
          actionLabel: failure.actionLabel,
          onAction: onModalAction,
        });
        return;
    }
  }
}
