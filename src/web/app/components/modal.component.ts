import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { NotificationService } from './notification.service';

/** Dialog with a message and exactly one action button. */
@Component({
  selector: 'app-modal',
  template: `
    @if (notifications.modal(); as modal) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div
          class="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="modal-message"
        >
          <p id="modal-message" class="flex items-start gap-2 text-xl">
            <span aria-hidden="true">⚠</span>
            <span>{{ modal.message }}</span>
          </p>
          <button
            #action
            type="button"
            class="mt-6 min-h-11 min-w-11 w-full rounded-xl bg-slate-800 dark:bg-slate-200 px-6 py-3 text-xl font-semibold text-white dark:text-slate-900"
            (click)="notifications.confirmModal()"
          >
            {{ modal.actionLabel }}
          </button>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  protected readonly notifications = inject(NotificationService);
  private readonly action = viewChild<ElementRef<HTMLButtonElement>>('action');

  constructor() {
    effect(() => this.action()?.nativeElement.focus());
  }
}
