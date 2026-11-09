// Feeds the quest store from the stores that already know what the visitor
// found: cards opened (the seen store, per tab) and the page-1 words met (the
// visited store, persistent). Runs once on connect so earlier finds count.
import { getSeen, subscribeSeen } from "@/lib/home/seen";
import { getDiscovered, subscribeVisited } from "@/lib/inline/visited";
import { markQuestFound } from "./index";

function syncCards() {
  for (const key of getSeen()) markQuestFound(`card:${key}`);
}

function syncWords() {
  for (const id of getDiscovered()) markQuestFound(id);
}

export function connectQuestSources(): () => void {
  syncCards();
  syncWords();
  const stopSeen = subscribeSeen(syncCards);
  const stopVisited = subscribeVisited(syncWords);
  return () => {
    stopSeen();
    stopVisited();
  };
}
