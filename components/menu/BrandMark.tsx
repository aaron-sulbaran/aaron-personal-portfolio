// The AS mark from public/brand/, inlined in currentColor so it reads ink in
// light and paper in dark through the text token. The full mark (bolt plus
// the A) is for 24px and up; below that the bolt stands alone (the design
// decisions' logo rule), which is why the pill's 18px odometer uses AsBolt.

export function AsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="2.49 6.34 243.32 243.32" aria-hidden="true" focusable="false" className={className}>
      <path d="M90.29 83.58L162.35 23.12L134.45 92.18L196.11 105.28L131.2 229.2L160.4 129.67L78.69 112.3Z" fill="currentColor" />
      <path d="M151.62 133.45L52.19 232.88L65.2 232.88L132.65 165.43L122.98 198.37L123.53 229.2Z" fill="currentColor" />
      <path d="M102.4 189.17L135.27 189.17L132.57 198.37L93.2 198.37Z" fill="currentColor" />
    </svg>
  );
}

export function AsBolt({ className }: { className?: string }) {
  return (
    <svg viewBox="-5 -3.89 263.78 263.78" aria-hidden="true" focusable="false" className={className}>
      <path d="M73.34 92.98L154.4 24.96L127.31 92L189.81 105.29L120.27 231.04L146.46 133.69L63.97 116.16Z" fill="currentColor" />
    </svg>
  );
}
