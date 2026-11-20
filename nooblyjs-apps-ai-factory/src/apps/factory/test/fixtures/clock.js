// @ts-check
// A clock that only moves when told to, for tests (NooblyJS Phase 27: test doubles live with the tests, not in the
// Factory's public API). Real code uses systemClock from src/utils/clock.js.
//
//   const clock = createFakeClock(0);
//   clock.advance(60_000);   // a minute passes, instantly

/** @param {number} [start] */
export function createFakeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    /** @param {number} ms */
    advance(ms) {
      time += ms;
    },
    /** @param {number} ms */
    set(ms) {
      time = ms;
    },
  };
}
