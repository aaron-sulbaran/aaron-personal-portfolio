// The security headers every response carries, read by next.config.mjs's
// headers(). Plain ESM so the config can import it without a build step.
//
// nosniff, the referrer policy, no framing by any other site (frame-ancestors,
// with X-Frame-Options for older browsers) and no camera, microphone,
// location, payment or USB. Framing stays open to this origin: the hero lab
// (app/lab/hero/Frames.tsx) frames /?embed=1.

export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
];
