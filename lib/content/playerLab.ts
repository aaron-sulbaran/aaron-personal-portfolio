import type { BackUp, CreditMode, IntoIsle, OnPlay, PhoneMode } from "@/lib/player/settings";

// The music player lab's words: the player's own labels (the strings the lab's
// card, sheet and phone bar draw; the rest reuse siteContent.soundtrack) and
// the lab panel's labels and notes. The panel is dev-only chrome in system
// type; the player strings are plain interface labels.

export const playerStrings = {
  groupLabel: "Soundtrack player",
  tracks: "Tracks",
  showTracks: "Show tracks",
  hideTracks: "Hide tracks",
  playTrack: "Play",
  pauseTrack: "Pause",
  spotifyFor: "Open in Spotify:",
  close: "Close player",
  collapse: "Collapse to the isle",
  barLabel: "Soundtrack bar",
  goToPlayer: "Go to the player",
} as const;

export const playerLab = {
  title: "Music player lab, round 1",
  hide: "Hide",
  show: "Music lab controls",
  panelLabel: "Music player lab controls",
  frameTitle: "Home page preview, at the soundtrack band",

  master: {
    label: "Show the lab on the home page",
    note: "Off, the site plays and looks as it does today. On, the real band and pill on / use these settings. The preview below is the real home page, so it changes as you tune; no reload is needed.",
  },

  onPlay: {
    label: "On play",
    names: { today: "Today", card: "Player card", sheet: "Compact sheet" } satisfies Record<OnPlay, string>,
    notes: {
      today: "Music starts and nothing opens.",
      card: "Pressing Play it (or the Music control in the chrome) opens the player: the cover, the title and artist, seek, previous and next, volume, and the seven tracks. A row plays that track; a name links to Spotify. Started away from the band, it opens at the isle's dock instead.",
      sheet: "A smaller version: the current track with play and next, and a Tracks control that opens the list.",
    } satisfies Record<OnPlay, string>,
  },

  intoIsle: {
    label: "Into the isle",
    names: { today: "Today", morph: "Morph", fade: "Fade swap" } satisfies Record<IntoIsle, string>,
    notes: {
      today: "The player stays in the band. The pill arrives on its own once the band is passed.",
      morph: "Scrolling the band out of view shrinks the player into the pill's place (a FLIP-style move that tracks the band as it scrolls). Reduced motion fades instead.",
      fade: "The player fades out and the pill fades in where it stands.",
    } satisfies Record<IntoIsle, string>,
    line: "Hand-off line",
    lineNote: "The band's bottom edge rising above this line starts it, as a share of the viewport's height from the top. Low means after the band is nearly gone; high means as soon as it starts to leave.",
  },

  backUp: {
    label: "Back up",
    names: { pill: "Stays a pill", reopen: "Reopens" } satisfies Record<BackUp, string>,
    notes: {
      pill: "Scrolling back to the band leaves the isle where it is, and pressing it opens the full player.",
      reopen: "Scrolling back to the band reopens the full player there, and the pill steps away.",
    } satisfies Record<BackUp, string>,
  },

  credit: {
    label: "Credit line",
    names: { band: "In the band", player: "In the player", hidden: "Hidden" } satisfies Record<CreditMode, string>,
    notes: {
      band: "The line sits at the band's lower right, as today.",
      player: "The band drops it; the player (this lab's card and sheet, and the pill's own card) carries it.",
      hidden: "Nowhere on the page. The tracks still credit each artist in the player.",
    } satisfies Record<CreditMode, string>,
  },

  phone: {
    label: "Phones",
    names: { band: "Stays in the band", bar: "Slim bottom bar" } satisfies Record<PhoneMode, string>,
    notes: {
      band: "The player sits in the band, below the copy, and never leaves it. Phones have no isle.",
      bar: "Scrolling the band out of view collapses the player to a slim bar at the bottom of the screen; the title scrolls back to the band.",
    } satisfies Record<PhoneMode, string>,
  },

  frame: {
    label: "Preview",
    devices: { desktop: "Desktop", phone: "Phone" },
    jump: "Go to the band",
    forget: "Forget my music choice",
    forgetNote: "Clears the saved yes or no, so Play it appears again, then reloads the preview.",
    reload: "Reload preview",
  },
  theme: "Theme",
  copy: { idle: "Copy values", done: "Copied", failed: "Copy failed" },
  reset: "Reset settings",
} as const;
