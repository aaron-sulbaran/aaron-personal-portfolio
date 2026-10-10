import { cards } from "./cards";
import type { InlineKind } from "./links";
import type { InlineRegister, TipEntry } from "./types";

// The jobs timeline's insider tips (cards.jobs.timeline[i].tip), one per entry, so each
// employer's name in the modal is an ordinary inline tip (components/card/TimelineEntry).
export const jobTipKey = (entry: number): string => `job-${entry}`;
const jobTips: Record<string, TipEntry> = Object.fromEntries(cards.jobs.timeline.map((entry, i) => [jobTipKey(i), { text: entry.tip }]));

// Every inline link the copy may point at (docs/content/tooltips.md, approved
// 2026-10-08). Pop files are scripts/export-photos.mjs's, at their written pixels.
export const register: InlineRegister = {
  def: {
    product: {
      title: "What a product is",
      body: "A product (to me) is a tool that's genuinely useful to someone and easy for them to pick up. If it's for everyone, anyone should get it on their first try. If it's for niche hobbyists, the hobbyists in that community should get it immediately. About 99% of the time a product should be built for the user instead of forcing the user to get used to the product. The other 1% is how you get a moonshot product like the iPhone, which didn't just change the way people use a phone (the product), it changed the world.",
    },
    voltage: {
      title: "Voltage",
      body: "the difference in electric potential between two points",
    },
    arc: {
      title: "Arc",
      body: "a continuous electrical discharge that occurs when electric current flows through an air gap between two electrodes",
    },
  },
  tip: {
    "two-as": { text: "as in A-Aron" },
    voltaage: {
      text: "I always thought Voltaage would be an awesome streamer name. I guess I took a different career path.",
      link: { href: "https://profile.playstation.com/VoltaageArc", label: "VoltaageArc on most platforms" },
    },
    "killer-drones": { text: "unless it's killer drones, I don't do that" },
    "evolving-isle": { text: "not dynamic island, a nod to Apple" },
    "music-note": {
      text: "I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to, and I adapted a couple of the tracks myself in Epidemic Sound's studio. The credits are in the corner.",
      adaptedClause: ", and I adapted a couple of the tracks myself in Epidemic Sound's studio",
    },
    "ieee-ao": { text: "External Activities and Events Assistant Officer" },
    "this-site-playground": { text: "this site is my design playground" },
    "misuki-suk": { text: "shoutout suk and her S2000" },
    ...jobTips,
  },
  pop: {
    "leadership-award": { file: { src: "/photos/pops/leadership-award.jpg", width: 600, height: 800 }, alt: "Me holding my Cockrell Student Leadership Award certificate", caption: "Getting the Cockrell School undergraduate leadership award.", crop: null },
    sandboarding: { file: { src: "/photos/pops/sandboarding.jpg", width: 600, height: 800 }, alt: "Me sandboarding down a dune in the Dubai desert", caption: "Sandboarding on dunes just outside of Dubai", crop: null },
    "downhill-skating": { file: { src: "/photos/pops/downhill-skating.jpg", width: 600, height: 800 }, alt: "My skateboards and longboards lined up at the back of my Miata", caption: "A collection of boards, although only half of these are mine", crop: null },
    skydiving: { file: { src: "/photos/pops/skydiving.jpg", width: 800, height: 600 }, alt: "Me in freefall on a tandem skydive", caption: "Me on my first jump, look at that smile!", crop: null },
    "rock-climbing": { file: { src: "/photos/pops/rock-climbing.jpg", width: 600, height: 800 }, alt: "Me climbing a wall at a bouldering gym", caption: "Catch me on El Capitan next... right...", crop: null },
    "venezuela-flag": { file: { src: "/photos/pops/venezuela-flag.jpg", width: 600, height: 800 }, alt: "Me holding a Venezuelan flag in a convention hall", caption: "Me repping my flag at SHPE 2025!", crop: null },
    matcha: {
      file: { src: "/photos/pops/matcha.jpg", width: 600, height: 800 },
      alt: "A matcha from 7T+ in Kyoto",
      caption: "7T+ is my favorite matcha place in the world, literally in the world. This one is in Kyoto.",
      crop: null,
      href: "https://www.google.com/maps/search/?api=1&query=35.0025497%2C135.7652173",
      hrefLabel: "Open in Google Maps",
    },
    "sister-kyoto": { file: { src: "/photos/pops/sister-kyoto.jpg", width: 800, height: 717 }, alt: "Me and my sister in the Arashiyama bamboo grove in Kyoto", caption: null, crop: null },
    "contrabass-clarinet": { file: { src: "/photos/pops/contrabass-clarinet.jpg", width: 600, height: 800 }, alt: "Me, on the right, holding a contrabass clarinet next to my friend with a baritone saxophone", caption: "Bass clarinet was my main instrument. In concert season I played contrabass.", crop: null },
    // A film character, so the alt describes the picture rather than me.
    rango: { file: { src: "/photos/pops/rango.jpg", width: 599, height: 800 }, alt: "Rango, the chameleon in a Hawaiian shirt, in a dance pose", caption: "yeah, this guy from that one kid's movie", crop: null },
    // Not me in these three: the alts describe the picture, and the logo's file is flattened onto the light background token so it reads in both themes.
    "catatumbo-lightning": { file: { src: "/photos/pops/catatumbo-lightning.jpg", width: 800, height: 577 }, alt: "Lightning forking through a huge storm cloud over a dark sea with sailboats at anchor", caption: "The lightning in question", crop: null },
    "lake-maracaibo": { file: { src: "/photos/pops/lake-maracaibo.jpg", width: 250, height: 342 }, alt: "A vintage Venezuelan stamp showing the bridge over Lake Maracaibo and a tanker passing beneath it", caption: "The famous Puente General Rafael Urdaneta over Lake Maracaibo.", crop: null },
    "ut-ece-logo": { file: { src: "/photos/pops/ut-ece-logo.jpg", width: 800, height: 243 }, alt: "The UT Austin Chandra Department of Electrical and Computer Engineering logo", caption: "UT Austin Electrical and Computer Engineering", crop: null },
  },
};

// Own keys only: "constructor" and friends live on every object's prototype.
export function registerHas(kind: InlineKind, key: string): boolean {
  return Object.hasOwn(register[kind], key);
}

export function resolveTip(entry: TipEntry, hasAdaptedTrack: boolean): string {
  if (!entry.adaptedClause || hasAdaptedTrack) return entry.text;
  return entry.text.replace(entry.adaptedClause, "");
}
