import { Component, inject } from '@angular/core';
import { NotificationService } from './notification.service';

/**
 * Corner toasts. The container and the toasts ignore pointer events,
 * so a toast never blocks a tap on the screen underneath.
 */
@Component({
  selector: 'app-toast-container',
  template: `
    <div
      class="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      @for (toast of notifications.toasts(); track toast.id) {
        <p
          class="pointer-events-none flex items-start gap-2 rounded-lg border-2 border-slate-700 bg-white px-4 py-3 text-lg text-slate-900 shadow-lg"
        >
          <span aria-hidden="true">ℹ</span>
          <span>{{ toast.message }}</span>
        </p>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly notifications = inject(NotificationService);
}
