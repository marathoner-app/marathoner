import { describe, expect, it, vi } from "vitest";
import {
  createModulePreloadRecoveryHandler,
  registerModulePreloadRecovery,
} from "./modulePreloadRecovery";

describe("module preload recovery", () => {
  it("replaces the current page once with a cache-busting retry URL", () => {
    const replace = vi.fn();
    const handlePreloadError = createModulePreloadRecoveryHandler({
      location: {
        href: "https://marathonerapp.com/?mode=signIn",
        replace,
      },
      createRetryValue: () => "release-retry",
    });
    const event = new Event("vite:preloadError", { cancelable: true });

    handlePreloadError(event);

    expect(event.defaultPrevented).toBe(true);
    expect(replace).toHaveBeenCalledWith(
      "https://marathonerapp.com/?mode=signIn&_module_retry=release-retry",
    );
  });

  it("allows the error to surface instead of looping after a retry", () => {
    const replace = vi.fn();
    const handlePreloadError = createModulePreloadRecoveryHandler({
      location: {
        href: "https://marathonerapp.com/?_module_retry=release-retry",
        replace,
      },
    });
    const event = new Event("vite:preloadError", { cancelable: true });

    handlePreloadError(event);

    expect(event.defaultPrevented).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("registers and removes the Vite preload listener", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const unregister = registerModulePreloadRecovery({
      location: {
        href: "https://marathonerapp.com/",
        replace: vi.fn(),
      },
      addEventListener,
      removeEventListener,
    });

    expect(addEventListener).toHaveBeenCalledWith(
      "vite:preloadError",
      expect.any(Function),
    );

    unregister();

    expect(removeEventListener).toHaveBeenCalledWith(
      "vite:preloadError",
      addEventListener.mock.calls[0]?.[1],
    );
  });
});
