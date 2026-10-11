import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, visibleText } from "@/lib/content/links";
import { register, registerHas } from "@/lib/content/register";
import { ALPHABET } from "@/lib/footer/face";
import { walkStrings } from "@/lib/testing/walk";

// The approved copy of the sections that render today, pinned word for word
// (docs/content: who-i-am, right-now-and-metrics, connect-footer-band,
// mark-card, system-pages; approved by Aaron on 2026-10-08). A change to one of
// these strings is a change to his words and should fail here first.

const { meta, whoIAm, metrics, connect, listen, mark, notFound, errorPage, footer } = siteContent;
const referenced = (source: string) =>
  parseInlineLinks(source, () => true).segments.flatMap((segment) =>
    segment.kind === "def" || segment.kind === "tip" || segment.kind === "pop" ? [`${segment.kind}:${segment.key}`] : [],
  );
const externals = (source: string) => parseInlineLinks(source, registerHas).segments.flatMap((segment) => (segment.kind === "external" ? [segment.href] : []));
const known = (target: string) => {
  const [kind, key] = target.split(":");
  return registerHas(kind as "def" | "tip" | "pop", key);
};

describe("the page description", () => {
  it("is the one line for a link preview or a bio", () => {
    expect(meta.description).toBe("I'm a product-focused engineer at UT Austin. I build for people, and I love leading them towards building great things.");
  });
});

describe("Who I am", () => {
  it("keeps the label for the landmark and the nav, the lowercase heading and the small print as typed", () => {
    expect(whoIAm.label).toBe("Who I am");
    expect(whoIAm.heading).toBe("who I am");
    expect(whoIAm.smallPrint).toBe("Fourth-year Electrical and Computer Engineering student at UT Austin (and a business minor from McCombs)");
  });

  it("has four labeled blocks in order, lowercase labels and parentheses as typed, and only the third has a sub-block", () => {
    expect(whoIAm.blocks.map((block) => block.label)).toEqual(["what I do", "what I love (to work on)", "what I love (outside of work)", "where I'm from"]);
    expect(whoIAm.blocks.map((block) => Boolean(block.sub))).toEqual([false, false, true, false]);
    expect(whoIAm.blocks[2].sub?.label).toBe("(hobbies)");
    expect(whoIAm.blocks[0].body).toContain("Electrical and Computer Engineering (ECE) at UT Austin");
    expect(whoIAm.blocks[2].body).toContain("(family & friends)");
  });

  it("reads each block as a visitor sees it", () => {
    expect(whoIAm.blocks.map((block) => visibleText(block.body))).toEqual([
      "I'm a product-focused engineer. I study Electrical and Computer Engineering (ECE) at UT Austin, but I spend most of my time building and talking to the people I'm building for. I like products that bend for the person using them, not the other way around.",
      "I tend to gravitate towards leadership positions because I love getting a group of people with very different skillsets working towards one goal. I learned it as a drum major in high school, continued doing it in my orgs on campus, and want to do the same in my full-time work.",
      "I love people (family & friends) outside of work too. I strive to surround myself with people who lift each other up and help me grow every day. Most of my favorite experiences involve spending time with others!",
      "I was born in Maracaibo, Venezuela, and moved to the U.S. when I was around 4. I grew up in Texas, mostly in Katy, watching my dad figure out a business as he went. I worked in it too, which is where I learned to wear a lot of hats.",
    ]);
    expect(visibleText(whoIAm.blocks[2].sub!.body)).toBe(
      "I love to travel, tinker on personal projects, and getting active. I love credit card-maxxing since it allows me to fulfill my wanderlust, recently got into 3D printing because it lets me work on the engineering I don't get to do in class, and love extreme sports like downhill skating, skydiving, and rock climbing.",
    );
  });

  it("links the definition and six pops, for leadership, the hobbies and the roots, and nothing else", () => {
    expect(whoIAm.blocks.flatMap((block) => [block.body, ...(block.sub ? [block.sub.body] : [])]).flatMap(referenced)).toEqual([
      "def:product",
      "pop:leadership-award",
      "pop:sandboarding",
      "pop:downhill-skating",
      "pop:skydiving",
      "pop:rock-climbing",
      "pop:venezuela-flag",
    ]);
  });

  it("leaves 3D printing as plain words until its photo exists", () => {
    expect(whoIAm.blocks[2].sub?.body).toContain("recently got into 3D printing because");
    expect(registerHas("pop", "3d-print")).toBe(false);
  });
});

describe("where the links sit, pinned as raw markup", () => {
  it("keeps every Who I am link on its approved words", () => {
    expect(whoIAm.blocks.map((block) => block.body)).toEqual([
      "I'm a [product](def:product)-focused engineer. I study Electrical and Computer Engineering (ECE) at UT Austin, but I spend most of my time building and talking to the people I'm building for. I like products that bend for the person using them, not the other way around.",
      "I tend to gravitate towards [leadership positions](pop:leadership-award) because I love getting a group of people with very different skillsets working towards one goal. I learned it as a drum major in high school, continued doing it in my orgs on campus, and want to do the same in my full-time work.",
      "I love people (family & friends) outside of work too. I strive to surround myself with people who lift each other up and help me grow every day. Most of my favorite experiences involve spending time with others!",
      "I was born in Maracaibo, [Venezuela](pop:venezuela-flag), and moved to the U.S. when I was around 4. I grew up in Texas, mostly in Katy, watching my dad figure out a business as he went. I worked in it too, which is where I learned to wear a lot of hats.",
    ]);
    expect(whoIAm.blocks[2].sub?.body).toBe(
      "I love to travel, tinker on personal projects, and getting active. I love credit card-maxxing since it allows me to fulfill my wanderlust, recently got into 3D printing because it lets me work on the engineering I don't get to do in class, and love [extreme sports](pop:sandboarding) like [downhill skating](pop:downhill-skating), [skydiving](pop:skydiving), and [rock climbing](pop:rock-climbing).",
    );
  });

  it("keeps Connect's calendar link, matcha pop and footnote on their approved words", () => {
    expect(connect.body).toBe(
      "I check everything (or Talos does) so take your pick. If you want to talk screen to screen, [grab a time on my calendar](https://cal.com/aaron-sulbaran). If you're in my city, let's grab a coffee ([or matcha](pop:matcha)). I take coffee chats with anyone, no matter what you're building[*](tip:killer-drones).",
    );
  });

  it("keeps the mark card's four paragraphs on my words and their links", () => {
    expect(mark.lines).toEqual([
      "Here's my thought process behind the logo. The A is me. The bolt (which forms the S in my last name) is a nod to a few things:",
      "My gamer tag growing up: [VoltaageArc](tip:voltaage) ([Voltage](def:voltage) + [two A's](tip:two-as) + [Arc](def:arc))",
      "[Catatumbo Lightning](pop:catatumbo-lightning), also known as \"The Everlasting Storm\", is an atmospheric phenomenon that occurs over [Lake Maracaibo](pop:lake-maracaibo) (where I was born), causing persistent lightning storms year-round. Hope you learned something new.",
      "My major: [Electrical and Computer Engineering](pop:ut-ece-logo)... this one is pretty self explanatory.",
    ]);
  });
});

describe("the numbers strip", () => {
  it("heads the strip with its own lowercase title, labels the GitHub chart and holds my LinkedIn line as one figure", () => {
    expect(metrics.title).toBe("proof of work");
    expect(metrics.groupLabel).toBe("My GitHub contributions");
    expect(metrics.slots.linkedin).toEqual({ value: "450,000", label: "LinkedIn impressions in 3 months", sub: "2,500+ followers" });
    expect(metrics.slots.fun).toBeNull();
  });
});

describe("Connect", () => {
  it("asks wanna chat? in lowercase and reads the body as a visitor sees it", () => {
    expect(connect.label).toBe("Connect");
    expect(connect.heading).toBe("wanna chat?");
    expect(visibleText(connect.body)).toBe(
      "I check everything (or Talos does) so take your pick. If you want to talk screen to screen, grab a time on my calendar. If you're in my city, let's grab a coffee (or matcha). I take coffee chats with anyone, no matter what you're building*.",
    );
  });

  it("draws each link row as its platform's mark, and keeps the platform name for assistive tech", () => {
    expect(connect.links.map((link) => [link.label, link.icon])).toEqual([["LinkedIn", "linkedin"], ["GitHub", "github"], ["Email", "mail"], ["Instagram", "instagram"], ["X", "x"]]);
  });

  it("links the calendar, the matcha pop and the killer-drones footnote", () => {
    expect(referenced(connect.body)).toEqual(["pop:matcha", "tip:killer-drones"]);
    expect(externals(connect.body)).toEqual(["https://cal.com/aaron-sulbaran"]);
  });

  it("has one big link, Book some time, to the same calendar", () => {
    expect(connect.primary).toEqual({ label: "Book some time", href: "https://cal.com/aaron-sulbaran" });
  });

  it("lists the five links in order with the handle each shows, and drops the school address", () => {
    expect(connect.links).toEqual([
      { key: "linkedin", icon: "linkedin", label: "LinkedIn", handle: "in/aaron-sulbaran", href: "https://www.linkedin.com/in/aaron-sulbaran/" },
      { key: "github", icon: "github", label: "GitHub", handle: "aaron-sulbaran", href: "https://github.com/aaron-sulbaran" },
      { key: "email", icon: "mail", label: "Email", handle: "aarondsulbaran@gmail.com", href: "mailto:aarondsulbaran@gmail.com" },
      { key: "instagram", icon: "instagram", label: "Instagram", handle: "aaron.sulbaran", href: "https://www.instagram.com/aaron.sulbaran/" },
      { key: "x", icon: "x", label: "X", handle: "@imaaronsulbaran", href: "https://x.com/imaaronsulbaran" },
    ]);
    expect(JSON.stringify(connect)).not.toContain("utexas.edu");
  });
});

describe("the music band", () => {
  it("asks, offers and answers in my words", () => {
    expect(listen.line).toBe("Want some music while you scroll?");
    expect(listen.body).toBe("Yeah, I put [music](tip:music-note) on my website. It moves with you.");
    expect(listen.accept).toBe("Play it");
    expect(listen.decline).toBe("Not now");
    expect(listen.acceptedNote).toBe("Enjoy! Control it from the [evolving isle](tip:evolving-isle).");
    expect(listen.declinedNote).toBe("No problem, it's here if you change your mind.");
  });

  it("drops the evolving isle sentence on phones, which have no pill", () => {
    expect(listen.acceptedNotePhone).toBe("Enjoy!");
    expect(referenced(listen.acceptedNotePhone)).toEqual([]);
  });

  it("leaves the paused note and the controls as they were", () => {
    expect(listen.pausedNote).toBe("Paused. Resume whenever you like.");
    expect([listen.pause, listen.resume, listen.freeze, listen.unfreeze]).toEqual(["Pause", "Resume", "Freeze the wave", "Let the wave move"]);
  });

  it("points its two tips at the register", () => {
    expect(referenced(listen.body)).toEqual(["tip:music-note"]);
    expect(referenced(listen.acceptedNote)).toEqual(["tip:evolving-isle"]);
  });
});

describe("the mark card", () => {
  it("tells the story in my words, the subtitle lowercase as typed", () => {
    expect(mark.title).toBe("I made myself a logo");
    expect(mark.subtitle).toBe("good job, you found my easter egg!");
    expect(mark.lines.map(visibleText)).toEqual([
      "Here's my thought process behind the logo. The A is me. The bolt (which forms the S in my last name) is a nod to a few things:",
      "My gamer tag growing up: VoltaageArc (Voltage + two A's + Arc)",
      "Catatumbo Lightning, also known as \"The Everlasting Storm\", is an atmospheric phenomenon that occurs over Lake Maracaibo (where I was born), causing persistent lightning storms year-round. Hope you learned something new.",
      "My major: Electrical and Computer Engineering... this one is pretty self explanatory.",
    ]);
    expect(mark.button).toBe("Keep exploring!");
  });

  it("links the gamer tag tips and definitions, and the three photo pops", () => {
    expect(mark.lines.flatMap(referenced)).toEqual([
      "tip:voltaage", "def:voltage", "tip:two-as", "def:arc", "pop:catatumbo-lightning", "pop:lake-maracaibo", "pop:ut-ece-logo",
    ]);
  });
});

describe("the system pages", () => {
  it("keeps the 404 and rewrites only the error body", () => {
    expect(notFound).toEqual({
      title: "Nothing here.",
      body: "I moved things around while building this out. The page you're looking for doesn't exist.",
      cta: "Back to home",
    });
    expect(errorPage).toEqual({ title: "Something went wrong.", body: "That one's on me, not you. Try again, and if it keeps breaking, let me know.", retry: "Try again" });
  });
});

describe("the footer", () => {
  it("says only when it was last updated, keeps the copyright, and names the wordmark and its period", () => {
    expect(footer.tagline("September 2026")).toBe("Last updated September 2026");
    expect(footer.copyright).toBe("© 2026 Aaron Sulbaran");
    expect(footer.wordmark).toBe("build.stuff");
    expect(footer.dropPeriod).toBe("Drop the period");
    for (const c of footer.wordmark) expect(ALPHABET, c).toContain(c);
  });
});

describe("what this copy never references", () => {
  const leaves = walkStrings(siteContent);

  it("points every link it carries at a key the register holds", () => {
    const targets = leaves.flatMap((leaf) => referenced(leaf.text));
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((target) => !known(target))).toEqual([]);
  });

  it("uses no tip still marked proposed, and not the parentheses tip", () => {
    const proposed = Object.entries(register.tip).filter(([, entry]) => entry.proposed).map(([key]) => `tip:${key}`);
    const targets = leaves.flatMap((leaf) => referenced(leaf.text));
    expect(proposed).toEqual([]);
    expect(targets.filter((target) => proposed.includes(target) || target === "tip:parentheses")).toEqual([]);
  });

  it("holds none of the placeholder lines this copy replaced", () => {
    const text = leaves.map((leaf) => leaf.text).join("\n");
    for (const stale of [
      "Building products (and community)",
      "This site grows with me",
      "An unexpected error occurred",
      "What I'm up to right now",
      "The longer version of who I am",
      "I put together a short playlist",
      "Keep going, the music will follow",
      "My initials, A and S",
      "Say hi",
      "Let's talk.",
      "Email (UT Austin)",
    ]) {
      expect(text, stale).not.toContain(stale);
    }
    expect("about" in siteContent).toBe(false);
    expect("upToNow" in siteContent).toBe(false);
  });
});
