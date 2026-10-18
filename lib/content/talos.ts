import type { TalosTeam } from "./types";

// What the Talos modal adds to the card's two paragraphs: the lockup the sting
// ends on, where Talos is headed (the specialists), and what its reactions mean.
// The marks and emoji are the brand kit's files, shown as they are
// (public/work/logos/talos). The paragraphs are drafts for Aaron to edit.
export const talosTeam: TalosTeam = {
  lockup: {
    alt: "The Talos mark: a bronze coin with a T struck into it, and the word Talos",
    light: "/work/logos/talos/lockup-light.svg",
    dark: "/work/logos/talos/lockup-dark.svg",
    width: 1330,
    height: 432,
  },
  next: "Next, Talos becomes a team of specialists: mail, school, a war room for deadlines, and a writer. Each runs with only the tools its job needs, and each has its own mark, so I can see which one is talking. They report to Talos, and Talos reports to me.",
  specialistsLabel: "The Talos specialists",
  specialists: [
    { name: "Talos mail", job: "Reads my inboxes and drafts replies for me to approve.", src: "/work/logos/talos/specialists/mail.svg", alt: "Talos mail's mark" },
    { name: "Talos school", job: "Turns my coursework into study guides.", src: "/work/logos/talos/specialists/school.svg", alt: "Talos school's mark" },
    { name: "Talos war room", job: "Keeps track of what's due and what's open this week.", src: "/work/logos/talos/specialists/war-room.svg", alt: "Talos war room's mark" },
    { name: "Talos writer", job: "Drafts the first version of anything I need to write.", src: "/work/logos/talos/specialists/writer.svg", alt: "Talos writer's mark" },
  ],
  reactions: "Every message gets a reaction, carried by the shape of the figure, never by color, so it reads at any size and for anyone who doesn't see color. Only one is bronze: needs-you, the moment something is waiting on me.",
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
