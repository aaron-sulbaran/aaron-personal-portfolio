// The one store the site uses, on real localStorage. A write from another tab
// reloads this one's state.
import { QUEST } from "./constants";
import { isQuestId } from "./registry";
import { createQuestStore } from "./store";

export const questStore = createQuestStore({
  storage: () => (typeof localStorage === "undefined" ? null : localStorage),
  knownId: isQuestId,
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === QUEST.storageKey) questStore.reload();
  });
}
