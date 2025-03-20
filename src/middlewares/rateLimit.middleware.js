import { redisClient } from "../app.js";
import apiErrors from "../utils/apiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";

// Rate limit configurations
const IP_BUCKET_CAPACITY = process.env.IP_RATE_LIMIT_WINDOW; // Max requests per IP
const GLOBAL_BUCKET_CAPACITY = process.env.GLOBAL_RATE_LIMIT_WINDOW; // Max global requests per second
const REFILL_RATE = 1; // Tokens added per second
const REFILL_INTERVAL = 1000; // Interval in milliseconds

// Atomic token bucket implementation using Redis Lua script
const checkBucket = async (key, capacity) => {
  const luaScript = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refillRate = tonumber(ARGV[2])
    local refillInterval = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])

    local bucket = cjson.decode(redis.call('GET', key) or '{}')
    local elapsed = now - (bucket.last or 0)
    local tokensToAdd = math.floor(elapsed / refillInterval) * refillRate
    
    if tokensToAdd > 0 then
      bucket.tokens = math.min((bucket.tokens or capacity) + tokensToAdd, capacity)
      bucket.last = now
    end
    
    if (bucket.tokens or capacity) > 0 then
      bucket.tokens = bucket.tokens - 1
      redis.call('SETEX', key, 60, cjson.encode(bucket))
      return {bucket.tokens, 1, now + refillInterval}
    end
    return {bucket.tokens or 0, 0, now + refillInterval}
  `;

  const result = await redisClient.eval(
    luaScript,
    1,
    key,
    capacity,
    REFILL_RATE,
    REFILL_INTERVAL,
    Date.now()
  );
  return { remaining: result[0], allowed: result[1] === 1, resetAt: result[2] };
};

const rateLimit = asyncHandler(async (req, res, next) => {
  const ipKey = `rateLimit:${req.ip}`;
  const globalKey = "rateLimit:global";

  // Global rate limit check
  const globalResult = await checkBucket(globalKey, GLOBAL_BUCKET_CAPACITY);
  if (!globalResult.allowed) {
    return res
      .status(429)
      .json(new apiErrors(429, "Global rate limit exceeded"));
  }

  // Per-IP rate limit check
  const ipResult = await checkBucket(ipKey, IP_BUCKET_CAPACITY);
  if (!ipResult.allowed) {
    return res
      .status(429)
      .json(new apiErrors(429, "Per-IP rate limit exceeded"));
  }

  // Set rate limit headers
  res.set({
    "X-RateLimit-Limit": IP_BUCKET_CAPACITY,
    "X-RateLimit-Remaining": ipResult.remaining,
    "X-RateLimit-Reset": ipResult.resetAt,
  });
  next();
});

export default rateLimit;
