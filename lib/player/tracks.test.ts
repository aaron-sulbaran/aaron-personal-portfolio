import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { creditProblems } from "@/lib/content/tracks";
import { rowAction, trackRows } from "./tracks";

const tracks = siteContent.soundtrack.tracks;

describe("the track list", () => {
  it("lists all seven tracks in playing order, counted from one", () => {
    const rows = trackRows(tracks, 0);
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows.map((row) => row.title)).toEqual(tracks.map((track) => track.title));
  });

  it("marks exactly the current track and never moves it", () => {
    for (const current of [0, 3, 6]) {
      const rows = trackRows(tracks, current);
      expect(rows.filter((row) => row.current).map((row) => row.index)).toEqual([current]);
      expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it("carries the artist, the cover and the Spotify link of each track", () => {
    const rows = trackRows(tracks, 2);
    expect(rows[2]).toMatchObject({ artist: tracks[2].artist, cover: tracks[2].cover, spotifyUrl: tracks[2].spotifyUrl });
    for (const row of rows) expect(row.spotifyUrl).toMatch(/^https:\/\/open\.spotify\.com\/track\//);
  });

  it("leaves every credit as the content module checks it", () => {
    for (const track of tracks) expect(creditProblems(track), track.title).toEqual([]);
  });

  it("toggles the current row and switches for any other", () => {
    expect(rowAction(2, 2, true)).toBe("pause");
    expect(rowAction(2, 2, false)).toBe("resume");
    expect(rowAction(4, 2, true)).toBe("switch");
    expect(rowAction(4, 2, false)).toBe("switch");
  });
});
