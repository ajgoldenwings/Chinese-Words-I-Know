import { Component, computed, inject, input } from '@angular/core';
import { NotificationService } from './notification.service';

/**
 * Inline error shown under an input. Link it from the input with
 * `aria-describedby="<fieldId>-error"`.
 */
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p
        class="mt-1 flex items-start gap-2 text-base font-medium text-red-800 dark:text-red-300"
        role="alert"
        [id]="fieldId() + '-error'"
      >
        <span aria-hidden="true">⚠</span>
        <span>{{ text }}</span>
      </p>
    }
  `,
})
export class FieldErrorComponent {
  readonly fieldId = input.required<string>();
  private readonly notifications = inject(NotificationService);
  protected readonly message = computed(() => this.notifications.fieldError(this.fieldId())());
}
