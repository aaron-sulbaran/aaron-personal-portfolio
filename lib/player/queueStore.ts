"use client";

import { useSyncExternalStore } from "react";
import { getSoundtrackPlayer } from "@/lib/audio";
import { siteContent } from "@/lib/content";
import { pauseSoundtrack, getSoundtrackState } from "@/lib/soundtrack";
import { createQueue, cycleRepeat, nextIndex, previousIndex, setRepeat, setShuffle, type Move, type Queue } from "./queue";

// The lab player's queue as a tiny store: shuffle and repeat live here (so the
// band's player, the isle and the island show the same toggles), and next,
// previous and a track's end go through the pure queue (./queue). The audio
// player is told to hand a track's end to this store only while a lab player
// is on screen (attachQueue), so with the lab off a track that ends moves to
// the next, as it always has.

let queue: Queue = createQueue(siteContent.soundtrack.tracks.length);
const listeners = new Set<() => void>();
let attached = 0;

const emit = () => listeners.forEach((listener) => listener());
const rng = () => Math.random();

export const getQueue = (): Queue => queue;

export const subscribeQueue = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useQueue(): Queue {
  return useSyncExternalStore(subscribeQueue, getQueue, getQueue);
}

function commit(next: Queue) {
  if (next === queue) return;
  queue = next;
  emit();
}

export function toggleShuffle(): void {
  commit(setShuffle(queue, !queue.shuffle, getSoundtrackPlayer().getSnapshot().trackIndex, rng));
}

export function cycleRepeatMode(): void {
  commit(setRepeat(queue, cycleRepeat(queue.repeat)));
}

// Plays what a move says, keeping the music's state: a press while paused only changes the track.
function apply(move: Move, autoplay: boolean) {
  commit(move.queue);
  if (move.index === null) return;
  const player = getSoundtrackPlayer();
  if (move.restart) {
    // A track that ended has stopped, so a repeat plays it again; a press only moves the playhead.
    player.seek(0);
    if (autoplay && !player.getSnapshot().playing) player.play();
    return;
  }
  player.selectTrack(move.index, autoplay);
}

export function skipNext(): void {
  const player = getSoundtrackPlayer();
  apply(nextIndex(queue, player.getSnapshot().trackIndex, "press", rng), getSoundtrackState() === "on");
}

export function skipPrevious(): void {
  const player = getSoundtrackPlayer();
  const { trackIndex } = player.getSnapshot();
  apply(previousIndex(queue, trackIndex, player.getPosition(), rng), getSoundtrackState() === "on");
}

// A track ended: the next in the queue plays, or the queue is over and the music pauses at the start of the first.
function ended(): boolean {
  const player = getSoundtrackPlayer();
  const move = nextIndex(queue, player.getSnapshot().trackIndex, "ended", rng);
  if (move.index === null) {
    commit(move.queue);
    player.seek(0);
    pauseSoundtrack();
    return true;
  }
  apply(move, true);
  return true;
}

// A lab player is on screen: the queue decides what follows a track. Counted, so two players can share it.
export function attachQueue(): () => void {
  const player = getSoundtrackPlayer();
  attached++;
  player.setEndedHandler(ended);
  return () => {
    attached--;
    if (attached <= 0) player.setEndedHandler(null);
  };
}
