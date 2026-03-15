import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { products } from "../drizzle/schema";

/**
 * Get product by ASIN (Amazon Standard Identification Number)
 */
export async function getProductByAsin(asin: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(products).where(eq(products.asin, asin)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Update product with new data
 */
export async function updateProduct(productId: number, data: Partial<typeof products.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .update(products)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  return result;
}

/**
 * Get products by source (amazon, manual, shopify)
 */
export async function getProductsBySource(source: string, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(products)
    .where(eq(products.source, source))
    .limit(limit)
    .offset(offset);

  return result;
}

/**
 * Get trending products (by clicks)
 */
export async function getTrendingProducts(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  // This would need a join with analytics table in production
  const result = await db.select().from(products).limit(limit);
  return result;
}

/**
 * Bulk update products
 */
export async function bulkUpdateProducts(
  ids: number[],
  data: Partial<typeof products.$inferInsert>
) {
  const db = await getDb();
  if (!db) return { success: false };

  try {
    for (const id of ids) {
      await db
        .update(products)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
    }
    return { success: true, updated: ids.length };
  } catch (error) {
    console.error("Bulk update error:", error);
    return { success: false };
  }
}
