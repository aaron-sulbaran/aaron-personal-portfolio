// The one width the lab's band card needs: beside the band's copy from 1024px
// up. Below it, on a desktop, the player docks at the isle instead (client
// only; the functions read the window when called, and the server snapshot
// says roomy).
export const ROOMY_QUERY = "(min-width: 1024px)";

export const subscribeRoomy = (onChange: () => void) => {
  const query = window.matchMedia(ROOMY_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export const isRoomy = () => window.matchMedia(ROOMY_QUERY).matches;
