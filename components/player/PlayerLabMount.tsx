"use client";

import dynamic from "next/dynamic";

// The player lab's single mount point, in the soundtrack band. In development
// it loads PlayerLab, which draws nothing unless the lab is switched on; in
// production the branch is dead code, so this renders null and the lab's
// player never ships.
const PlayerLab = process.env.NODE_ENV === "development" ? dynamic(() => import("./PlayerLab"), { ssr: false }) : null;

export function PlayerLabMount() {
  return PlayerLab ? <PlayerLab /> : null;
}
