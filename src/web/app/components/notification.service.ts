import { Injectable, computed, signal } from '@angular/core';

/** How long a toast stays on screen, in milliseconds. */
export const TOAST_DURATION_MS = 4000;

export interface Toast {
  id: number;
  message: string;
}

export interface ModalOptions {
  /** Plain-language message written for a parent. */
  message: string;
  /** Label of the single action button, e.g. "Try again". */
  actionLabel: string;
  /** Runs when the button is tapped. The modal closes either way. */
  onAction?: () => void;
}

export interface ErrorStateOptions {
  /** Plain-language message written for a parent. Never put technical details here. */
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

/**
 * The one entry point for the four error treatments in ux/error-handling.md:
 * inline field error, toast, modal, and full-screen error state.
 * Callers pass plain-language text only. Raw errors are logged, never shown.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextToastId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private readonly _toasts = signal<Toast[]>([]);
  private readonly _modal = signal<ModalOptions | null>(null);
  private readonly _errorState = signal<Required<ErrorStateOptions> | null>(null);
  private readonly _fieldErrors = signal<Record<string, string>>({});

  readonly toasts = this._toasts.asReadonly();
  readonly modal = this._modal.asReadonly();
  readonly errorState = this._errorState.asReadonly();

  /** Inline field error for a field id, or null when the field is fine. */
  fieldError(fieldId: string) {
    return computed(() => this._fieldErrors()[fieldId] ?? null);
  }

  setFieldError(fieldId: string, message: string): void {
    this._fieldErrors.update((errors) => ({ ...errors, [fieldId]: message }));
  }

  clearFieldError(fieldId: string): void {
    this._fieldErrors.update((errors) => {
      const { [fieldId]: _removed, ...rest } = errors;
      return rest;
    });
  }

  /** Brief notice that dismisses itself after 4 seconds and never blocks taps. */
  showToast(message: string): number {
    const id = this.nextToastId++;
    this._toasts.update((list) => [...list, { id, message }]);
    this.timers.set(id, setTimeout(() => this.dismissToast(id), TOAST_DURATION_MS));
    return id;
  }

  dismissToast(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Dialog with a message and one action button. */
  showModal(options: ModalOptions): void {
    this._modal.set(options);
  }

  /** Called by the modal component when its button is tapped. */
  confirmModal(): void {
    const current = this._modal();
    this._modal.set(null);
    current?.onAction?.();
  }

  dismissModal(): void {
    this._modal.set(null);
  }

  /** Full-screen state for failures that stop the app from working. */
  showErrorState(options: ErrorStateOptions): void {
    this._errorState.set({
      message: options.message,
      retryLabel: options.retryLabel ?? 'Try again',
      onRetry: options.onRetry ?? (() => undefined),
    });
  }

  /** Called by the error state component when Retry is tapped. */
  retry(): void {
    const current = this._errorState();
    this._errorState.set(null);
    current?.onRetry();
  }

  dismissErrorState(): void {
    this._errorState.set(null);
  }
}
