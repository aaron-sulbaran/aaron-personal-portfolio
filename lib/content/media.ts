import type { CardPicture, LogoRef, ModalPhoto } from "./types";

// The files scripts/export-photos.mjs wrote from the approved photo manifest (2026-10-08), with
// their pixels as written. Alt text and captions are the approved copy, verbatim, and each modal
// photo sits beside its approved paragraph or timeline entry. Rerun the script to change a file;
// never edit an export by hand.

function picture(name: string, alt: string): CardPicture {
  return { src: `/photos/cards/${name}.jpg`, width: 1200, height: 1600, alt, crop: null };
}

type Beside = { block: number } | { timeline: number };
function photo(name: string, width: number, height: number, beside: Beside, alt: string, caption: string, captionShort?: string): ModalPhoto {
  return { src: `/photos/cards/${name}.jpg`, width, height, alt, crop: null, caption, ...(captionShort ? { captionShort } : {}), ...beside };
}

export const pictures = {
  mentorship: picture("mentorship-picture", "Me speaking into a microphone at a Hispanic Scholarship Fund event"),
  band: picture("band-picture", "Me in my drum major uniform at night, smiling"),
  hackathons: picture("hackathons-picture", "Me and my team with the giant UFCU check after winning Develop U"),
  misuki: picture("misuki-picture", "Me standing behind Misuki, my 2001 Miata, on a parking deck at golden hour"),
  travel: picture("travel-picture", "Me with my arms crossed at the Yosemite valley viewpoint in winter"),
  // Mirrored in the export, so the Ship NYC sign and the badge read correctly.
  "building-in-public": picture("building-in-public-picture", "Me holding my badge in front of the Ship NYC sign at Vercel Ship in New York"),
} as const;

export const modalPhotos = {
  mentorship: [
    photo("mentorship-1-booth", 1125, 978, { block: 0 }, "Me with other mentors and scholars at the Hispanic Scholarship Fund STEM Summit photo booth, September 2026", "Me at my second HSF, this time as a mentor."),
    photo("mentorship-2-scholar", 1600, 1200, { block: 0 }, "Me with other scholars on the red sponsor backdrop at a Hispanic Scholarship Fund event, September 2025", "Me at HSF my first year, as a scholar."),
    photo("mentorship-3-shpe", 1600, 1200, { block: 1 }, "Me at the 2023 SHPE National Convention in front of the Familia sign", "Me at my first SHPE national convention, 2023. I've been to every one since."),
  ],
  band: [
    photo("band-1-section", 1600, 1067, { block: 0 }, "Me with my section, the low reeds, in uniform", "Me with my section, the low reeds."),
    photo("band-2-practice", 1200, 1600, { block: 1 }, "A selfie I took on the practice lot with my band section around me", "Practicing back when I was just a section leader for the low reeds."),
    photo("band-3-competition", 1200, 1600, { block: 2 }, "Me laughing in my drum major uniform under the stadium lights", "Right after a competition run, seeing my friends and laughing."),
  ],
  "capital-one": [
    photo("capital-one-1-2024", 1200, 1600, { block: 1 }, "Me next to the Capital One Analyst Early Internship Program welcome banner, 2024", "Me at my first internship, the Analyst Early Internship Program."),
    photo("capital-one-2-2025", 1200, 1600, { block: 2 }, "Me with two co-interns in the Capital One McLean office, 2025", "Me with my co-interns my second summer."),
    photo("capital-one-3-2026", 1200, 1600, { block: 3 }, "Me in a Capital One jacket on a New York rooftop, 2026", "Me in New York City for my final Capital One internship."),
  ],
  anthropic: [
    photo("anthropic-1-hackathon", 1600, 1200, { block: 0 }, "Me with my co-ambassadors and the judges in front of the Hooked on Claude welcome slide", "Me, my co-ambassadors and the judges at Hooked on Claude, our hackathon."),
    photo("anthropic-2-session", 1200, 1600, { block: 1 }, "Me teaching a live Claude session in a lab, with a slide on why context is key", "Me teaching a live Claude session for Longhorn Neurotech."),
    photo("anthropic-3-teaching", 1600, 1205, { block: 1 }, "Me teaching a session in a lecture hall, with the lesson plan on the screen", "Me teaching during one of our learning sessions."),
  ],
  ieee: [
    photo("ieee-1-social", 1600, 1061, { block: 0 }, "Me at an IEEE UT Austin social at Austin Boulder Project with other engineering orgs", "Me at a rock climbing social with IEEE and other engineering orgs."),
    photo("ieee-2-award", 1600, 858, { block: 3 }, "Our IEEE UT Austin officers receiving the Outstanding Large Student Branch plaque", "Us receiving our Outstanding Large Student Branch plaque."),
    photo("ieee-3-rising-stars", 1200, 1600, { block: 4 }, "Me at the IEEE Rising Stars conference in Las Vegas, January 2026", "Me at my last IEEE Rising Stars conference as president of the chapter."),
  ],
  hackathons: [
    photo("hackathons-1-hookem", 1600, 1135, { block: 1 }, "Me and my team holding keyboard prizes under the winner is min/Max slide at Hook 'Em Hacks", "Me at Hook 'Em Hacks, winning."),
    photo("hackathons-2-vercel", 1200, 1600, { block: 2 }, "Me with the Built in NYC poster at the Vercel one-day hackathon in New York", "Me at a one-day Vercel hackathon in New York City."),
  ],
  jobs: [
    photo("jobs-1-mod-selfie", 1200, 1600, { timeline: 1 }, "A mirror selfie of me in a Keep MOD Weird shirt, cap and flannel", "Me at my MOD store, in a Keep MOD Weird tee."),
    photo("jobs-2-mod-sign", 1200, 1600, { timeline: 1 }, "The back of the sign at my MOD store with my last clock-out slip and two MOD stickers", "My last clock-out at MOD, April 15, 2023, 10 pm, with two stickers to leave my mark."),
    photo("jobs-3-apple", 1200, 1600, { timeline: 3 }, "My Apple employee badge with my Memoji", "My Apple employee badge."),
    photo("jobs-4-aritzia-poster", 998, 1600, { timeline: 4 }, "The We Are Aritzia poster introducing me as the newest member of The Domain team", "The poster that introduced me to the team at Aritzia."),
  ],
  misuki: [
    photo("misuki-1-gregory-gym", 1126, 1501, { block: 0 }, "Me and Misuki, my 2001 Miata, in front of the Texas Fight stairs at Gregory Gym", "Me and Misuki outside Gregory Gym."),
    photo("misuki-2-shop", 1200, 1600, { block: 1 }, "Misuki on a lift with the hood up during her engine rebuild", "Misuki breaks down on me (a lot), but I keep her going."),
    photo("misuki-3-hiroshima", 1600, 1200, { block: 1 }, "A Mazda 787B race car at the Mazda museum in Hiroshima", "Owning a manual Miata is part of why I went to the Mazda Museum in Hiroshima, where I saw the real Mazda 787B that won Le Mans in 1991.", "The real Mazda 787B that won Le Mans in 1991, at the Mazda Museum in Hiroshima."),
  ],
  travel: [
    photo("travel-1-fuji", 1200, 1600, { block: 0 }, "Me on a street in Japan with Mt. Fuji behind me", "Me at Mount Fuji on my second trip to Japan."),
    photo("travel-2-dubai", 1200, 1600, { block: 0 }, "Me leaning on a railing at the Museum of the Future in Dubai, with the skyline behind me", "Me at the Museum of the Future in Dubai."),
    photo("travel-3-cartagena", 1200, 1600, { block: 0 }, "Me with three people under a huge Colombian flag on a fort wall above Cartagena, Colombia", "Me in Cartagena, Colombia."),
  ],
  "building-in-public": [
    photo("building-1-analytics", 532, 517, { block: 0 }, "My LinkedIn top performing posts, led by the unflattering jobs post", "My top performing posts on LinkedIn."),
    photo("building-2-toronto", 1200, 1600, { block: 0 }, "Me making a hook 'em sign in front of a window with the CN Tower behind me in Toronto", "Me in Toronto, another one."),
  ],
} as const;

// The official logo files, under public/work/logos/<card>/. An SVG's width and height are its
// viewBox's (two decimals); a raster's are its pixels. srcDark is the file for the dark theme,
// null where one file serves both.
export const logos = {
  "min-max": { src: "/work/logos/min-max/mark.svg", srcDark: "/work/logos/min-max/mark-on-dark.svg", width: 548, height: 497 },
  talos: { src: "/work/logos/talos/mark.svg", srcDark: null, width: 512, height: 512 },
  "capital-one": { src: "/work/logos/capital-one/capital-one-logo.svg", srcDark: null, width: 418, height: 150 },
  anthropic: { src: "/work/logos/anthropic/anthropic-wordmark.svg", srcDark: "/work/logos/anthropic/anthropic-wordmark-white.svg", width: 578.9, height: 65 },
  ieee: { src: "/work/logos/ieee/ieee-ut-logo.jpg", srcDark: null, width: 1382, height: 1383 },
  fsdatalink: { src: "/work/logos/fsdatalink/fsdatalink-logo.avif", srcDark: null, width: 512, height: 129 },
  popeyes: { src: "/work/logos/jobs/popeyes-logo.svg", srcDark: null, width: 249.2, height: 42.6 },
  mod: { src: "/work/logos/jobs/mod-pizza-logo.svg", srcDark: null, width: 86.31, height: 83.21 },
  "ut-austin": { src: "/work/logos/jobs/ut-austin-logo.svg", srcDark: "/work/logos/jobs/ut-austin-logo-white.svg", width: 1021, height: 285.73 },
  apple: { src: "/work/logos/jobs/apple-logo-black.svg", srcDark: "/work/logos/jobs/apple-logo-white.svg", width: 41.5, height: 51 },
  aritzia: { src: "/work/logos/jobs/aritzia-logo.svg", srcDark: "/work/logos/jobs/aritzia-logo-light.svg", width: 53.18, height: 10.71 },
} as const satisfies Record<string, LogoRef>;
