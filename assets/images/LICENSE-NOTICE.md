# Image sources

Most images are rendered from Google's Noto Emoji (https://github.com/googlefonts/noto-emoji, 2D/svg),
licensed under the Apache License 2.0. No attribution is required in the app UI.
Colors, tofu, table, cup, belly and river are custom flat illustrations made for this project (scripts/images/gen.mjs).
Regenerate with: node scripts/images/gen.mjs <dir> then python3 scripts/images/opt.py <dir> <out>
(needs @resvg/resvg-js and Pillow).
