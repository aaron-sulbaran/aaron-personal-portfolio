"use client";

import { createContext, useContext, type ReactNode } from "react";
import { TOKENS, type TokensSettings } from "@/lib/metrics/settings";

// The Tokens view's settings: the site reads lib/metrics/settings.ts; the
// metrics lab provides its own, so the lab and the site are one implementation.
const TokensSettingsContext = createContext<TokensSettings>(TOKENS);

export function TokensSettingsProvider({ value, children }: { value: TokensSettings; children: ReactNode }) {
  return <TokensSettingsContext.Provider value={value}>{children}</TokensSettingsContext.Provider>;
}

export const useTokensSettings = () => useContext(TokensSettingsContext);
