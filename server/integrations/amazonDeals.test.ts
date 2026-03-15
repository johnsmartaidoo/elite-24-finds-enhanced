import { describe, it, expect, beforeEach } from "vitest";
import { amazonDealsService, AmazonDeal } from "./amazonDeals";

describe("Amazon Deals Service", () => {
  describe("fetchDealsFromMultipleSources", () => {
    it("should fetch deals from multiple sources", async () => {
      const deals = await amazonDealsService.fetchDealsFromMultipleSources();

      expect(deals).toBeDefined();
      expect(Array.isArray(deals)).toBe(true);
      expect(deals.length).toBeGreaterThan(0);
    });

    it("should return deals with required fields", async () => {
      const deals = await amazonDealsService.fetchDealsFromMultipleSources();

      deals.forEach((deal) => {
        expect(deal.asin).toBeDefined();
        expect(deal.title).toBeDefined();
        expect(deal.price).toBeDefined();
        expect(deal.originalPrice).toBeDefined();
        expect(deal.discount).toBeDefined();
        expect(deal.rating).toBeDefined();
        expect(deal.productUrl).toBeDefined();
      });
    });
  });

  describe("filterDeals", () => {
    let mockDeals: AmazonDeal[];

    beforeEach(() => {
      mockDeals = [
        {
          asin: "B001",
          title: "Product 1",
          price: 50,
          originalPrice: 100,
          discount: 50,
          rating: 4.5,
          reviewCount: 100,
          imageUrl: "https://example.com/image1.jpg",
          productUrl: "https://amazon.com/dp/B001",
          category: "Electronics",
          isPrime: true,
          dealType: "regular",
        },
        {
          asin: "B002",
          title: "Product 2",
          price: 20,
          originalPrice: 25,
          discount: 20,
          rating: 3.5,
          reviewCount: 50,
          imageUrl: "https://example.com/image2.jpg",
          productUrl: "https://amazon.com/dp/B002",
          category: "Home",
          isPrime: false,
          dealType: "regular",
        },
        {
          asin: "B003",
          title: "Product 3",
          price: 100,
          originalPrice: 150,
          discount: 33,
          rating: 4.8,
          reviewCount: 500,
          imageUrl: "https://example.com/image3.jpg",
          productUrl: "https://amazon.com/dp/B003",
          category: "Electronics",
          isPrime: true,
          dealType: "lightning",
        },
      ];
    });

    it("should filter deals by minimum discount", () => {
      const filtered = amazonDealsService.filterDeals(mockDeals, { minDiscount: 30 });

      expect(filtered.length).toBe(2); // B001 (50%) and B003 (33%)
      expect(filtered.every((d) => d.discount >= 30)).toBe(true);
    });

    it("should filter deals by minimum rating", () => {
      const filtered = amazonDealsService.filterDeals(mockDeals, { minRating: 4.0 });

      expect(filtered.length).toBe(2); // B001 (4.5) and B003 (4.8)
      expect(filtered.every((d) => d.rating >= 4.0)).toBe(true);
    });

    it("should filter deals by category", () => {
      const filtered = amazonDealsService.filterDeals(mockDeals, { categories: ["Electronics"] });

      expect(filtered.length).toBe(2); // B001 and B003
      expect(filtered.every((d) => d.category === "Electronics")).toBe(true);
    });

    it("should filter Prime-only deals", () => {
      const filtered = amazonDealsService.filterDeals(mockDeals, { primeOnly: true });

      expect(filtered.length).toBe(2); // B001 and B003
      expect(filtered.every((d) => d.isPrime)).toBe(true);
    });

    it("should combine multiple filters", () => {
      const filtered = amazonDealsService.filterDeals(mockDeals, {
        minDiscount: 30,
        minRating: 4.0,
        primeOnly: true,
      });

      expect(filtered.length).toBe(2); // B001 and B003
      expect(filtered.every((d) => d.discount >= 30 && d.rating >= 4.0 && d.isPrime)).toBe(true);
    });
  });

  describe("validateDeal", () => {
    it("should validate a correct deal", () => {
      const deal: AmazonDeal = {
        asin: "B001",
        title: "Valid Product",
        price: 50,
        originalPrice: 100,
        discount: 50,
        rating: 4.5,
        reviewCount: 100,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      expect(amazonDealsService.validateDeal(deal)).toBe(true);
    });

    it("should reject deal with missing ASIN", () => {
      const deal: AmazonDeal = {
        asin: "",
        title: "Product",
        price: 50,
        originalPrice: 100,
        discount: 50,
        rating: 4.5,
        reviewCount: 100,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      expect(amazonDealsService.validateDeal(deal)).toBe(false);
    });

    it("should reject deal with invalid discount", () => {
      const deal: AmazonDeal = {
        asin: "B001",
        title: "Product",
        price: 50,
        originalPrice: 100,
        discount: 150, // Invalid: > 100%
        rating: 4.5,
        reviewCount: 100,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      expect(amazonDealsService.validateDeal(deal)).toBe(false);
    });

    it("should reject deal with invalid rating", () => {
      const deal: AmazonDeal = {
        asin: "B001",
        title: "Product",
        price: 50,
        originalPrice: 100,
        discount: 50,
        rating: 6.0, // Invalid: > 5
        reviewCount: 100,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      expect(amazonDealsService.validateDeal(deal)).toBe(false);
    });

    it("should reject deal with zero price", () => {
      const deal: AmazonDeal = {
        asin: "B001",
        title: "Product",
        price: 0,
        originalPrice: 100,
        discount: 50,
        rating: 4.5,
        reviewCount: 100,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      expect(amazonDealsService.validateDeal(deal)).toBe(false);
    });
  });

  describe("enrichDealWithAI", () => {
    it("should enrich deal with AI-generated content", async () => {
      const deal: AmazonDeal = {
        asin: "B001",
        title: "Sony WH-1000XM4 Headphones",
        price: 248,
        originalPrice: 348,
        discount: 29,
        rating: 4.7,
        reviewCount: 12500,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      const enriched = await amazonDealsService.enrichDealWithAI(deal);

      expect(enriched).toBeDefined();
      expect(enriched.description).toBeDefined();
      expect(enriched.description.length).toBeGreaterThan(0);
      expect(enriched.tags).toBeDefined();
      expect(enriched.tags.length).toBeGreaterThan(0);
    });

    it("should include deal discount in enriched content", async () => {
      const deal: AmazonDeal = {
        asin: "B001",
        title: "Test Product",
        price: 50,
        originalPrice: 100,
        discount: 50,
        rating: 4.5,
        reviewCount: 100,
        imageUrl: "https://example.com/image.jpg",
        productUrl: "https://amazon.com/dp/B001",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      };

      const enriched = await amazonDealsService.enrichDealWithAI(deal);

      expect(enriched.description).toContain("50%");
      expect(enriched.tags).toContain("Electronics");
    });
  });
});
