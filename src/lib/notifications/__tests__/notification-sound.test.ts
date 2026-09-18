// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El módulo guarda el AudioContext en una variable de módulo: cada test lo
// importa de nuevo para no heredar el contexto del anterior.
async function loadModule() {
  vi.resetModules();
  return import("@/lib/notifications/notification-sound");
}

function fakeAudioContext(state: "running" | "suspended", resume: () => Promise<void>) {
  const oscillators: { frequency: { value: number }; start: ReturnType<typeof vi.fn> }[] = [];
  const Ctor = vi.fn(function (this: Record<string, unknown>) {
    const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    Object.assign(this, {
      state,
      currentTime: 0,
      destination: {},
      // Plain function, not vi.fn: vitest attaches handlers to promises its
      // mocks return, which would hide an unhandled rejection.
      resume,
      createOscillator: () => {
        const osc = {
          type: "",
          frequency: { value: 0 },
          connect: vi.fn((node: unknown) => node),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(osc);
        return osc;
      },
      createGain: () => ({ gain: param(), connect: vi.fn((node: unknown) => node) }),
    });
  });
  return { Ctor, oscillators };
}

function setUserActivation(hasBeenActive: boolean) {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { hasBeenActive },
  });
}

describe("notification sound", () => {
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    window.localStorage.clear();
    setUserActivation(true);
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    Reflect.deleteProperty(navigator, "userActivation");
    vi.restoreAllMocks();
  });

  describe("preference", () => {
    it("is on by default", async () => {
      const { isNotificationSoundEnabled } = await loadModule();
      expect(isNotificationSoundEnabled()).toBe(true);
    });

    it("persists mute and unmute on this device", async () => {
      const { isNotificationSoundEnabled, setNotificationSoundEnabled } = await loadModule();

      setNotificationSoundEnabled(false);
      expect(window.localStorage.getItem("rentalpro:notification-sound")).toBe("off");
      expect(isNotificationSoundEnabled()).toBe(false);

      setNotificationSoundEnabled(true);
      expect(window.localStorage.getItem("rentalpro:notification-sound")).toBeNull();
      expect(isNotificationSoundEnabled()).toBe(true);
    });

    it("falls back to sound on when storage is blocked", async () => {
      const { isNotificationSoundEnabled, setNotificationSoundEnabled } = await loadModule();
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });

      expect(isNotificationSoundEnabled()).toBe(true);
      expect(() => setNotificationSoundEnabled(false)).not.toThrow();
    });
  });

  describe("playNotificationSound", () => {
    it("plays two tones", async () => {
      const { Ctor, oscillators } = fakeAudioContext("running", () => Promise.resolve());
      window.AudioContext = Ctor as unknown as typeof AudioContext;
      const { playNotificationSound } = await loadModule();

      playNotificationSound();

      expect(oscillators.map((o) => o.frequency.value)).toEqual([880, 1318.51]);
      expect(oscillators.every((o) => o.start.mock.calls.length === 1)).toBe(true);
    });

    it("swallows the rejection when the browser refuses to resume audio", async () => {
      let resumeCalls = 0;
      const blocked = () => {
        resumeCalls++;
        return Promise.reject(new DOMException("not allowed", "NotAllowedError"));
      };
      const { Ctor } = fakeAudioContext("suspended", blocked);
      window.AudioContext = Ctor as unknown as typeof AudioContext;
      const { playNotificationSound, primeNotificationSound } = await loadModule();
      // Listen explicitly so the failure points at this test, not at the run.
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);

      try {
        expect(() => playNotificationSound()).not.toThrow();
        expect(() => primeNotificationSound()).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 10));
      } finally {
        process.off("unhandledRejection", unhandled);
      }

      expect(resumeCalls).toBe(2);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it("does not touch audio before the user has interacted with the page", async () => {
      setUserActivation(false);
      const { Ctor } = fakeAudioContext("suspended", () => Promise.resolve());
      window.AudioContext = Ctor as unknown as typeof AudioContext;
      const { playNotificationSound } = await loadModule();

      playNotificationSound();

      expect(Ctor).not.toHaveBeenCalled();
    });

    it("does nothing in a browser without Web Audio", async () => {
      Reflect.deleteProperty(window, "AudioContext");
      const { playNotificationSound } = await loadModule();

      expect(() => playNotificationSound()).not.toThrow();
    });
  });
});
