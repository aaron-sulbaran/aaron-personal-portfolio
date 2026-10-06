"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ContributionData } from "./data";

// The loaded data, handed down from the server page once.
const ContributionsContext = createContext<ContributionData | null>(null);

export function ContributionsProvider({ data, children }: { data: ContributionData; children: ReactNode }) {
  return <ContributionsContext.Provider value={data}>{children}</ContributionsContext.Provider>;
}

export function useContributions(): ContributionData {
  const data = useContext(ContributionsContext);
  if (!data) throw new Error("useContributions needs a ContributionsProvider");
  return data;
}
