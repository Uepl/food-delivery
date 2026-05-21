import Redis from 'ioredis';

export class RedisSubscriptionDispatcher {
  private redisSub: Redis;
  private channelHandlers: Map<string, Set<(message: string) => void>> = new Map();

  constructor(redisSub: Redis) {
    this.redisSub = redisSub;
    this.redisSub.on('message', (channel, message) => {
      if (this.channelHandlers.has(channel)) {
        const handlers = this.channelHandlers.get(channel)!;
        handlers.forEach(handler => handler(message));
      }
    });
  }

  subscribe(channel: string, handler: (message: string) => void) {
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
      this.redisSub.subscribe(channel);
    }
    this.channelHandlers.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: (message: string) => void) {
    if (this.channelHandlers.has(channel)) {
      const handlers = this.channelHandlers.get(channel)!;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.channelHandlers.delete(channel);
        this.redisSub.unsubscribe(channel);
      }
    }
  }
}
