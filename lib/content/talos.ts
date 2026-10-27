import type { TalosTeam } from "./types";

// What the Talos modal adds to the card's two paragraphs: the lockup the sting
// ends on, a screenshot of its Discord channel (the brand sheet's mock, rendered at
// 2x), and where Talos is headed. The specialists and the reaction legend are kept
// with their kit files (public/work/logos/talos) but the modal does not draw them
// now. The two paragraphs are my own words.
export const talosTeam: TalosTeam = {
  lockup: {
    alt: "The Talos mark: a bronze coin with a T struck into it, and the word Talos",
    light: "/work/logos/talos/lockup-light.svg",
    dark: "/work/logos/talos/lockup-dark.svg",
    width: 1330,
    height: 432,
  },
  discord: {
    alt: "My Talos HQ channel in Discord: Talos and its specialists posting their morning updates, with reactions showing each message's state.",
    light: "/work/logos/talos/discord-light.webp",
    dark: "/work/logos/talos/discord-dark.webp",
    width: 1064,
    height: 1974,
  },
  next: "The next step for Talos is that it becomes a team of specialists for different tasks in my life including mail, school, project manager, and a writing editor. Each one specially tuned to a specific set of tools for its job needs. Each also has its own design, so I can easily see which one needs me and in which channel. This is the next step to making Talos a truly multi-agent system.",
  specialistsLabel: "The Talos specialists",
  specialists: [
    { name: "Talos mail", job: "Reads my inboxes and drafts replies for me to approve.", src: "/work/logos/talos/specialists/mail.svg", alt: "Talos mail's mark" },
    { name: "Talos school", job: "Turns my coursework into study guides.", src: "/work/logos/talos/specialists/school.svg", alt: "Talos school's mark" },
    { name: "Talos war room", job: "Keeps track of what's due and what's open this week.", src: "/work/logos/talos/specialists/war-room.svg", alt: "Talos war room's mark" },
    { name: "Talos writer", job: "Drafts the first version of anything I need to write.", src: "/work/logos/talos/specialists/writer.svg", alt: "Talos writer's mark" },
  ],
  reactions: "Every message gets a custom reaction depending on its status. I designed them to have custom, intentional icons so they're easy to remember, regardless of the size or color for those that can't see it. Only one is a different color to signify the \"needs you\" warning when something needs my okay to move forward.",
  statesLabel: "What each Talos reaction means",
  states: [
    { name: "seen", meaning: "Talos heard you and will answer", src: "/work/logos/talos/states/seen.svg" },
    { name: "queued", meaning: "Busy with an earlier message; yours is next", src: "/work/logos/talos/states/queued.svg" },
    { name: "pointer", meaning: "Wrong channel; ask in #talos", src: "/work/logos/talos/states/pointer.svg" },
    { name: "stopped", meaning: "The breaker is on; nothing answers until it's cleared", src: "/work/logos/talos/states/stopped.svg" },
    { name: "held", meaning: "Out of model capacity; answered after the reset", src: "/work/logos/talos/states/held.svg" },
    { name: "failed", meaning: "Something broke answering that", src: "/work/logos/talos/states/failed.svg" },
    { name: "needs-you", meaning: "A draft or action is waiting for my approval", src: "/work/logos/talos/states/needs-you.svg" },
    { name: "done", meaning: "Finished", src: "/work/logos/talos/states/done.svg" },
  ],
};
