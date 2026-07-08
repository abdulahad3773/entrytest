// ============================================================
// SECTION TIMER
// ============================================================
// A small, self-contained countdown timer. Each exam section
// gets its own fresh instance, so unused time never carries
// over between sections.
// ============================================================

class SectionTimer {
  /**
   * @param {number} durationMinutes - full time allotted for the section
   * @param {(secondsLeft: number) => void} onTick - called every second
   * @param {() => void} onExpire - called once when time reaches zero
   */
  constructor(durationMinutes, onTick, onExpire) {
    this.totalSeconds = Math.round(durationMinutes * 60);
    this.secondsLeft = this.totalSeconds;
    this.onTick = onTick || (() => {});
    this.onExpire = onExpire || (() => {});
    this.intervalId = null;
  }

  start() {
    this.stop(); // guard against double-starts
    this.onTick(this.secondsLeft);
    this.intervalId = setInterval(() => {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) {
        this.secondsLeft = 0;
        this.onTick(this.secondsLeft);
        this.stop();
        this.onExpire();
      } else {
        this.onTick(this.secondsLeft);
      }
    }, 1000);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  static formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
