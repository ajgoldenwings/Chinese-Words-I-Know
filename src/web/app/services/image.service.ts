import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Resolves image URLs from slugs. Components never build asset paths.
 *
 * A null result means "no image": the caller shows the category emoji instead.
 * Nothing here throws. A file that exists in the URL but fails to load is handled
 * by the caller's image `error` event, which should also fall back to the emoji.
 */
@Injectable({ providedIn: 'root' })
export class ImageService {
  /** URL for a word illustration, or null when the word has no image. */
  wordImageUrl(slug: string | null | undefined): string | null {
    return this.build('words', slug);
  }

  /** URL for a category cover image, or null when the id is empty. */
  categoryImageUrl(categoryId: string | null | undefined): string | null {
    return this.build('categories', categoryId);
  }

  private build(folder: 'words' | 'categories', name: string | null | undefined): string | null {
    try {
      if (typeof name !== 'string') return null;
      const clean = name.trim();
      // Slugs are lowercase letters, digits and hyphens; anything else could escape the folder.
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return null;
      const base = (environment.assetBaseUrl ?? '').replace(/\/+$/, '');
      const path = `assets/images/${folder}/${clean}.png`;
      return base ? `${base}/${path}` : path;
    } catch {
      return null;
    }
  }
}
