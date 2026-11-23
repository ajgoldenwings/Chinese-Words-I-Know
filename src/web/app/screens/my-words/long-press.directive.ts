import { Directive, ElementRef, inject, input, output } from '@angular/core';

/**
 * Long-press gesture built on pointer events.
 *
 * HammerJS is not used: Angular 22's platform-browser no longer ships `HammerModule` or
 * `HAMMER_GESTURE_CONFIG`, and HammerJS itself is unmaintained, so there is no supported
 * way to wire its `press` event into templates.
 *
 * A press fires `appLongPress` after `appLongPressMs` without release or significant
 * movement. The click that follows the release is swallowed, so a long press never also
 * counts as a tap.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointerup)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(pointermove)': 'move($event)',
    '(contextmenu)': 'onContextMenu($event)',
  },
})
export class LongPressDirective {
  readonly appLongPressMs = input(500);
  readonly appLongPress = output<void>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private origin: { x: number; y: number } | null = null;
  private fired = false;

  constructor() {
    // Capture phase, so this runs before any (click) handler on the same element.
    this.el.nativeElement.addEventListener('click', (e) => this.onClick(e), true);
  }

  protected start(e: PointerEvent): void {
    this.cancel();
    this.fired = false;
    this.origin = { x: e.clientX, y: e.clientY };
    this.timer = setTimeout(() => {
      this.timer = null;
      this.fired = true;
      this.appLongPress.emit();
    }, this.appLongPressMs());
  }

  protected move(e: PointerEvent): void {
    if (!this.timer || !this.origin) return;
    if (Math.hypot(e.clientX - this.origin.x, e.clientY - this.origin.y) > 10) this.cancel();
  }

  protected cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  protected onContextMenu(e: Event): void {
    // Touch browsers show a context menu on long press; it would cover ours.
    if (this.fired || this.timer) e.preventDefault();
  }

  protected onClick(e: Event): void {
    if (!this.fired) return;
    this.fired = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}
