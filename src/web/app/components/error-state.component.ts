import { Component, inject } from '@angular/core';
import { NotificationService } from './notification.service';

/** Full-screen error with one retry button. Shows only the plain message, never technical details. */
@Component({
  selector: 'app-error-state',
  template: `
    @if (notifications.errorState(); as state) {
      <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-amber-50 p-8 text-center text-slate-900"
        role="alert"
      >
        <span class="text-6xl" aria-hidden="true">⚠</span>
        <p class="max-w-md text-2xl">{{ state.message }}</p>
        <button
          type="button"
          class="min-h-11 min-w-11 rounded-xl bg-slate-800 px-8 py-4 text-2xl font-semibold text-white"
          (click)="notifications.retry()"
        >
          {{ state.retryLabel }}
        </button>
      </div>
    }
  `,
})
export class ErrorStateComponent {
  protected readonly notifications = inject(NotificationService);
}
