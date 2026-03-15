import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateProductDescription, generatePinterestCaption, generateProductTags, analyzeDealWorthiness } from "./integrations/llm";
import { generateAffiliateLink } from "./integrations/amazon";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";

const productSchema = z.object({
  asin: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  discount: z.number().optional(),
  imageUrl: z.string().optional(),
  productUrl: z.string().url(),
  category: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  inStock: z.boolean().default(true),
  isPrime: z.boolean().default(false),
});

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ==================== PRODUCTS ====================
  products: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return db.getProducts(input.limit, input.offset);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductById(input.id);
      }),

    getByAsin: publicProcedure
      .input(z.object({ asin: z.string() }))
      .query(async ({ input }) => {
        return db.getProductByAsin(input.asin);
      }),

    search: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return db.searchProducts(input.query, input.limit, input.offset);
      }),

    getByCategory: publicProcedure
      .input(z.object({ category: z.string(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return db.getProductsByCategory(input.category, input.limit, input.offset);
      }),

    trending: publicProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getTrendingProducts(input.limit);
      }),

    create: adminProcedure
      .input(productSchema)
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getProductByAsin(input.asin);
        if (existing) {
          throw new Error("Product with this ASIN already exists");
        }

        const [seoDescription, pinterestCaption, tags] = await Promise.all([
          generateProductDescription(input),
          generatePinterestCaption(input),
          generateProductTags(input),
        ]);

        const result = await db.createProduct({
          ...input,
          seoDescription,
          pinterestCaption,
          tags,
          source: "manual",
        } as any);

        const productId = (result as any).insertId || 0;
        const associateId = process.env.AMAZON_ASSOCIATE_ID || "elite24finds";
        const affiliateUrl = generateAffiliateLink(input.asin, associateId);
        await db.createAffiliateLink({
          productId,
          associateId,
          affiliateUrl,
        });

        // Log admin action
        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "CREATE_PRODUCT",
          targetType: "product",
          targetId: productId,
          details: `Created product: ${input.title}`,
        });

        // Notify owner
        await notifyOwner({
          title: "New Product Added",
          content: `Product "${input.title}" has been added to the catalog.`,
        });

        return { success: true, productId };
      }),

    update: adminProcedure
      .input(z.object({ id: z.number(), data: productSchema.partial() }))
      .mutation(async ({ input, ctx }) => {
        const updateData: any = { ...input.data };
        await db.updateProduct(input.id, updateData);

        // Log admin action
        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "UPDATE_PRODUCT",
          targetType: "product",
          targetId: input.id,
          details: `Updated product ${input.id}`,
        });

        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteProduct(input.id);

        // Log admin action
        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "DELETE_PRODUCT",
          targetType: "product",
          targetId: input.id,
          details: `Deleted product ${input.id}`,
        });

        return { success: true };
      }),

    bulkDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        for (const id of input.ids) {
          await db.deleteProduct(id);
        }

        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "BULK_DELETE_PRODUCTS",
          targetType: "product",
          details: `Deleted ${input.ids.length} products`,
        });

        return { success: true, deletedCount: input.ids.length };
      }),

    generateContent: adminProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const product = await db.getProductById(input.productId);
        if (!product) {
          throw new Error("Product not found");
        }

        const productData: any = {
          title: product.title,
          description: product.description || undefined,
          price: product.price ? Number(product.price) : undefined,
          originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
          discount: product.discount || undefined,
          category: product.category || undefined,
          rating: product.rating ? Number(product.rating) : undefined,
          reviewCount: product.reviewCount || undefined,
          isPrime: product.isPrime || false,
          inStock: product.inStock || true,
        };

        const [seoDescription, pinterestCaption, tags] = await Promise.all([
          generateProductDescription(productData),
          generatePinterestCaption(productData),
          generateProductTags(productData),
        ]);

        await db.updateProduct(input.productId, {
          seoDescription,
          pinterestCaption,
          tags,
        });

        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "GENERATE_CONTENT",
          targetType: "product",
          targetId: input.productId,
          details: `Generated SEO content for product ${input.productId}`,
        });

        return { success: true, seoDescription, pinterestCaption, tags };
      }),

    analyzeDeal: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.productId);
        if (!product) {
          throw new Error("Product not found");
        }

        const productData: any = {
          title: product.title,
          description: product.description || undefined,
          price: product.price ? Number(product.price) : undefined,
          originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
          discount: product.discount || undefined,
          category: product.category || undefined,
          rating: product.rating ? Number(product.rating) : undefined,
          reviewCount: product.reviewCount || undefined,
          isPrime: product.isPrime || false,
          inStock: product.inStock || true,
        };

        return analyzeDealWorthiness(productData);
      }),
  }),

  // ==================== ANALYTICS ====================
  analytics: router({
    trackClick: publicProcedure
      .input(z.object({ productId: z.number(), sessionId: z.string().optional(), referrer: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.trackAnalytics({
          productId: input.productId,
          eventType: "click",
          sessionId: input.sessionId,
          referrer: input.referrer,
          userAgent: ctx.req.headers["user-agent"] as string,
        });

        // Update product click count
        const product = await db.getProductById(input.productId);
        if (product) {
          await db.updateProduct(input.productId, {
            clickCount: (product.clickCount || 0) + 1,
          });
        }

        return { success: true };
      }),

    trackView: publicProcedure
      .input(z.object({ productId: z.number(), sessionId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.trackAnalytics({
          productId: input.productId,
          eventType: "view",
          sessionId: input.sessionId,
          userAgent: ctx.req.headers["user-agent"] as string,
        });

        return { success: true };
      }),

    trackConversion: publicProcedure
      .input(z.object({ productId: z.number(), sessionId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.trackAnalytics({
          productId: input.productId,
          eventType: "conversion",
          sessionId: input.sessionId,
          userAgent: ctx.req.headers["user-agent"] as string,
        });

        // Update product conversion count
        const product = await db.getProductById(input.productId);
        if (product) {
          const newConversionCount = (product.conversionCount || 0) + 1;
          const conversionRate = product.clickCount ? (newConversionCount / product.clickCount) * 100 : 0;
          await db.updateProduct(input.productId, {
            conversionCount: newConversionCount,
            conversionRate: conversionRate as any,
          });
        }

        return { success: true };
      }),

    getProductAnalytics: adminProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return db.getAnalyticsSummary(input.productId);
      }),

    getTopProducts: adminProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getTopProductsByClicks(input.limit);
      }),
  }),

  // ==================== IMAGE GENERATION ====================
  imageGeneration: router({
    generateProductImage: adminProcedure
      .input(z.object({ productId: z.number(), style: z.string().default("clickbait-8k") }))
      .mutation(async ({ input, ctx }) => {
        const product = await db.getProductById(input.productId);
        if (!product) {
          throw new Error("Product not found");
        }

        // Create clickbait prompt
        const prompt = `Create an ultra-high-quality 8K product image for "${product.title}". 
        Style: ${input.style}. 
        Make it eye-catching, vibrant, and clickbait-worthy with bold colors, dynamic lighting, and professional product photography. 
        Price: $${product.price}. 
        Category: ${product.category}.
        Ensure the image is optimized for e-commerce and social media engagement.`;

        try {
          const { url: imageUrl } = await generateImage({ prompt });
          if (!imageUrl) throw new Error("Image generation returned no URL");

          // Upload to S3
          const fileKey = `products/${product.id}/${Date.now()}-generated.jpg`;
          // Fetch the image from the URL and convert to buffer
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const { url: cdnUrl } = await storagePut(fileKey, Buffer.from(imageBuffer), "image/jpeg");

          // Store image record
          await db.createProductImage({
            productId: input.productId,
            imageUrl: cdnUrl,
            imageKey: fileKey,
            isGenerated: true,
            prompt,
          });

          // Update product with new image
          await db.updateProduct(input.productId, {
            imageUrl: cdnUrl,
            imageKey: fileKey,
          });

          await db.createAdminLog({
            adminId: ctx.user.id,
            action: "GENERATE_IMAGE",
            targetType: "product",
            targetId: input.productId,
            details: `Generated 8K image for product ${input.productId}`,
          });

          return { success: true, imageUrl: cdnUrl };
        } catch (error) {
          console.error("Image generation failed:", error);
          throw new Error("Failed to generate image");
        }
      }),

    bulkGenerateImages: adminProcedure
      .input(z.object({ productIds: z.array(z.number()), style: z.string().default("clickbait-8k") }))
      .mutation(async ({ input, ctx }) => {
        const results = [];
        for (const productId of input.productIds) {
          try {
            const product = await db.getProductById(productId);
            if (!product) continue;

            const prompt = `Create an ultra-high-quality 8K product image for "${product.title}". 
            Style: ${input.style}. 
            Make it eye-catching, vibrant, and clickbait-worthy with bold colors, dynamic lighting, and professional product photography.`;

            const { url: imageUrl } = await generateImage({ prompt });
            if (!imageUrl) throw new Error("Image generation returned no URL");
            const fileKey = `products/${productId}/${Date.now()}-generated.jpg`;
            // Fetch the image from the URL and convert to buffer
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            const { url: cdnUrl } = await storagePut(fileKey, Buffer.from(imageBuffer), "image/jpeg");

            await db.createProductImage({
              productId,
              imageUrl: cdnUrl,
              imageKey: fileKey,
              isGenerated: true,
              prompt,
            });

            await db.updateProduct(productId, {
              imageUrl: cdnUrl,
              imageKey: fileKey,
            });

            results.push({ productId, success: true, imageUrl: cdnUrl });
          } catch (error) {
            results.push({ productId, success: false, error: String(error) });
          }
        }

        await db.createAdminLog({
          adminId: ctx.user.id,
          action: "BULK_GENERATE_IMAGES",
          targetType: "product",
          details: `Generated images for ${results.filter(r => r.success).length} products`,
        });

        return { success: true, results };
      }),

    getProductImages: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return db.getProductImages(input.productId);
      }),
  }),

  // ==================== ADMIN ====================
  admin: router({
    getAdminLogs: adminProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return db.getAdminLogs(input.limit, input.offset);
      }),

    getDashboardStats: adminProcedure
      .query(async () => {
        const topProducts = await db.getTopProductsByClicks(5);
        const totalProducts = await db.getProducts(1000, 0);
        
        return {
          totalProducts: totalProducts.length,
          topProducts,
          timestamp: new Date(),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
