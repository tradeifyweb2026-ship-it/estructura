declare namespace Cloudflare {
  interface Env {
    TRADEIFY_MAX_TRADES?: string;
    TRADEIFY_EMAIL_API_KEY?: string;
    TRADEIFY_EMAIL_FROM?: string;
    TRADEIFY_MARKET_SYMBOL?: string;
    TRADEIFY_SUPPORT_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TRADEIFY_ORIGIN?: string;
    TRADEIFY_OWNER_EMAIL?: string;
    TRADEIFY_GOOGLE_CLIENT_ID?: string;
    TRADEIFY_GOOGLE_CLIENT_SECRET?: string;
    TRADEIFY_SESSION_SECRET?: string;
    AUTH_RATE_LIMITER?: RateLimit;
    API_RATE_LIMITER?: RateLimit;
    USER_RATE_LIMITER?: RateLimit;
  }
}
