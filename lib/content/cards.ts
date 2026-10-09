import type { CardKey, Cards } from "./types";

// The fourteen launch cards (docs/content/cards.md, approved 2026-10-08), in strand order.
// A null visual ref is an asset C4 has not landed; every card opens a modal.
export const cards: Cards = {
  mentorship: {
    // The crop is a box in the 1084 by 724 repo copy (layout only): docs/content/photos.md's
    // 860,0,2984,2832 on the 4240 by 2832 original, scaled. C4 exports the original.
    group: "people", visual: { kind: "photo", flipX: false, photo: { src: "/photos/hsf-speaking.jpeg", width: 1084, height: 724, crop: { x: 220, y: 0, w: 543, h: 724 }, alt: "Me speaking into a microphone at a Hispanic Scholarship Fund event" } },
    book: { title: "Mentorship", meta: "Coach, tutor and speaker, ongoing" },
    modal: { kind: "logo", title: "Mentorship", picture: { caption: "Me speaking at my first HSF STEM Summit." }, links: [{ label: "Grab some time with me", href: "https://cal.com/aaron-sulbaran" }], photos: [], blocks: [
      "I wouldn't be where I am now without the mentors who have shaped me. People made time for me, so I make time back. I've coached first-year scholars, worked as a student mentor on campus, and been an official mentor to Hispanic Scholarship Fund (HSF) scholars at the annual STEM Summit.",
      "I take coffee chats in both directions. If I'm asking people for their time, I should be willing to give mine, and I lose track of time in them.",
    ] },
    // Held empty on purpose: each mentor's name and link go in once that person agrees to be named.
    mentors: { title: "the people who shaped me", people: [] },
  },
  "min-max": {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain", subtitle: "minimize spend. Maximize rewards" },
    book: { title: "min/Max", meta: "Founder, 2025 to now" },
    modal: { kind: "logo", title: "min/Max", links: [], photos: [], blocks: [
      "An agentic credit card co-pilot that automatically picks the best card in your wallet for every purchase, every time. I haven't launched yet, but when I do you'll be the first to know.",
    ] },
  },
  band: {
    group: "people", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Jordan High School band", meta: "Section leader to drum major, 2021 to 2023" },
    modal: { kind: "logo", title: "The band", meta: "Drum major, 2021 to 2023", picture: { caption: "Me as drum major in my last year of high school." }, links: [{ label: "Check out my final performance ever", href: "https://www.youtube.com/watch?v=wra00zjxQcU&list=PLeolsE0k0lv8&index=7" }], photos: [], blocks: [
      "I joined Jordan High School's band the year the school opened, as a section leader. I became woodwind captain junior year, then drum major in my last year. I played [bass clarinet](pop:contrabass-clarinet).",
      "The band kept growing as the school grew, and we started winning. We won a regional championship just before I left. After I graduated, the band won an invitational I *know* it had been chasing for years. I still count that win as partly mine.",
      "Leading a few hundred students towards the same goal through a score and a marching dot book is where I realized I first fell in love with leadership.",
    ] },
  },
  talos: {
    group: "work", visual: { kind: "logo", logo: null, tile: "anvil" },
    book: { title: "Talos", meta: "Builder, 2026" },
    modal: { kind: "logo", title: "Talos", links: [], photos: [], blocks: [
      "Talos is my executive assistant. Every day it builds my itinerary, reads all my inboxes, my messages, and tells me what needs me first. I'm currently training it to take action autonomously, with lots of safeguards in place. Its limits are written in code, not in prompts.",
      "I built it because I wanted a use of AI in my life that did something real. It started at a one-day Vercel hackathon in New York and saves me hours every week. I plan to open source it.",
    ] },
  },
  travel: {
    group: "people", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Travel", meta: "Yosemite, Mt. Fuji and more" },
    modal: { kind: "photo", title: "Travel", picture: { caption: "Me at Yosemite on a trip to San Francisco with my friends." }, links: [], photos: [], blocks: [
      "I love to travel, and I try to be intentional about it. Japan and Dubai are two of my favorite trips ever. I have lots of exciting travel planned soon and can't wait to go! If you have destination recs, feel free to let me know!",
      "A huge inspiration and fuel for my love for travel is [my sister](pop:sister-kyoto), Barbara. I call her hermana but the world knows her as \"Travel with Barbs\" and she owns her own travel agency called \"[Sulara](https://sularatravel.com/).\" She's my inspiration to, above all, follow your dreams, go [check her out](https://www.instagram.com/travelwithbarbss/)!",
    ] },
  },
  "capital-one": {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "Capital One", meta: "Intern, 2024 to 2026" },
    modal: { kind: "logo", title: "Capital One", links: [], photos: [], blocks: [
      "I spent three summers at Capital One, and each one moved me closer to product.",
      "**2024, business analyst.** My first look at corporate America. I met my first product manager, who told me a PM is a manager \"that gets people to trust them and their decisions without having the power to change their salaries.\" That sentence changed my career trajectory.",
      "**2025, product manager.** The summer I started explaining the job to other people. Explaining it made me realize how much I enjoyed the work that comes with being a PM.",
      "**2026, applied AI (product manager).** My first stab at building agentic workflows inside Capital One's internal machine learning tools to test how those models behaved.",
      "If you want to learn more, I'll say what I can in person.",
    ] },
  },
  hackathons: {
    group: "work", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Hackathons", meta: "Builder, 2026 to now" },
    // UFCU first, so the card picture (the UFCU win, beside the title) sits next to its own paragraph (docs/content/cards.md).
    modal: { kind: "logo", title: "Hackathons", picture: { caption: "Me and my team winning UFCU Develop U, September 2026." }, links: [], photos: [], blocks: [
      "**UFCU Develop U, fall 2026.** Won with UFCU Front Desk, a digital front desk assistant that makes joining a credit union simple and still sounds like them.",
      "**Hook 'Em Hacks, spring 2026.** Won the finance track with the first build and MVP/Proof of Concept of min/Max.",
      "**Vercel one-day hackathon, New York.** Where I started Talos.",
      "HackTX & others, coming soon.",
    ] },
  },
  anthropic: {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "Anthropic", meta: "Claude Campus Ambassador, 2026" },
    modal: { kind: "logo", title: "Anthropic", links: [{ label: "txclaude.org", href: "https://txclaude.org" }], photos: [], blocks: [
      "In spring 2026 I was a Claude ambassador at UT Austin. We grew the club to over a thousand members, with meetings of 60 to 80 people on average and about 100 at our end of year hackathon.",
      "What I loved most was teaching people to use these tools fast. By the end of the meetings, students were already building their own things with skills they developed in one hour classes I helped lead.",
    ] },
  },
  misuki: {
    group: "people", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Misuki", meta: "2001 Mazda Miata, five-speed" },
    modal: { kind: "photo", title: "Misuki", picture: { caption: "Me and Misuki at a Longhorn Card Club photo shoot." }, links: [], photos: [], blocks: [
      "I worked all through high school to set myself up for college. That included an ongoing hunt for a car. I ended up buying this car early Senior year in cash, because I didn't want a car loan. The day my dad went to buy her for me, I was conducting a game-day halftime show and got a bank alert on my watch for a huge withdrawal from my bank account. I was nervous the whole performance, and then found out later he was trying to surprise me.",
      "Her engine blew in college, a family friend in Houston rebuilt it, and she's still my daily driver. I named her Misuki, from the M in Mazda and a nod to [Fast and Furious](tip:misuki-suk). I took her around Circuit of the Americas once, and it was one of the most fun days of my life.",
    ] },
  },
  ieee: {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "IEEE UT Austin", meta: "President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026" },
    modal: { kind: "logo", title: "IEEE UT Austin", meta: "President, 2023 to 2026", links: [{ label: "ieee.ece.utexas.edu", href: "https://ieee.ece.utexas.edu/" }], photos: [], blocks: [
      "IEEE UT was my home away from home at UT. I credit much of my leadership development to my experience here. From assistant officer my freshman year to president my junior year, I made some of my closest friends in this organization.",
      "My Freshman year I helped host events to bring ECE majors together, particularly my fellow freshmen going through the same struggles I was going through. I also performed at Cockrell's yearly Ramshorn Talent show as \"Aango,\" a [Rango](tip:aango) knockoff that rapped.",
      "My Sophomore year I jumped to an exec role and started the year out with a balance sheet that said the previous year had $200 in profit (because we were spending everything we earned). I set a goal of $5K, answered company emails almost every day for a school year, and we ended at about $10K.",
      "My Junior year I helped lead the org I came to love and helped bring home the Outstanding Large Student Branch Chapter award, served as the broader IEEE Central Texas Section student representative, and wore many hats as I supported my fellow officers for one final year.",
      "My proudest moments in IEEE came when ECE students told me that a company I brought to an IEEE event is the reason they got their internships or jobs. I aim to never stop making an impact, no matter where I go.",
    ] },
  },
  jobs: {
    group: "people", visual: { kind: "circles" },
    book: { title: "\"unflattering\" jobs that paid for school", meta: "Popeyes to Aritzia, 2021 to 2026" },
    modal: { kind: "timeline", title: "The jobs that paid my way", links: [{ label: "The LinkedIn post", href: "https://lnkd.in/p/g3mXFGcY" }], photos: [], blocks: [
      "I'm self-funded, so I've worked almost every year since high school. Those jobs paid for my car in cash, covered rent, and chipped away at tuition so I could graduate debt free.",
      "The money (although it was necessary) isn't what I took away. I realized that after finishing my degree, I have my whole life to work off a screen and specs. So I intentionally went looking for jobs where someone walks up with a problem and you solve it face to face in that shift. I think some people want to move away from service industry jobs as quickly as possible once they're in school, but I took it as an opportunity to try out some different things before claiming a desk in an office.",
      "I wrote about my work experience outside of class on LinkedIn, and my hook was \"I don't trust people who haven't worked an unflattering job.\" It got 130,000 impressions and almost a thousand reactions. My favorite line is \"You know to be nice to the person behind the counter because you were the person behind the counter.\" I guess it resonated with people.",
    ] },
    timeline: [
      { employer: "Popeyes", role: null, when: "Sophomore year of high school", logo: null,
        tip: "Get the blackened tenders every time, they have to make them fresh usually (bonus points if you can get them on a spicy chicken sandwich, secret menu item)" },
      { employer: "MOD Pizza", role: null, when: "Sophomore to senior year of high school", logo: null,
        tip: "Try the sri-rancha and hot honey sauce combo. Also mix their berry lemonade with sprite and powerade for a mocktail my store called the \"galaxy\"" },
      { employer: "Student mentor, UT Austin", role: null, when: "Sophomore year of college", logo: null,
        tip: "Use your college resources! This one is a no brainer but if you don't we just get paid to do homework" },
      { employer: "Apple", role: "Specialist, then technical specialist", when: "2024 to 2025", logo: null,
        tip: "Get AppleCare and some sort of cloud storage. Simple as that, it always broke my heart to see people lose their photos and have to shell out $1k for a new phone. And yes, Apple can't recover anything the privacy is real." },
      { employer: "Aritzia", role: null, when: "2025 to 2026", logo: null,
        tip: "My most random job. For the interview they asked me to dress in my best clothing, which I thought was funny. If you work here, all the women in your life will want a discount. With that said, the effortless pants and sweatfleece line are basically unisex products..." },
    ],
  },
  "this-site": {
    group: "work", visual: { kind: "mark" },
    book: { title: "This site", meta: "Portfolio (design playground), 2026" },
    modal: { kind: "logo", title: "This site", meta: "Portfolio, 2026", links: [{ label: "The repo on GitHub", href: "https://github.com/aaron-sulbaran/aaron-personal-portfolio" }], photos: [], blocks: [
      "I'm building this site and continuing to update it as I grow. I [design](tip:this-site-playground) it, write the specs, and manage a team of AI agents that help me build it, which is a good test of how I'd run a product team. The repo is public.",
    ] },
  },
  fsdatalink: {
    group: "people", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "The family business", meta: "Assistant Manager & SWE, 2022 to 2024" },
    modal: { kind: "logo", title: "My dad's business", links: [{ label: "fsdatalink.com", href: "https://www.fsdatalink.com/" }], photos: [], blocks: [
      "My dad built a telecom business from nothing. I figured things out right next to him. I learned small-business taxes and tax breaks, and I was fascinated that people used laws that would never exist in Venezuela. I ended up doing the accounting, the finances and whatever else needed solving, sometimes unpaid because I wanted to help him.",
      "I even took up the role of a software engineer, building internal tools and workflows for my dad and the field engineers that we dispatched. It's where (unknowingly) my interest in money, financial literacy, and optimizing technology started.",
    ] },
  },
  "building-in-public": {
    group: "people", visual: { kind: "photo", flipX: true, photo: null },
    book: { title: "Building in public", meta: "LinkedIn and X, ongoing" },
    modal: { kind: "logo", title: "Building in public", picture: { caption: "Me at Vercel Ship in New York City, one door LinkedIn opened this summer." }, links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/aaron-sulbaran/" }, { label: "X (@imaaronsulbaran)", href: "https://x.com/imaaronsulbaran" }], photos: [], blocks: [
      "I'm trying to build in public (tbh, I fell off for a couple of months and I'm easing back in). So far: 2,500+ people follow me on LinkedIn, and my posts have had 450,000 impressions in three months. Being active on LinkedIn opened doors in Toronto and NYC this summer and got me a few brand deals. After talking to enough founders and investors, I know I have to get on X next.",
      "While I love building, I also love creating and sharing. So why not share what works and what doesn't, with no polish on the parts that didn't. I'd rather be useful than look flawless.",
      "For every 100 people who think it's cringe, I get 1 person who DMs me saying \"your post inspired me to...\" and that makes it worth it to me.",
    ] },
  },
};

// The Coil's order; [0] is the lead card the visitor sees when it settles.
export const strandOrder: readonly CardKey[] = [
  "mentorship", "min-max", "band", "talos", "travel", "capital-one", "hackathons",
  "anthropic", "misuki", "ieee", "jobs", "this-site", "fsdatalink", "building-in-public",
];

// The book's two columns, in Aaron's doc order (not the strand's).
export const bookWorkOrder: readonly CardKey[] = ["min-max", "talos", "capital-one", "anthropic", "ieee", "hackathons", "this-site"];
export const bookPeopleOrder: readonly CardKey[] = ["mentorship", "band", "jobs", "fsdatalink", "misuki", "travel", "building-in-public"];
