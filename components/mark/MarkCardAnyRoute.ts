// The mark card under a second name, so a route without the home page's
// import() (lib/mark/cardChunk) loads it through a loader of its own. One
// target imported from both the layout and the page shares one loader, built
// against the layout's chunk group, and the page's would carry GSAP again.
export { MarkCard } from "@/components/mark/MarkCard";
