import type { Category, FrequencyTier, Word } from '../entities';
import categoriesJson from './categories.json';
import wordsJson from './words.json';

/** Thrown when a content file does not match the entity types. */
export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

export interface WordsFile {
  contentVersion: number;
  words: Word[];
}

export interface CategoriesFile {
  contentVersion: number;
  categories: Category[];
}

export interface Content {
  contentVersion: number;
  words: Word[];
  categories: Category[];
}

const SLUG_PATTERN = /^[a-z]+(-[a-z]+)*$/;
const TIERS: readonly number[] = [1, 2, 3, 4];

type Obj = Record<string, unknown>;

function fail(file: string, path: string, problem: string): never {
  throw new ContentValidationError(`${file}: ${path} ${problem}`);
}

function asObject(file: string, path: string, value: unknown): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(file, path, 'must be an object');
  }
  return value as Obj;
}

function str(file: string, path: string, o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.trim() === '') {
    fail(file, `${path}.${key}`, 'must be a non-empty string');
  }
  return v as string;
}

function slug(file: string, path: string, o: Obj, key: string): string {
  const v = str(file, path, o, key);
  if (!SLUG_PATTERN.test(v)) {
    fail(file, `${path}.${key}`, `"${v}" is not a valid slug (lowercase letters and single hyphens)`);
  }
  return v;
}

function nullableSlug(file: string, path: string, o: Obj, key: string): string | null {
  if (o[key] === null) return null;
  return str(file, path, o, key);
}

function version(file: string, root: Obj): number {
  const v = root['contentVersion'];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    fail(file, 'contentVersion', 'must be a positive integer');
  }
  return v as number;
}

function items(file: string, root: Obj, key: string): unknown[] {
  const list = root[key];
  if (!Array.isArray(list)) fail(file, key, 'must be an array');
  return list as unknown[];
}

function uniqueIds(file: string, list: { id: string }[]): void {
  const seen = new Set<string>();
  for (const { id } of list) {
    if (seen.has(id)) fail(file, 'id', `"${id}" is used more than once`);
    seen.add(id);
  }
}

function parseWord(file: string, raw: unknown, index: number): Word {
  const path = `words[${index}]`;
  const o = asObject(file, path, raw);
  const tags = o['tags'];
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
    fail(file, `${path}.tags`, 'must be an array of strings');
  }
  const tier = o['frequencyTier'];
  if (typeof tier !== 'number' || !TIERS.includes(tier)) {
    fail(file, `${path}.frequencyTier`, 'must be 1, 2, 3, or 4');
  }
  return {
    id: slug(file, path, o, 'id'),
    simplified: str(file, path, o, 'simplified'),
    pinyin: str(file, path, o, 'pinyin'),
    english: str(file, path, o, 'english'),
    category: str(file, path, o, 'category'),
    imageAsset: nullableSlug(file, path, o, 'imageAsset'),
    audioAsset: nullableSlug(file, path, o, 'audioAsset'),
    tags: tags as string[],
    frequencyTier: tier as FrequencyTier,
  };
}

function parseCategory(file: string, raw: unknown, index: number): Category {
  const path = `categories[${index}]`;
  const o = asObject(file, path, raw);
  return {
    id: str(file, path, o, 'id'),
    name: str(file, path, o, 'name'),
    emoji: str(file, path, o, 'emoji'),
    coverImage: str(file, path, o, 'coverImage'),
  };
}

/** Validates the contents of words.json. Throws ContentValidationError if malformed. */
export function parseWords(raw: unknown): WordsFile {
  const file = 'words.json';
  const root = asObject(file, 'root', raw);
  const contentVersion = version(file, root);
  const words = items(file, root, 'words').map((w, i) => parseWord(file, w, i));
  uniqueIds(file, words);
  return { contentVersion, words };
}

/** Validates the contents of categories.json. Throws ContentValidationError if malformed. */
export function parseCategories(raw: unknown): CategoriesFile {
  const file = 'categories.json';
  const root = asObject(file, 'root', raw);
  const contentVersion = version(file, root);
  const categories = items(file, root, 'categories').map((c, i) => parseCategory(file, c, i));
  uniqueIds(file, categories);
  return { contentVersion, categories };
}

/** Validates both files together: matching versions and every word in a known category. */
export function parseContent(rawWords: unknown, rawCategories: unknown): Content {
  const w = parseWords(rawWords);
  const c = parseCategories(rawCategories);
  if (w.contentVersion !== c.contentVersion) {
    throw new ContentValidationError(
      `words.json contentVersion (${w.contentVersion}) does not match categories.json (${c.contentVersion})`,
    );
  }
  const ids = new Set(c.categories.map((cat) => cat.id));
  for (const word of w.words) {
    if (!ids.has(word.category)) {
      throw new ContentValidationError(
        `words.json: word "${word.id}" refers to unknown category "${word.category}"`,
      );
    }
  }
  return { contentVersion: w.contentVersion, words: w.words, categories: c.categories };
}

let cachedContent: Content | null = null;

/**
 * Loads and validates the bundled content. The bundle never changes at runtime, so it is
 * parsed once and every screen shares the result. Treat the returned object as read-only.
 */
export function loadContent(): Content {
  cachedContent ??= parseContent(wordsJson, categoriesJson);
  return cachedContent;
}
