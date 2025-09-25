// middleware.ts
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? Redis.fromEnv()
  : null;

const limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m") })
  : null;

export async function middleware(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/") && limiter) {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "127.0.0.1";
    const { success } = await limiter.limit(ip);
    if (!success) return new NextResponse("Too Many Requests", { status: 429 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
