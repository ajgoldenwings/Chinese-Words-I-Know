import { Component } from '@angular/core';
import { ErrorStateComponent } from './error-state.component';
import { ModalComponent } from './modal.component';
import { ToastContainerComponent } from './toast.component';

/** Mount once in the root component to render toasts, the modal, and the full-screen error state. */
@Component({
  selector: 'app-notification-host',
  imports: [ToastContainerComponent, ModalComponent, ErrorStateComponent],
  template: `
    <app-toast-container />
    <app-modal />
    <app-error-state />
  `,
})
export class NotificationHostComponent {}
