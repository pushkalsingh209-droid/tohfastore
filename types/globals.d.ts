// types/globals.d.ts
// Third-party globals attached to `window` by <script> tags (analytics
// pixels, the Razorpay checkout SDK) or by the browser (Web Speech API).
// Declaring them here removes the `(window as any).X` casts scattered
// across the app.
export {};

declare global {
  interface Window {
    // Meta Pixel (loaded in layout.tsx). Args are (event, name, params?).
    fbq?: (...args: unknown[]) => void;
    // GA4 gtag (loaded by @next/third-parties). Args are (command, ...rest).
    gtag?: (...args: unknown[]) => void;
    // Razorpay Checkout SDK -- injected on demand by CheckoutSheet.
    Razorpay?: new (options: unknown) => {
      open: () => void;
      on: (event: string, handler: (response?: unknown) => void) => void;
    };
    // Web Speech API (SearchBar voice search). Chrome/Edge only.
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }

  // Minimal shape of the SpeechRecognition instance SearchBar uses.
  interface SpeechRecognitionCtor {
    new (): SpeechRecognitionLike;
  }
  interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  }
}
