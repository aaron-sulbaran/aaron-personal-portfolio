import type { BackUp, CreditMode, FooterMode, IdleRipple, IntoIsle, NotNow, OnPlay, PhoneMode, PhoneModel, StatusLine, WaveAfterAnswer } from "@/lib/player/settings";

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
  shuffle: "Shuffle",
  repeat: { off: "Repeat off", all: "Repeat all tracks", one: "Repeat this track" },
  elapsed: "Time played",
  remaining: "Time left",
  seekValueOf: "of",
  barLabel: "Soundtrack bar",
  goToPlayer: "Go to the player",
  pillLabel: "Soundtrack player",
  pillOpen: "Open the player",
  islandLabel: "Soundtrack island",
  islandOpen: "Open the player",
  islandClose: "Close the player",
} as const;

export const playerLab = {
  title: "Music player lab, round 3",
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
    names: { today: "Today", player: "Player" } satisfies Record<OnPlay, string>,
    notes: {
      today: "Music starts and nothing opens.",
      player: "One full player everywhere: the cover, the title and artist (long ones scroll), a seek bar with the time played and the time left, previous, play and next, quiet shuffle and repeat, and the seven Tracks. It is the band's home, the isle's open state, and the phone island's. The band is where it lives: it shows whenever the band is on screen, hands off to the isle below it, and comes back as you scroll up.",
    } satisfies Record<OnPlay, string>,
  },

  statusLine: {
    label: "The line under the heading",
    names: { today: "Today", hidden: "Hidden" } satisfies Record<StatusLine, string>,
    notes: {
      today: "After Play it, the band says Enjoy and keeps a Pause or Resume beside the heading, as today.",
      hidden: "With the player in the band, the band shows only the heading and the player: no status sentence, no Pause or Resume. The player is the feedback.",
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
    label: "The wave and the band",
    names: { today: "Today", waits: "One line" } satisfies Record<WaveAfterAnswer, string>,
    notes: {
      today: "Play it or Not now makes the wave react at once: the ripple, then the line follows the scroll wherever the band is.",
      waits: "The wave is one line. It follows the scroll only once the band is above the release line, on every screen size; below the line only the band's own run is drawn and nothing of the path overlaps it. After an answer it stays as it was until the band first scrolls away. Freeze the wave and reduced motion work as they do today.",
    } satisfies Record<WaveAfterAnswer, string>,
    line: "Release line",
    lineNote: "The band counts as scrolled away when its bottom edge rises above this line, as a share of the viewport's height from the top. One value for phones, laptops and anything between, wherever the band sits in the page.",
  },

  idle: {
    label: "Idle ripple",
    names: { today: "Today", ripple: "Ripple" } satisfies Record<IdleRipple, string>,
    notes: {
      today: "Paused, after Not now and while the wave is held, the line breathes in place, as today.",
      ripple: "Paused, after Not now and while the wave is held, a gentle ripple travels through the line, never dead flat. Playing music takes the line over and the ripple steps aside. Freeze the wave and reduced motion still it.",
    } satisfies Record<IdleRipple, string>,
    strength: "Ripple strength",
    strengthNote: "A multiple of the tuned height. Low and slow is the point.",
  },

  intoIsle: {
    label: "Into the isle",
    names: { today: "Today", morph: "Morph", fade: "Fade swap" } satisfies Record<IntoIsle, string>,
    notes: {
      today: "The player stays in the band. The pill arrives on its own once the band is passed.",
      morph: "Scrolling the band out of view shrinks the player into the pill's place (a FLIP-style move that tracks the band as it scrolls). On a phone with the island it flies up to the top. Reduced motion fades instead.",
      fade: "The player fades out and the isle fades in where it stands.",
    } satisfies Record<IntoIsle, string>,
    line: "Hand-off line",
    lineNote: "The band's bottom edge rising above this line starts it, as a share of the viewport's height from the top. Low means after the band is nearly gone; high means as soon as it starts to leave.",
  },

  backUp: {
    label: "Back up",
    names: { pill: "Stays a pill", reopen: "Reopens" } satisfies Record<BackUp, string>,
    notes: {
      pill: "Scrolling back to the band leaves the isle where it is.",
      reopen: "Scrolling back to the band reopens the player there, and the isle steps away. Further up, in the book and the hero, the player stays in the band and no isle shows.",
    } satisfies Record<BackUp, string>,
  },

  footer: {
    label: "The pill at the footer",
    names: { lift: "Lift", hide: "Hide" } satisfies Record<FooterMode, string>,
    notes: {
      lift: "As the footer scrolls in, the pill rides up so it always sits above the footer's top edge, and the period stays free.",
      hide: "The pill fades out while the footer is in view and comes back after it.",
    } satisfies Record<FooterMode, string>,
  },

  credit: {
    label: "Credit line",
    names: { band: "In the band", player: "In the player", hidden: "Hidden" } satisfies Record<CreditMode, string>,
    notes: {
      band: "The line sits at the band's lower right, as today.",
      player: "The band drops it; the lab's player carries it.",
      hidden: "Nowhere on the page. The tracks still credit each artist in the player, with a Spotify link.",
    } satisfies Record<CreditMode, string>,
  },

  phone: {
    label: "Phones",
    names: { band: "Stays in the band", bar: "Bottom bar", island: "Island" } satisfies Record<PhoneMode, string>,
    notes: {
      band: "The player sits in the band, below the copy, and never leaves it. Phones have no isle.",
      bar: "Scrolling the band out of view collapses the player to a slim bar at the bottom of the screen; the title scrolls back to the band. Kept for comparison.",
      island: "Scrolling the band out of view collapses the player to a black pill at the top of the screen, sized to the phone's Dynamic Island where the model is known and generic otherwise. Tap it to grow the full player down from the top; tap outside or swipe up to close it. A page cannot draw over the real island in Safari, so it sits just under the status bar.",
    } satisfies Record<PhoneMode, string>,
    model: "Phone in the preview",
    models: { auto: "This device", iphone15: "iPhone 15", iphone17pro: "iPhone 17 Pro", iphone17promax: "17 Pro Max", android: "Android" } satisfies Record<PhoneModel, string>,
    modelNote: "Sizes the phone frame and tells the island which phone to match. In this preview, This device is an iPhone 15; on a real phone it reads the phone itself and falls back to the generic pill when it does not know the model.",
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
