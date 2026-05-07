// Canonical letter-size order for road/gravel/MTB sizing.
// OS (One Size) is a valid PrestaShop value — placed last among letter sizes.
export const LETTER_SIZE_ORDER = [
  "XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "OS",
] as const;

/**
 * Sort an array of size objects into canonical display order:
 *   - Letter sizes first, in LETTER_SIZE_ORDER sequence
 *   - Numeric sizes after, ascending by value
 *   - Anything unrecognised goes last, alphabetically
 *
 * Returns a new array; does not mutate the input.
 */
export function sortSizeObjects<T extends { size: string }>(sizes: T[]): T[] {
  return [...sizes].sort((a, b) => {
    const aIdx = LETTER_SIZE_ORDER.indexOf(a.size.toUpperCase() as (typeof LETTER_SIZE_ORDER)[number]);
    const bIdx = LETTER_SIZE_ORDER.indexOf(b.size.toUpperCase() as (typeof LETTER_SIZE_ORDER)[number]);
    const aIsLetter = aIdx !== -1;
    const bIsLetter = bIdx !== -1;

    if (aIsLetter && bIsLetter) return aIdx - bIdx;
    if (aIsLetter) return -1;
    if (bIsLetter) return 1;

    const aNum = Number(a.size);
    const bNum = Number(b.size);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;

    return a.size.localeCompare(b.size);
  });
}

/**
 * Sort an array of size label strings into the same canonical order.
 * Used for filter option lists where objects are not needed.
 */
export function sortSizeLabels(sizes: string[]): string[] {
  return sortSizeObjects(sizes.map((s) => ({ size: s }))).map((o) => o.size);
}
