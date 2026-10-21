import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLatestRunner } from "@/lib/latestRunner";

const same = (a: number, b: number) => a === b;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("the latest-wins runner (#516)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs while the value keeps changing faster than a debounce delay would allow", async () => {
    const seen: number[] = [];
    const runner = createLatestRunner(async (value: number) => {
      seen.push(value);
      await wait(20);
    }, same);
    // A value every 10 ms for 400 ms: a 30 ms debounce would run once, at the end.
    for (let step = 1; step <= 40; step++) {
      runner.request(step);
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(seen.length).toBeGreaterThan(8);
    expect(seen[0]).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    // The last round ends with the newest value.
    expect(seen[seen.length - 1]).toBe(40);
  });

  it("skips the values in between: a round that was busy is followed by the newest only", async () => {
    const seen: number[] = [];
    const runner = createLatestRunner(async (value: number) => {
      seen.push(value);
      await wait(50);
    }, same);
    runner.request(1);
    await vi.advanceTimersByTimeAsync(1);
    runner.request(2);
    runner.request(3);
    runner.request(4);
    await vi.advanceTimersByTimeAsync(200);
    expect(seen).toEqual([1, 4]);
  });

  it("does not run again for the value it has just run", async () => {
    const seen: number[] = [];
    const runner = createLatestRunner(async (value: number) => {
      seen.push(value);
      await wait(10);
    }, same);
    runner.request(7);
    await vi.advanceTimersByTimeAsync(1);
    runner.request(7);
    await vi.advanceTimersByTimeAsync(100);
    expect(seen).toEqual([7]);
  });

  it("starts nothing after clear, and a round in flight sees that its result is no longer wanted", async () => {
    const results: Array<number | null> = [];
    let runner: ReturnType<typeof createLatestRunner<number>>;
    runner = createLatestRunner(async (value: number) => {
      await wait(30);
      results.push(runner.wanted() === null ? null : value);
    }, same);
    runner.request(1);
    await vi.advanceTimersByTimeAsync(5);
    runner.clear();
    runner.request(2);
    runner.clear();
    await vi.advanceTimersByTimeAsync(200);
    expect(results).toEqual([null]);
  });

  it("goes on after a round that failed", async () => {
    const seen: number[] = [];
    const runner = createLatestRunner(async (value: number) => {
      seen.push(value);
      if (value === 1) throw new Error("boom");
    }, same);
    runner.request(1);
    await vi.advanceTimersByTimeAsync(5);
    runner.request(2);
    await vi.advanceTimersByTimeAsync(5);
    expect(seen).toEqual([1, 2]);
  });
});
