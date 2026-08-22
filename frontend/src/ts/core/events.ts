namespace GptNotion.Core {
  export type EventMap = Record<string, object>;
  type Listener<T extends object> = (event: Readonly<T>) => void;

  export class EventBus<TEvents extends EventMap> {
    private readonly listeners = new Map<keyof TEvents, Set<Listener<TEvents[keyof TEvents]>>>();

    public on<TKey extends keyof TEvents>(key: TKey, listener: Listener<TEvents[TKey]>): () => void {
      let bucket = this.listeners.get(key);
      if (!bucket) {
        bucket = new Set<Listener<TEvents[keyof TEvents]>>();
        this.listeners.set(key, bucket);
      }
      const compatible: Listener<TEvents[keyof TEvents]> = event => listener(event as TEvents[TKey]);
      bucket.add(compatible);
      return () => bucket?.delete(compatible);
    }

    public emit<TKey extends keyof TEvents>(key: TKey, event: Readonly<TEvents[TKey]>): void {
      const bucket = this.listeners.get(key);
      if (!bucket) return;
      for (const listener of bucket) listener(event);
    }
  }
}
