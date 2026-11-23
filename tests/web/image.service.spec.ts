import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../src/web/environments/environment';
import { ImageService } from '../../src/web/app/services/image.service';

const original = environment.assetBaseUrl;

function service(base: string): ImageService {
  environment.assetBaseUrl = base;
  TestBed.resetTestingModule();
  return TestBed.inject(ImageService);
}

describe('ImageService', () => {
  afterEach(() => {
    environment.assetBaseUrl = original;
  });

  it('returns null for a null, undefined, or empty slug without throwing', () => {
    const images = service('');
    expect(images.wordImageUrl(null)).toBeNull();
    expect(images.wordImageUrl(undefined)).toBeNull();
    expect(images.wordImageUrl('')).toBeNull();
    expect(images.categoryImageUrl(null)).toBeNull();
  });

  it('returns relative paths with an empty base URL', () => {
    const images = service('');
    expect(images.wordImageUrl('ni-hao')).toBe('assets/images/words/ni-hao.png');
    expect(images.categoryImageUrl('animals')).toBe('assets/images/categories/animals.png');
    expect(images.wordImageUrl('mao')!.startsWith('/')).toBe(false);
  });

  it('prefixes a CDN base URL with or without a trailing slash', () => {
    expect(service('https://cdn.example.com').wordImageUrl('mao')).toBe(
      'https://cdn.example.com/assets/images/words/mao.png',
    );
    expect(service('https://cdn.example.com/').categoryImageUrl('animals')).toBe(
      'https://cdn.example.com/assets/images/categories/animals.png',
    );
  });

  it('rejects slugs that could escape the folder', () => {
    const images = service('');
    expect(images.wordImageUrl('../secret')).toBeNull();
    expect(images.wordImageUrl('a/b')).toBeNull();
  });
});
