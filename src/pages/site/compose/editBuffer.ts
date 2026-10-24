/* CA-18 P2: what a modal holds back until Save.

   PURE. A tile's modal in edit mode changes nothing while it is open: a field that used to save the moment it was left
   (in Details) queues its write here instead, and Save runs them, through the same handlers with the same arguments.
   Cancel and Escape drop the queue, so nothing is written. A write for the same thing queued twice runs once, with
   the last value. */

export class WriteBuffer {
  private order: string[] = [];
  private runs = new Map<string, () => void>();

  /** Queue a write under a key. Queued again, it replaces the first and keeps its place. */
  set(key: string, run: () => void): void {
    if (!this.runs.has(key)) this.order.push(key);
    this.runs.set(key, run);
  }

  /** How many writes are waiting. */
  get size(): number {
    return this.order.length;
  }

  /** Run every queued write in the order it was first queued, and empty the queue. Returns how many ran. */
  flush(): number {
    const keys = this.order;
    const runs = this.runs;
    this.clear();
    for (const key of keys) runs.get(key)?.();
    return keys.length;
  }

  /** CA-20 P5: take every queued write out, in order, and empty the queue, without running them: they run later, as one step. */
  drain(): (() => void)[] {
    const runs = this.order.flatMap((key) => this.runs.get(key) ?? []);
    this.clear();
    return runs;
  }

  /** Take one write off the queue (the maker put a thing back as it was). */
  drop(key: string): void {
    this.order = this.order.filter((held) => held !== key);
    this.runs.delete(key);
  }

  /** Whether a write is waiting under this key. */
  has(key: string): boolean {
    return this.runs.has(key);
  }

  /** Drop everything queued. */
  clear(): void {
    this.order = [];
    this.runs = new Map();
  }
}
