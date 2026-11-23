export type CategoryId = string;

export type FrequencyTier = 1 | 2 | 3 | 4;

export interface Word {
  /** The word's slug. Permanent once published. */
  id: string;
  /** Simplified characters, e.g. 你好 */
  simplified: string;
  /** Pinyin romanization, e.g. nǐ hǎo */
  pinyin: string;
  english: string;
  category: CategoryId;
  /** Slug for the image file; null if not yet received. */
  imageAsset: string | null;
  /** Slug for the audio file; null if not yet recorded. */
  audioAsset: string | null;
  tags: string[];
  /** Conversational priority; 1 is highest. */
  frequencyTier: FrequencyTier;
}
