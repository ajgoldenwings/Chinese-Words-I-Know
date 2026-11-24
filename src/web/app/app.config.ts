import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { AudioService } from './services/audio.service';
import { provideCloudSync } from './services/sync.provider';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideCloudSync(),
    // Create AudioService at start so the very first tap (for example on a category button) unlocks audio.
    provideAppInitializer(() => {
      inject(AudioService);
    }),
    // Relative script URL resolves against <base href>, so it works under /<repo>/.
    // Registered in production only. A new version activates on the next launch.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
