// The soundtrack player's own labels: the strings the full player, the desktop
// pill and the phone island draw. The rest reuse siteContent.soundtrack (the
// transport's names, the seek bar's) and siteContent.listen (the band's).

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
  seekValueOf: "of",
  pillLabel: "Soundtrack player",
  pillOpen: "Open the player",
  islandLabel: "Soundtrack island",
  islandOpen: "Open the player",
  islandClose: "Close the player",
} as const;
