import { amazonDealsService } from "../integrations/amazonDeals";
import { shopifyClient } from "../integrations/shopify";
import * as dbHelpers from "../db.helpers";
import { notifyOwner } from "../_core/notification";

/**
 * Hourly job to fetch Amazon deals and sync with platform
 */
export async function runAmazonDealsJob() {
  try {
    console.log("[Amazon Deals Job] Starting hourly fetch...");

    // Fetch deals from multiple sources
    const deals = await amazonDealsService.fetchDealsFromMultipleSources();
    console.log(`[Amazon Deals Job] Fetched ${deals.length} deals`);

    // Filter for high-value deals (20%+ discount, 4+ rating)
    const filteredDeals = amazonDealsService.filterDeals(deals, {
      minDiscount: 20,
      minRating: 4.0,
    });
    console.log(`[Amazon Deals Job] Filtered to ${filteredDeals.length} high-value deals`);

    let processedCount = 0;

    // Process each deal
    for (const deal of filteredDeals) {
      try {
        // Validate deal
        if (!amazonDealsService.validateDeal(deal)) {
          console.warn(`[Amazon Deals Job] Invalid deal: ${deal.asin}`);
          continue;
        }

        // Check if product already exists
        const existingProduct = await dbHelpers.getProductByAsin(deal.asin);

        if (existingProduct) {
          // Update existing product
          await dbHelpers.updateProduct(existingProduct.id, {
            price: deal.price,
            originalPrice: deal.originalPrice,
            discount: deal.discount,
            rating: deal.rating,
            reviewCount: deal.reviewCount,
            isPrime: deal.isPrime,
          } as any);
          console.log(`[Amazon Deals Job] Updated: ${deal.asin}`);
        } else {
          // Enrich with AI content
          const enriched = await amazonDealsService.enrichDealWithAI(deal);
          console.log(`[Amazon Deals Job] New deal: ${deal.asin} - ${deal.title}`);

          // Sync to Shopify if configured
          try {
            await syncProductToShopify(deal);
          } catch (error) {
            console.error(`[Amazon Deals Job] Failed to sync to Shopify: ${deal.asin}`, error);
          }
        }

        processedCount++;
      } catch (error) {
        console.error(`[Amazon Deals Job] Error processing deal ${deal.asin}:`, error);
      }
    }

    // Notify owner of results
    const message = `Amazon Deals Job completed:\n- Processed: ${processedCount} deals\n- Total available: ${filteredDeals.length}`;
    await notifyOwner({
      title: "🔥 Amazon Deals Sync Complete",
      content: message,
    });

    console.log(`[Amazon Deals Job] Completed - Processed: ${processedCount}`);
    return { processedCount, totalDeals: filteredDeals.length };
  } catch (error) {
    console.error("[Amazon Deals Job] Fatal error:", error);
    await notifyOwner({
      title: "❌ Amazon Deals Job Failed",
      content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    throw error;
  }
}

/**
 * Sync a deal product to Shopify store
 */
async function syncProductToShopify(deal: any) {
  try {
    const storeName = process.env.SHOPIFY_STORE_NAME;
    if (!storeName) {
      console.warn("[Shopify Sync] Store name not configured");
      return;
    }

    // Create product in Shopify
    const shopifyProduct = await shopifyClient.createProduct({
      title: deal.title,
      vendor: "Amazon",
      product_type: deal.category,
      tags: deal.category,
      status: "active",
      variants: [
        {
          price: deal.price.toString(),
          sku: deal.asin,
          inventory_quantity: 999,
          requires_shipping: false,
        } as any,
      ],
      images: deal.imageUrl
        ? [
            {
              src: deal.imageUrl,
              alt: deal.title,
            } as any,
          ]
        : [],
    });

    console.log(`[Shopify Sync] Product synced: ${deal.asin} -> ${shopifyProduct.id}`);
    return shopifyProduct;
  } catch (error) {
    console.error("[Shopify Sync] Error syncing product:", error);
    throw error;
  }
}

/**
 * Schedule the job to run hourly
 */
export function scheduleAmazonDealsJob() {
  // Run immediately on startup
  runAmazonDealsJob().catch(console.error);

  // Schedule to run every hour
  setInterval(() => {
    runAmazonDealsJob().catch(console.error);
  }, 60 * 60 * 1000); // 1 hour

  console.log("[Amazon Deals Job] Scheduled to run hourly");
}
