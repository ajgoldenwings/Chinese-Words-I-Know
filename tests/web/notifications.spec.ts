import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  FieldErrorComponent,
  NotificationHostComponent,
  NotificationService,
  TOAST_DURATION_MS,
} from '../../src/web/app/components';

@Component({
  imports: [FieldErrorComponent, NotificationHostComponent],
  template: `
    <input id="email" aria-describedby="email-error" />
    <app-field-error fieldId="email" />
    <button id="under" type="button" (click)="clicks = clicks + 1">Under</button>
    <app-notification-host />
  `,
})
class HostComponent {
  clicks = 0;
}

describe('feedback components', () => {
  let fixture: ComponentFixture<HostComponent>;
  let service: NotificationService;
  const el = () => fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(HostComponent);
    service = TestBed.inject(NotificationService);
    await settle();
  });

  afterEach(() => vi.useRealTimers());

  describe('inline field error', () => {
    it('renders under the field with a link id and clears', async () => {
      service.setFieldError('email', 'Please enter a valid email address.');
      await settle();
      const p = el().querySelector('#email-error');
      expect(p?.textContent).toContain('Please enter a valid email address.');
      expect(p?.textContent).toContain('⚠');

      service.clearFieldError('email');
      await settle();
      expect(el().querySelector('#email-error')).toBeNull();
    });
  });

  describe('toast', () => {
    it('renders and auto-dismisses after 4 seconds', async () => {
      vi.useFakeTimers();
      service.showToast('Saved.');
      await settle();
      expect(el().textContent).toContain('Saved.');

      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
      fixture.detectChanges();
      expect(el().textContent).toContain('Saved.');

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(el().textContent).not.toContain('Saved.');
    });

    it('can be dismissed manually', async () => {
      const id = service.showToast('Hello');
      await settle();
      service.dismissToast(id);
      await settle();
      expect(el().textContent).not.toContain('Hello');
    });

    it('never blocks interaction with the screen underneath', async () => {
      service.showToast('Heads up');
      await settle();
      const status = el().querySelector('[role="status"]') as HTMLElement;
      expect(status.classList.contains('pointer-events-none')).toBe(true);
      const toast = status.querySelector('p') as HTMLElement;
      expect(toast.classList.contains('pointer-events-none')).toBe(true);
      expect(toast.querySelector('button, a, input')).toBeNull();
      expect(status.closest('.fixed.inset-0')).toBeNull();

      (el().querySelector('#under') as HTMLButtonElement).click();
      expect(fixture.componentInstance.clicks).toBe(1);
    });
  });

  describe('modal', () => {
    it('renders one action button, runs the action, and closes', async () => {
      const onAction = vi.fn();
      service.showModal({ message: 'We could not save.', actionLabel: 'Got it', onAction });
      await settle();
      const dialog = el().querySelector('[role="alertdialog"]') as HTMLElement;
      expect(dialog.textContent).toContain('We could not save.');
      const buttons = dialog.querySelectorAll('button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].textContent).toContain('Got it');

      buttons[0].click();
      await settle();
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    });

    it('closes when dismissed without an action', async () => {
      service.showModal({ message: 'Oops', actionLabel: 'OK' });
      await settle();
      service.dismissModal();
      await settle();
      expect(el().querySelector('[role="alertdialog"]')).toBeNull();
    });
  });

  describe('full-screen error state', () => {
    it('shows the plain message and a retry button that retries and dismisses', async () => {
      const onRetry = vi.fn();
      service.showErrorState({ message: 'Something went wrong. Please try again.', onRetry });
      await settle();
      const alert = el().querySelector('[role="alert"].fixed') as HTMLElement;
      expect(alert.textContent).toContain('Something went wrong. Please try again.');
      const button = alert.querySelector('button') as HTMLButtonElement;
      expect(button.textContent).toContain('Try again');

      button.click();
      await settle();
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(el().querySelector('[role="alert"].fixed')).toBeNull();
    });

    it('shows no stack trace or technical details', async () => {
      service.showErrorState({ message: 'We could not load your words.' });
      await settle();
      const text = el().querySelector('[role="alert"].fixed')?.textContent ?? '';
      expect(text).not.toMatch(/\bat\s+\S+\s*\(|Error:|stack|\.ts:\d+|undefined|null/i);
      expect(text.replace(/\s+/g, ' ').trim()).toBe('⚠We could not load your words. Try again');
    });
  });
});
