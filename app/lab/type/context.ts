"use client";

import { createContext, useContext } from "react";
import { PRESETS, type Settings } from "./settings";

// The settings on show (A or B), for the fragments whose markup changes with
// them (the arrow, the role line's place); everything else reads the CSS
// variables on the lab root.
export const ShownSettings = createContext<Settings>(PRESETS[0].settings);

export const useShown = () => useContext(ShownSettings);
