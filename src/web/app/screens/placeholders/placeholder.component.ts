import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Temporary stand-in for screens built in later tasks (9, 10, 11). */
@Component({
  selector: 'app-placeholder',
  imports: [RouterLink],
  template: `<a routerLink="/" class="flex size-11 items-center justify-center opacity-30" aria-label="Back">←</a>`,
})
export class PlaceholderComponent {}
