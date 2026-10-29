// Where page 1's foot put the ribbon (slice 4d): the slot ([data-coil-ribbon])
// the page leaves for the row of cards, as the center of its height from the
// canvas's top. The page owns the layout (components/home/Intro.tsx, CSS and
// the lab's knobs); the scene reads the marker once per layout and on a resize,
// never in a frame, measured against the rail the stage sticks in, not the
// stage: the rail's top is where the stage sits when the page is not scrolled
// past it, so a layout done while the page is scrolled still puts the ribbon
// where page 1's foot has it. A page with no slot (or no rail) measures as
// nothing, and the scene falls back to COIL.deal.ribbon.anchorY.

export type RibbonBox = {
  // The ribbon's center, from the canvas's top (as it sits in the rail), or null.
  cy: number | null;
  // How far the "Deal me in" button's middle sits from the canvas's middle across, px: the
  // row gathers toward it at the click.
  buttonDx: number;
  // The room above the slot, px: from block 4's foot (the late grid's bottom) to the slot's
  // top. The ribbon's lead on the click stays inside it. Null when it was not measured.
  roomAbove: number | null;
};

export const NO_RIBBON: RibbonBox = { cy: null, buttonDx: 0, roomAbove: null };

export function measureRibbon(host: HTMLElement): RibbonBox {
  const rail = host.closest("[data-coil-rail]")?.getBoundingClientRect();
  if (!rail) return NO_RIBBON;
  const slot = document.querySelector("[data-coil-ribbon]")?.getBoundingClientRect();
  const button = document.querySelector("[data-deal-button]")?.getBoundingClientRect();
  const late = document.querySelector("[data-intro-late]")?.getBoundingClientRect();
  const stage = host.getBoundingClientRect();
  const placed = slot && slot.height > 0;
  return {
    cy: placed ? slot.top + slot.height / 2 - rail.top : null,
    buttonDx: button && button.width > 0 ? button.left + button.width / 2 - (stage.left + stage.width / 2) : 0,
    roomAbove: placed && late ? Math.max(0, slot.top - late.bottom) : null,
  };
}
