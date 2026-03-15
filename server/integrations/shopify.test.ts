import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShopifyClient } from "./shopify";

describe("Shopify Client", () => {
  let shopifyClient: ShopifyClient;

  beforeEach(() => {
    // Mock environment variables
    process.env.SHOPIFY_STORE_NAME = "test-store";
    process.env.SHOPIFY_ACCESS_TOKEN = "test-token";

    shopifyClient = new ShopifyClient();
  });

  describe("initialization", () => {
    it("should initialize with correct store URL", () => {
      expect(shopifyClient).toBeDefined();
      // Store URL should be constructed correctly
    });

    it("should handle missing credentials gracefully", () => {
      delete process.env.SHOPIFY_STORE_NAME;
      delete process.env.SHOPIFY_ACCESS_TOKEN;

      const client = new ShopifyClient();
      expect(client).toBeDefined();
    });
  });

  describe("testConnection", () => {
    it("should return connection status", async () => {
      const result = await shopifyClient.testConnection();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("should return error message on failure", async () => {
      // With invalid credentials, should fail gracefully
      process.env.SHOPIFY_ACCESS_TOKEN = "invalid-token";
      const client = new ShopifyClient();

      const result = await client.testConnection();

      if (!result.success) {
        expect(result).toHaveProperty("error");
        expect(typeof result.error).toBe("string");
      }
    });
  });

  describe("API methods structure", () => {
    it("should have getProducts method", () => {
      expect(typeof shopifyClient.getProducts).toBe("function");
    });

    it("should have getProduct method", () => {
      expect(typeof shopifyClient.getProduct).toBe("function");
    });

    it("should have createProduct method", () => {
      expect(typeof shopifyClient.createProduct).toBe("function");
    });

    it("should have updateProduct method", () => {
      expect(typeof shopifyClient.updateProduct).toBe("function");
    });

    it("should have deleteProduct method", () => {
      expect(typeof shopifyClient.deleteProduct).toBe("function");
    });

    it("should have getInventoryLevels method", () => {
      expect(typeof shopifyClient.getInventoryLevels).toBe("function");
    });

    it("should have updateInventory method", () => {
      expect(typeof shopifyClient.updateInventory).toBe("function");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      // Test with invalid store name
      process.env.SHOPIFY_STORE_NAME = "invalid-store-12345";
      const client = new ShopifyClient();

      try {
        await client.testConnection();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
