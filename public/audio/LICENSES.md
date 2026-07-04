# Soundtrack audio licenses

Self-hosted tracks for the site soundtrack (docs/plans/2026-07-01-waveform-phase4-self-hosted-audio.md).
Every file in this directory must have an entry here BEFORE it ships.

| File | Title | Artist | Source URL | License |
|---|---|---|---|---|
| track-01.mp3 | Small Steps | Lee Rosevere | https://freemusicarchive.org/music/lee-rosevere/music-for-podcasts-ambient/small-steps/ | Creative Commons Attribution 4.0 (CC BY 4.0) |
| track-02.mp3 | Waves of Sleep | Lee Rosevere | https://freemusicarchive.org/music/lee-rosevere/music-for-podcasts-ambient/waves-of-sleep/ | Creative Commons Attribution 4.0 (CC BY 4.0) |
| track-03.mp3 | Slow Lights | Lee Rosevere | https://freemusicarchive.org/music/lee-rosevere/music-for-podcasts-ambient/slow-lights/ | Creative Commons Attribution 4.0 (CC BY 4.0) |

All three tracks are from Lee Rosevere's "Music For Podcasts - Ambient" collection on the
Free Music Archive, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Attribution: "Small Steps", "Waves of Sleep", and "Slow Lights" by Lee Rosevere
(https://freemusicarchive.org/music/lee-rosevere/), licensed under CC BY 4.0. Personal and
commercial use allowed with attribution; no share-alike or non-commercial restriction.

Files were downloaded from Free Music Archive's public CDN, then re-encoded to 160 kbps
CBR MP3 with `ffmpeg -i in.mp3 -b:a 160k out.mp3` to bring each under 5 MB (source files
were 320 kbps and 5.3-6.8 MB).

None of these tracks currently have a Spotify listing (Lee Rosevere removed his "Music for
Podcasts" catalog from Spotify in January 2024), so `spotifyUrl` is `null` for all three.
