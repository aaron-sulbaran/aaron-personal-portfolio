import type { InlineKind } from "./links";
import type { InlineRegister, TipEntry } from "./types";

// Every inline link the copy may point at (docs/content/tooltips.md, approved
// 2026-10-08). Pop photos are exported by C4; until then file is null.
export const register: InlineRegister = {
  def: {
    product: {
      title: "What a product is",
      body: "A product (to me) is a tool that's genuinely useful to someone and easy for them to pick up. If it's for everyone, anyone should get it on their first try. If it's for niche hobbyists, the hobbyists in that community should get it immediately. About 99% of the time a product should be built for the user instead of forcing the user to get used to the product. The other 1% is how you get a moonshot product like the iPhone, which didn't just change the way people use a phone (the product), it changed the world.",
    },
  },
  tip: {
    voltage: { text: "the electrical pressure from a power source that pushes electric charges through a conducting path in a circuit" },
    "two-as": { text: "(it's my name, A-Aron)" },
    voltaage: { text: "voltage + A + A", proposed: true },
    "killer-drones": { text: "unless it's killer drones, I don't do that" },
    "evolving-isle": { text: "not dynamic island, a nod to Apple" },
    "music-note": {
      text: "I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to, and I adapted a couple of the tracks myself in Epidemic Sound's studio. The credits are in the corner.",
      adaptedClause: ", and I adapted a couple of the tracks myself in Epidemic Sound's studio",
    },
    "ieee-ao": { text: "External Activities and Events Assistant Officer" },
    aango: { text: "yes, the chameleon from that one kid's movie" },
    "this-site-playground": { text: "this site is my design playground" },
    "misuki-suk": { text: "shoutout suk and her S2000" },
  },
  pop: {
    "leadership-award": { file: null, alt: "Me holding my Cockrell Student Leadership Award certificate", caption: "Getting the Cockrell School undergraduate leadership award.", crop: null },
    sandboarding: { file: null, alt: "Me sandboarding down a dune in the Dubai desert", caption: null, crop: null },
    "downhill-skating": { file: null, alt: "My skateboards and longboards lined up at the back of my Miata", caption: null, crop: null },
    skydiving: { file: null, alt: "Me in freefall on a tandem skydive", caption: null, crop: null },
    "rock-climbing": { file: null, alt: "Me climbing a wall at a bouldering gym", caption: null, crop: null },
    "venezuela-flag": { file: null, alt: "Me holding a Venezuelan flag in a convention hall", caption: null, crop: null },
    matcha: {
      file: null,
      alt: "A matcha from 7T+ in Kyoto",
      caption: "7T+ is my favorite matcha place in the world, literally in the world. This one is in Kyoto.",
      crop: null,
      href: "https://www.google.com/maps/search/?api=1&query=35.0025497%2C135.7652173",
      hrefLabel: "Open in Google Maps",
    },
    "sister-kyoto": { file: null, alt: "Me and my sister in the Arashiyama bamboo grove in Kyoto", caption: null, crop: null },
    "contrabass-clarinet": { file: null, alt: "Me, on the right, holding a contrabass clarinet next to my friend with a baritone saxophone", caption: "Bass clarinet was my main instrument. In concert season I played contrabass.", crop: null },
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
