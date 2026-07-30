// app/utils/loadingMessages.ts
// Shared by the in-page loading overlay (CatalogLoadingContext) and the
// route-level Suspense fallback (app/loading.tsx), so a random one shows
// instead of always the same line.
export const LOADING_MESSAGES = [
  "Polishing the brass...",
  "Rounding up more treasures...",
  "Dusting off the shelves...",
  "Carrying in the next batch...",
  "Almost there...",
  "Wrapping up something special...",
  "Counting the diyas...",
  "Untangling the pocket temples...",
  "Shuffling the board games...",
  "Curing the resin earrings...",
  "Setting up the chess pieces...",
  "Buffing the idols...",
  "Sorting by shine...",
  "Checking the inventory shelf...",
  "Fetching fresh arrivals...",
  "Tidying the display...",
  "Lining up the pan stands...",
  "Warming up the gallery...",
  "One moment, artisans at work...",
  "Bringing it all together...",
];

export function randomLoadingMessage(): string {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}
