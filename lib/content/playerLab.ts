import type { BackUp, CreditMode, FooterMode, IntoIsle, NotNow, OnPlay, PhoneMode, PhoneModel, StatusLine, WaveAfterAnswer } from "@/lib/player/settings";

// The music player lab's words: the player's own labels (the strings the lab's
// card, sheet, island and phone bar draw; the rest reuse siteContent.soundtrack
// and siteContent.listen) and the lab panel's labels and notes. The panel is
// dev-only chrome in system type; the player strings are plain interface labels.

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
  islandLabel: "Soundtrack island",
  islandOpen: "Open the player",
  islandClose: "Close the player",
} as const;

export const playerLab = {
  title: "Music player lab, round 2",
  hide: "Hide",
  show: "Music lab controls",
  panelLabel: "Music player lab controls",
  frameTitle: "Home page preview, at the soundtrack band",

  master: {
    label: "Show the lab on the home page",
    note: "Off, the site plays and looks as it does today. On, the real band, pill and wave on / use these settings. The preview below is the real home page, so it changes as you tune; no reload is needed.",
  },

  onPlay: {
    label: "On play",
    names: { today: "Today", card: "Player card", sheet: "Compact sheet" } satisfies Record<OnPlay, string>,
    notes: {
      today: "Music starts and nothing opens.",
      card: "Pressing Play it (or the Music control in the chrome) opens the player: the cover, the title and artist, seek, previous and next, volume, and the seven tracks. A row plays that track; a name links to Spotify.",
      sheet: "The direction. A compact sheet opens in the band: the current track with play, next and Freeze the wave, and a Tracks control that opens the list. The band is its home: it shows whenever the band is on screen, hands off to the isle below it, and comes back as you scroll up. Started below the band, it opens at the isle's dock instead.",
    } satisfies Record<OnPlay, string>,
  },

  statusLine: {
    label: "The line under the heading",
    names: { today: "Today", hidden: "Hidden" } satisfies Record<StatusLine, string>,
    notes: {
      today: "After Play it, the band says Enjoy and keeps a Pause or Resume beside the heading, as today.",
      hidden: "With the sheet in the band, the band shows only the heading and the sheet: no status sentence, no Pause or Resume. The sheet is the feedback.",
    } satisfies Record<StatusLine, string>,
  },

  notNow: {
    label: "After Not now",
    names: { today: "Today", buttons: "Two buttons" } satisfies Record<NotNow, string>,
    notes: {
      today: "The No problem line, and a Freeze the wave link lower in the band.",
      buttons: "Play it and Freeze the wave sit beside the No problem line, styled like the first visit's two choices. The lone freeze link goes.",
    } satisfies Record<NotNow, string>,
  },

  wave: {
    label: "The wave after an answer",
    names: { today: "Today", waits: "Waits" } satisfies Record<WaveAfterAnswer, string>,
    notes: {
      today: "Play it or Not now makes the wave react at once: the ripple, then the line starts to follow the scroll.",
      waits: "After either answer the band's wave stays exactly as it was. The ripple and the following begin only once the band has scrolled away, so the wave moves with the reader. Freeze the wave and reduced motion work as they do today.",
    } satisfies Record<WaveAfterAnswer, string>,
    line: "Release line",
    lineNote: "The band counts as scrolled away when its bottom edge rises above this line, as a share of the viewport's height from the top.",
  },

  intoIsle: {
    label: "Into the isle",
    names: { today: "Today", morph: "Morph", fade: "Fade swap" } satisfies Record<IntoIsle, string>,
    notes: {
      today: "The player stays in the band. The pill arrives on its own once the band is passed.",
      morph: "Scrolling the band out of view shrinks the sheet into the isle's place (a FLIP-style move that tracks the band as it scrolls). On a phone with the island it flies up to the top. Reduced motion fades instead.",
      fade: "The player fades out and the isle fades in where it stands.",
    } satisfies Record<IntoIsle, string>,
    line: "Hand-off line",
    lineNote: "The band's bottom edge rising above this line starts it, as a share of the viewport's height from the top. Low means after the band is nearly gone; high means as soon as it starts to leave.",
  },

  backUp: {
    label: "Back up",
    names: { pill: "Stays a pill", reopen: "Reopens" } satisfies Record<BackUp, string>,
    notes: {
      pill: "Scrolling back to the band leaves the isle where it is, and pressing it opens the player.",
      reopen: "Scrolling back to the band reopens the sheet there, and the isle steps away. Further up, in the book and the hero, the sheet stays in the band and no isle shows.",
    } satisfies Record<BackUp, string>,
  },

  footer: {
    label: "The isle at the footer",
    names: { lift: "Lift", hide: "Hide" } satisfies Record<FooterMode, string>,
    notes: {
      lift: "As the footer scrolls in, the isle rides up so it always sits above the footer's top edge, and the period stays free.",
      hide: "The isle fades out while the footer is in view and comes back after it.",
    } satisfies Record<FooterMode, string>,
  },

  credit: {
    label: "Credit line",
    names: { band: "In the band", player: "In the player", hidden: "Hidden" } satisfies Record<CreditMode, string>,
    notes: {
      band: "The line sits at the band's lower right, as today.",
      player: "The band drops it; the player (this lab's card and sheet, and the pill's own card) carries it.",
      hidden: "Nowhere on the page. The tracks still credit each artist in the player, with a Spotify link.",
    } satisfies Record<CreditMode, string>,
  },

  phone: {
    label: "Phones",
    names: { band: "Stays in the band", bar: "Bottom bar", island: "Island" } satisfies Record<PhoneMode, string>,
    notes: {
      band: "The player sits in the band, below the copy, and never leaves it. Phones have no isle.",
      bar: "Scrolling the band out of view collapses the player to a slim bar at the bottom of the screen; the title scrolls back to the band. Kept for comparison.",
      island: "Scrolling the band out of view collapses the player to a black pill at the top of the screen, sized to the phone's Dynamic Island where the model is known and generic otherwise. Tap it to grow the sheet down from the top; tap outside or swipe up to close it. A page cannot draw over the real island in Safari, so it sits just under the status bar.",
    } satisfies Record<PhoneMode, string>,
    model: "Phone in the preview",
    models: { auto: "This device", iphone15: "iPhone 15", iphone17pro: "iPhone 17 Pro", iphone17promax: "17 Pro Max", android: "Android" } satisfies Record<PhoneModel, string>,
    modelNote: "Sizes the phone frame and tells the island which phone to match. Off a phone, This device reads the screen you are on and falls back to the generic pill.",
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
