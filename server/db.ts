import { eq, desc, and, gte, lte, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, products, InsertProduct, Product, analytics, InsertAnalytics, productImages, InsertProductImage, adminLogs, InsertAdminLog, affiliateLinks, InsertAffiliateLink } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== PRODUCTS ====================

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(products).values(data);
  return result;
}

export async function getProducts(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(products).limit(limit).offset(offset).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getProductByAsin(asin: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(products).where(eq(products.asin, asin)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(products).where(eq(products.id, id));
}

export async function searchProducts(query: string, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(products)
    .where(like(products.title, `%${query}%`))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(products.clickCount));
}

export async function getProductsByCategory(category: string, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(products)
    .where(eq(products.category, category))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(products.createdAt));
}

export async function getTrendingProducts(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(products)
    .orderBy(desc(products.clickCount))
    .limit(limit);
}

// ==================== PRODUCT IMAGES ====================

export async function createProductImage(data: InsertProductImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(productImages).values(data);
}

export async function getProductImages(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(productImages).where(eq(productImages.productId, productId));
}

export async function deleteProductImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(productImages).where(eq(productImages.id, id));
}

// ==================== ANALYTICS ====================

export async function trackAnalytics(data: InsertAnalytics) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(analytics).values(data);
}

export async function getProductAnalytics(productId: number, eventType?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const whereConditions = [eq(analytics.productId, productId)];
  if (eventType) {
    whereConditions.push(eq(analytics.eventType, eventType as any));
  }
  
  return db.select().from(analytics).where(and(...whereConditions));
}

export async function getAnalyticsSummary(productId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    clicks: sql<number>`COUNT(CASE WHEN eventType = 'click' THEN 1 END)`,
    views: sql<number>`COUNT(CASE WHEN eventType = 'view' THEN 1 END)`,
    conversions: sql<number>`COUNT(CASE WHEN eventType = 'conversion' THEN 1 END)`,
    shares: sql<number>`COUNT(CASE WHEN eventType = 'share' THEN 1 END)`,
  }).from(analytics).where(eq(analytics.productId, productId));
  
  return result[0] || null;
}

export async function getTopProductsByClicks(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    id: products.id,
    title: products.title,
    clickCount: products.clickCount,
    conversionCount: products.conversionCount,
    conversionRate: products.conversionRate,
  }).from(products)
    .orderBy(desc(products.clickCount))
    .limit(limit);
}

// ==================== ADMIN LOGS ====================

export async function createAdminLog(data: InsertAdminLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(adminLogs).values(data);
}

export async function getAdminLogs(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(adminLogs)
    .orderBy(desc(adminLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

// ==================== AFFILIATE LINKS ====================

export async function createAffiliateLink(data: InsertAffiliateLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(affiliateLinks).values(data);
}

export async function getAffiliateLink(productId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(affiliateLinks).where(eq(affiliateLinks.productId, productId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateAffiliateLink(id: number, data: Partial<InsertAffiliateLink>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.update(affiliateLinks).set(data).where(eq(affiliateLinks.id, id));
}
