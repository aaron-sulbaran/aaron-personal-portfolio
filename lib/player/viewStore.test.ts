import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MachineConfig } from "./machine";
import { getPlayerView, sendPlayer, subscribePlayer } from "./viewStore";

const config: MachineConfig = { phone: false, roomy: true, reduce: false };

describe("the player's view store", () => {
  beforeEach(() => sendPlayer({ type: "stopped" }, config));

  it("starts closed and follows the machine", () => {
    expect(getPlayerView()).toBe("closed");
    sendPlayer({ type: "started", zone: "in" }, config);
    expect(getPlayerView()).toBe("band");
    sendPlayer({ type: "zone", zone: "past" }, config);
    expect(getPlayerView()).toBe("to-pill");
    sendPlayer({ type: "arrived" }, config);
    expect(getPlayerView()).toBe("pill");
  });

  it("tells subscribers once per change, and not for an event that changes nothing", () => {
    const listener = vi.fn();
    const stop = subscribePlayer(listener);
    sendPlayer({ type: "zone", zone: "past" }, config);
    expect(listener).not.toHaveBeenCalled();
    sendPlayer({ type: "started", zone: "ahead" }, config);
    expect(listener).toHaveBeenCalledTimes(1);
    sendPlayer({ type: "zone", zone: "ahead" }, config);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    sendPlayer({ type: "stopped" }, config);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
