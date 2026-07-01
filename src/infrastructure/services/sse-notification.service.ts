import { Response } from "express";

export class SseNotificationService {
  private readonly connections = new Map<number, Set<Response>>();

  register(userId: number, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.socket?.setNoDelay(true);
    res.flushHeaders();

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(res);

    // Prevent proxy/load-balancer timeouts
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

    res.on("close", () => {
      clearInterval(heartbeat);
      const pool = this.connections.get(userId);
      pool?.delete(res);
      if (pool?.size === 0) this.connections.delete(userId);
    });
  }

  push(userId: number, event: string, data: object): void {
    const pool = this.connections.get(userId);
    if (!pool || pool.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of pool) {
      res.write(payload);
    }
  }
}

export const sseNotificationService = new SseNotificationService();
