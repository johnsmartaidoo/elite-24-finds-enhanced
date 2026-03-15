// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, desc, and, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  asin: varchar("asin", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  discount: int("discount").default(0),
  category: varchar("category", { length: 128 }),
  rating: decimal("rating", { precision: 3, scale: 1 }),
  reviewCount: int("reviewCount").default(0),
  inStock: boolean("inStock").default(true),
  isPrime: boolean("isPrime").default(false),
  source: varchar("source", { length: 64 }).default("amazon"),
  productUrl: text("productUrl"),
  imageUrl: text("imageUrl"),
  imageKey: varchar("imageKey", { length: 255 }),
  seoDescription: text("seoDescription"),
  pinterestCaption: text("pinterestCaption"),
  tags: text("tags"),
  clickCount: int("clickCount").default(0),
  conversionCount: int("conversionCount").default(0),
  conversionRate: decimal("conversionRate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var productImages = mysqlTable("productImages", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: varchar("imageKey", { length: 255 }).notNull(),
  isGenerated: boolean("isGenerated").default(false),
  prompt: text("prompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var analytics = mysqlTable("analytics", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  eventType: mysqlEnum("eventType", ["click", "view", "conversion", "share"]).notNull(),
  userId: varchar("userId", { length: 128 }),
  sessionId: varchar("sessionId", { length: 128 }),
  referrer: text("referrer"),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var adminLogs = mysqlTable("adminLogs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: int("targetId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var affiliateLinks = mysqlTable("affiliateLinks", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  associateId: varchar("associateId", { length: 128 }).notNull(),
  affiliateUrl: text("affiliateUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createProduct(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}
async function getProducts(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).limit(limit).offset(offset).orderBy(desc(products.createdAt));
}
async function getProductById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function getProductByAsin(asin) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products).where(eq(products.asin, asin)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function updateProduct(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(products).set(data).where(eq(products.id, id));
}
async function deleteProduct(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(products).where(eq(products.id, id));
}
async function searchProducts(query, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(like(products.title, `%${query}%`)).limit(limit).offset(offset).orderBy(desc(products.clickCount));
}
async function getProductsByCategory(category, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.category, category)).limit(limit).offset(offset).orderBy(desc(products.createdAt));
}
async function getTrendingProducts(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(desc(products.clickCount)).limit(limit);
}
async function createProductImage(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(productImages).values(data);
}
async function getProductImages(productId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productImages).where(eq(productImages.productId, productId));
}
async function trackAnalytics(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(analytics).values(data);
}
async function getAnalyticsSummary(productId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    clicks: sql`COUNT(CASE WHEN eventType = 'click' THEN 1 END)`,
    views: sql`COUNT(CASE WHEN eventType = 'view' THEN 1 END)`,
    conversions: sql`COUNT(CASE WHEN eventType = 'conversion' THEN 1 END)`,
    shares: sql`COUNT(CASE WHEN eventType = 'share' THEN 1 END)`
  }).from(analytics).where(eq(analytics.productId, productId));
  return result[0] || null;
}
async function getTopProductsByClicks(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: products.id,
    title: products.title,
    clickCount: products.clickCount,
    conversionCount: products.conversionCount,
    conversionRate: products.conversionRate
  }).from(products).orderBy(desc(products.clickCount)).limit(limit);
}
async function createAdminLog(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(adminLogs).values(data);
}
async function getAdminLogs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit).offset(offset);
}
async function createAffiliateLink(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(affiliateLinks).values(data);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/integrations/llm.ts
async function generateProductDescription(product) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert product description writer for e-commerce. Write compelling, SEO-optimized product descriptions that highlight benefits and drive conversions."
        },
        {
          role: "user",
          content: `Write a compelling product description for: ${product.title}. Price: $${product.price}. Category: ${product.category}. Keep it under 200 words and focus on benefits and value proposition.`
        }
      ]
    });
    const content = response.choices[0]?.message.content;
    const text2 = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => "text" in c ? c.text : "").join("") : "";
    return text2 || "High-quality product";
  } catch (error) {
    console.error("Failed to generate product description:", error);
    return `${product.title} - A premium product in the ${product.category} category.`;
  }
}
async function generatePinterestCaption(product) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a Pinterest marketing expert. Write engaging, clickbait-style captions that drive clicks and engagement on Pinterest."
        },
        {
          role: "user",
          content: `Write a Pinterest caption for: ${product.title}. Price: $${product.price}. Make it catchy, use relevant emojis, and include trending keywords. Keep it under 150 characters.`
        }
      ]
    });
    const content = response.choices[0]?.message.content;
    const text2 = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => "text" in c ? c.text : "").join("") : "";
    return text2 || `\u{1F525} ${product.title} - Limited Time Deal! \u{1F4B0}`;
  } catch (error) {
    console.error("Failed to generate Pinterest caption:", error);
    return `\u{1F525} ${product.title} - Amazing Deal! \u{1F4B0}`;
  }
}
async function generateProductTags(product) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an SEO expert. Generate relevant, high-traffic keywords and tags for e-commerce products."
        },
        {
          role: "user",
          content: `Generate 10 relevant SEO tags for: ${product.title}. Category: ${product.category}. Format as comma-separated values.`
        }
      ]
    });
    const content = response.choices[0]?.message.content;
    const text2 = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => "text" in c ? c.text : "").join("") : "";
    return text2 || `${product.title}, ${product.category}, deals, shopping`;
  } catch (error) {
    console.error("Failed to generate product tags:", error);
    return `${product.title}, ${product.category}, deals`;
  }
}
async function analyzeDealWorthiness(product) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a deal analyst. Analyze products and determine if they are good deals based on price, discount, and market value."
        },
        {
          role: "user",
          content: `Analyze this product: ${product.title}. Price: $${product.price}. Original Price: $${product.originalPrice}. Discount: ${product.discount}%. Rating: ${product.rating}/5. Is this a good deal? Provide a brief analysis.`
        }
      ]
    });
    const content = response.choices[0]?.message.content;
    const text2 = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => "text" in c ? c.text : "").join("") : "";
    return text2 || "Good value for the price";
  } catch (error) {
    console.error("Failed to analyze deal:", error);
    return "Product available at current price";
  }
}

// server/integrations/amazon.ts
function generateAffiliateLink(asin, associateId) {
  if (!associateId) {
    return `https://www.amazon.com/dp/${asin}`;
  }
  return `https://www.amazon.com/dp/${asin}?tag=${associateId}`;
}

// server/storage.ts
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

// server/_core/imageGeneration.ts
async function generateImage(options) {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || []
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }
  const result = await response.json();
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url
  };
}

// server/routers.ts
var productSchema = z2.object({
  asin: z2.string().min(1),
  title: z2.string().min(1),
  description: z2.string().optional(),
  price: z2.number().optional(),
  originalPrice: z2.number().optional(),
  discount: z2.number().optional(),
  imageUrl: z2.string().optional(),
  productUrl: z2.string().url(),
  category: z2.string().optional(),
  rating: z2.number().optional(),
  reviewCount: z2.number().optional(),
  inStock: z2.boolean().default(true),
  isPrime: z2.boolean().default(false)
});
var adminProcedure2 = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return next({ ctx });
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  // ==================== PRODUCTS ====================
  products: router({
    list: publicProcedure.input(z2.object({ limit: z2.number().default(50), offset: z2.number().default(0) })).query(async ({ input }) => {
      return getProducts(input.limit, input.offset);
    }),
    getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getProductById(input.id);
    }),
    getByAsin: publicProcedure.input(z2.object({ asin: z2.string() })).query(async ({ input }) => {
      return getProductByAsin(input.asin);
    }),
    search: publicProcedure.input(z2.object({ query: z2.string(), limit: z2.number().default(50), offset: z2.number().default(0) })).query(async ({ input }) => {
      return searchProducts(input.query, input.limit, input.offset);
    }),
    getByCategory: publicProcedure.input(z2.object({ category: z2.string(), limit: z2.number().default(50), offset: z2.number().default(0) })).query(async ({ input }) => {
      return getProductsByCategory(input.category, input.limit, input.offset);
    }),
    trending: publicProcedure.input(z2.object({ limit: z2.number().default(10) })).query(async ({ input }) => {
      return getTrendingProducts(input.limit);
    }),
    create: adminProcedure2.input(productSchema).mutation(async ({ input, ctx }) => {
      const existing = await getProductByAsin(input.asin);
      if (existing) {
        throw new Error("Product with this ASIN already exists");
      }
      const [seoDescription, pinterestCaption, tags] = await Promise.all([
        generateProductDescription(input),
        generatePinterestCaption(input),
        generateProductTags(input)
      ]);
      const result = await createProduct({
        ...input,
        seoDescription,
        pinterestCaption,
        tags,
        source: "manual"
      });
      const productId = result.insertId || 0;
      const associateId = process.env.AMAZON_ASSOCIATE_ID || "elite24finds";
      const affiliateUrl = generateAffiliateLink(input.asin, associateId);
      await createAffiliateLink({
        productId,
        associateId,
        affiliateUrl
      });
      await createAdminLog({
        adminId: ctx.user.id,
        action: "CREATE_PRODUCT",
        targetType: "product",
        targetId: productId,
        details: `Created product: ${input.title}`
      });
      await notifyOwner({
        title: "New Product Added",
        content: `Product "${input.title}" has been added to the catalog.`
      });
      return { success: true, productId };
    }),
    update: adminProcedure2.input(z2.object({ id: z2.number(), data: productSchema.partial() })).mutation(async ({ input, ctx }) => {
      const updateData = { ...input.data };
      await updateProduct(input.id, updateData);
      await createAdminLog({
        adminId: ctx.user.id,
        action: "UPDATE_PRODUCT",
        targetType: "product",
        targetId: input.id,
        details: `Updated product ${input.id}`
      });
      return { success: true };
    }),
    delete: adminProcedure2.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
      await deleteProduct(input.id);
      await createAdminLog({
        adminId: ctx.user.id,
        action: "DELETE_PRODUCT",
        targetType: "product",
        targetId: input.id,
        details: `Deleted product ${input.id}`
      });
      return { success: true };
    }),
    bulkDelete: adminProcedure2.input(z2.object({ ids: z2.array(z2.number()) })).mutation(async ({ input, ctx }) => {
      for (const id of input.ids) {
        await deleteProduct(id);
      }
      await createAdminLog({
        adminId: ctx.user.id,
        action: "BULK_DELETE_PRODUCTS",
        targetType: "product",
        details: `Deleted ${input.ids.length} products`
      });
      return { success: true, deletedCount: input.ids.length };
    }),
    generateContent: adminProcedure2.input(z2.object({ productId: z2.number() })).mutation(async ({ input, ctx }) => {
      const product = await getProductById(input.productId);
      if (!product) {
        throw new Error("Product not found");
      }
      const productData = {
        title: product.title,
        description: product.description || void 0,
        price: product.price ? Number(product.price) : void 0,
        originalPrice: product.originalPrice ? Number(product.originalPrice) : void 0,
        discount: product.discount || void 0,
        category: product.category || void 0,
        rating: product.rating ? Number(product.rating) : void 0,
        reviewCount: product.reviewCount || void 0,
        isPrime: product.isPrime || false,
        inStock: product.inStock || true
      };
      const [seoDescription, pinterestCaption, tags] = await Promise.all([
        generateProductDescription(productData),
        generatePinterestCaption(productData),
        generateProductTags(productData)
      ]);
      await updateProduct(input.productId, {
        seoDescription,
        pinterestCaption,
        tags
      });
      await createAdminLog({
        adminId: ctx.user.id,
        action: "GENERATE_CONTENT",
        targetType: "product",
        targetId: input.productId,
        details: `Generated SEO content for product ${input.productId}`
      });
      return { success: true, seoDescription, pinterestCaption, tags };
    }),
    analyzeDeal: publicProcedure.input(z2.object({ productId: z2.number() })).query(async ({ input }) => {
      const product = await getProductById(input.productId);
      if (!product) {
        throw new Error("Product not found");
      }
      const productData = {
        title: product.title,
        description: product.description || void 0,
        price: product.price ? Number(product.price) : void 0,
        originalPrice: product.originalPrice ? Number(product.originalPrice) : void 0,
        discount: product.discount || void 0,
        category: product.category || void 0,
        rating: product.rating ? Number(product.rating) : void 0,
        reviewCount: product.reviewCount || void 0,
        isPrime: product.isPrime || false,
        inStock: product.inStock || true
      };
      return analyzeDealWorthiness(productData);
    })
  }),
  // ==================== ANALYTICS ====================
  analytics: router({
    trackClick: publicProcedure.input(z2.object({ productId: z2.number(), sessionId: z2.string().optional(), referrer: z2.string().optional() })).mutation(async ({ input, ctx }) => {
      await trackAnalytics({
        productId: input.productId,
        eventType: "click",
        sessionId: input.sessionId,
        referrer: input.referrer,
        userAgent: ctx.req.headers["user-agent"]
      });
      const product = await getProductById(input.productId);
      if (product) {
        await updateProduct(input.productId, {
          clickCount: (product.clickCount || 0) + 1
        });
      }
      return { success: true };
    }),
    trackView: publicProcedure.input(z2.object({ productId: z2.number(), sessionId: z2.string().optional() })).mutation(async ({ input, ctx }) => {
      await trackAnalytics({
        productId: input.productId,
        eventType: "view",
        sessionId: input.sessionId,
        userAgent: ctx.req.headers["user-agent"]
      });
      return { success: true };
    }),
    trackConversion: publicProcedure.input(z2.object({ productId: z2.number(), sessionId: z2.string().optional() })).mutation(async ({ input, ctx }) => {
      await trackAnalytics({
        productId: input.productId,
        eventType: "conversion",
        sessionId: input.sessionId,
        userAgent: ctx.req.headers["user-agent"]
      });
      const product = await getProductById(input.productId);
      if (product) {
        const newConversionCount = (product.conversionCount || 0) + 1;
        const conversionRate = product.clickCount ? newConversionCount / product.clickCount * 100 : 0;
        await updateProduct(input.productId, {
          conversionCount: newConversionCount,
          conversionRate
        });
      }
      return { success: true };
    }),
    getProductAnalytics: adminProcedure2.input(z2.object({ productId: z2.number() })).query(async ({ input }) => {
      return getAnalyticsSummary(input.productId);
    }),
    getTopProducts: adminProcedure2.input(z2.object({ limit: z2.number().default(10) })).query(async ({ input }) => {
      return getTopProductsByClicks(input.limit);
    })
  }),
  // ==================== IMAGE GENERATION ====================
  imageGeneration: router({
    generateProductImage: adminProcedure2.input(z2.object({ productId: z2.number(), style: z2.string().default("clickbait-8k") })).mutation(async ({ input, ctx }) => {
      const product = await getProductById(input.productId);
      if (!product) {
        throw new Error("Product not found");
      }
      const prompt = `Create an ultra-high-quality 8K product image for "${product.title}". 
        Style: ${input.style}. 
        Make it eye-catching, vibrant, and clickbait-worthy with bold colors, dynamic lighting, and professional product photography. 
        Price: $${product.price}. 
        Category: ${product.category}.
        Ensure the image is optimized for e-commerce and social media engagement.`;
      try {
        const { url: imageUrl } = await generateImage({ prompt });
        if (!imageUrl) throw new Error("Image generation returned no URL");
        const fileKey = `products/${product.id}/${Date.now()}-generated.jpg`;
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const { url: cdnUrl } = await storagePut(fileKey, Buffer.from(imageBuffer), "image/jpeg");
        await createProductImage({
          productId: input.productId,
          imageUrl: cdnUrl,
          imageKey: fileKey,
          isGenerated: true,
          prompt
        });
        await updateProduct(input.productId, {
          imageUrl: cdnUrl,
          imageKey: fileKey
        });
        await createAdminLog({
          adminId: ctx.user.id,
          action: "GENERATE_IMAGE",
          targetType: "product",
          targetId: input.productId,
          details: `Generated 8K image for product ${input.productId}`
        });
        return { success: true, imageUrl: cdnUrl };
      } catch (error) {
        console.error("Image generation failed:", error);
        throw new Error("Failed to generate image");
      }
    }),
    bulkGenerateImages: adminProcedure2.input(z2.object({ productIds: z2.array(z2.number()), style: z2.string().default("clickbait-8k") })).mutation(async ({ input, ctx }) => {
      const results = [];
      for (const productId of input.productIds) {
        try {
          const product = await getProductById(productId);
          if (!product) continue;
          const prompt = `Create an ultra-high-quality 8K product image for "${product.title}". 
            Style: ${input.style}. 
            Make it eye-catching, vibrant, and clickbait-worthy with bold colors, dynamic lighting, and professional product photography.`;
          const { url: imageUrl } = await generateImage({ prompt });
          if (!imageUrl) throw new Error("Image generation returned no URL");
          const fileKey = `products/${productId}/${Date.now()}-generated.jpg`;
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const { url: cdnUrl } = await storagePut(fileKey, Buffer.from(imageBuffer), "image/jpeg");
          await createProductImage({
            productId,
            imageUrl: cdnUrl,
            imageKey: fileKey,
            isGenerated: true,
            prompt
          });
          await updateProduct(productId, {
            imageUrl: cdnUrl,
            imageKey: fileKey
          });
          results.push({ productId, success: true, imageUrl: cdnUrl });
        } catch (error) {
          results.push({ productId, success: false, error: String(error) });
        }
      }
      await createAdminLog({
        adminId: ctx.user.id,
        action: "BULK_GENERATE_IMAGES",
        targetType: "product",
        details: `Generated images for ${results.filter((r) => r.success).length} products`
      });
      return { success: true, results };
    }),
    getProductImages: publicProcedure.input(z2.object({ productId: z2.number() })).query(async ({ input }) => {
      return getProductImages(input.productId);
    })
  }),
  // ==================== ADMIN ====================
  admin: router({
    getAdminLogs: adminProcedure2.input(z2.object({ limit: z2.number().default(100), offset: z2.number().default(0) })).query(async ({ input }) => {
      return getAdminLogs(input.limit, input.offset);
    }),
    getDashboardStats: adminProcedure2.query(async () => {
      const topProducts = await getTopProductsByClicks(5);
      const totalProducts = await getProducts(1e3, 0);
      return {
        totalProducts: totalProducts.length,
        topProducts,
        timestamp: /* @__PURE__ */ new Date()
      };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
