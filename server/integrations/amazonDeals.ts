import { invokeLLM } from "../_core/llm";

export interface AmazonDeal {
  asin: string;
  title: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  productUrl: string;
  category: string;
  isPrime: boolean;
  dealType: "lightning" | "regular" | "limited";
  expiresAt?: Date;
}

/**
 * Scrapes Amazon deals from popular deal websites and APIs
 * Uses CamelCamelCamel API for price history and deals
 */
export class AmazonDealsScraperService {
  private camelcamelcamelApiKey = process.env.CAMELCAMELCAMEL_API_KEY || "";
  private baseUrl = "https://api.camelcamelcamel.com";

  /**
   * Fetch deals from CamelCamelCamel API
   */
  async fetchDealsFromCamelCamelCamel(limit = 50): Promise<AmazonDeal[]> {
    try {
      if (!this.camelcamelcamelApiKey) {
        console.warn("CamelCamelCamel API key not configured, using mock data");
        return this.getMockDeals();
      }

      // In production, integrate with CamelCamelCamel API
      // For now, returning mock deals to demonstrate functionality
      return this.getMockDeals();
    } catch (error) {
      console.error("Error fetching from CamelCamelCamel:", error);
      return this.getMockDeals();
    }
  }

  /**
   * Fetch deals from Honey/Slickdeals-like sources
   */
  async fetchDealsFromMultipleSources(): Promise<AmazonDeal[]> {
    const deals: AmazonDeal[] = [];

    try {
      // Source 1: CamelCamelCamel
      const camelDeals = await this.fetchDealsFromCamelCamelCamel();
      deals.push(...camelDeals);

      // Source 2: Amazon Lightning Deals (via web scraping or API)
      const lightningDeals = await this.fetchLightningDeals();
      deals.push(...lightningDeals);

      // Source 3: Best Seller deals
      const bestSellerDeals = await this.fetchBestSellerDeals();
      deals.push(...bestSellerDeals);

      // Remove duplicates and sort by discount
      return this.deduplicateAndSort(deals);
    } catch (error) {
      console.error("Error fetching deals from multiple sources:", error);
      return this.getMockDeals();
    }
  }

  /**
   * Fetch Amazon Lightning Deals
   */
  private async fetchLightningDeals(): Promise<AmazonDeal[]> {
    try {
      // This would integrate with Amazon's Lightning Deals API or web scraping
      // For now, returning mock data
      return [];
    } catch (error) {
      console.error("Error fetching lightning deals:", error);
      return [];
    }
  }

  /**
   * Fetch Best Seller deals
   */
  private async fetchBestSellerDeals(): Promise<AmazonDeal[]> {
    try {
      // This would fetch best sellers with recent price drops
      return [];
    } catch (error) {
      console.error("Error fetching best seller deals:", error);
      return [];
    }
  }

  /**
   * Filter deals by criteria
   */
  filterDeals(deals: AmazonDeal[], criteria: {
    minDiscount?: number;
    minRating?: number;
    categories?: string[];
    primeOnly?: boolean;
  }): AmazonDeal[] {
    return deals.filter((deal) => {
      if (criteria.minDiscount && deal.discount < criteria.minDiscount) return false;
      if (criteria.minRating && deal.rating < criteria.minRating) return false;
      if (criteria.categories && !criteria.categories.includes(deal.category)) return false;
      if (criteria.primeOnly && !deal.isPrime) return false;
      return true;
    });
  }

  /**
   * Validate deal data
   */
  validateDeal(deal: AmazonDeal): boolean {
    return !!(
      deal.asin &&
      deal.title &&
      deal.price > 0 &&
      deal.originalPrice > 0 &&
      deal.discount >= 0 &&
      deal.discount <= 100 &&
      deal.rating >= 0 &&
      deal.rating <= 5 &&
      deal.productUrl
    );
  }

  /**
   * Deduplicate and sort deals
   */
  private deduplicateAndSort(deals: AmazonDeal[]): AmazonDeal[] {
    const seen = new Set<string>();
    const unique = deals.filter((deal) => {
      if (seen.has(deal.asin)) return false;
      seen.add(deal.asin);
      return true;
    });

    // Sort by discount (highest first)
    return unique.sort((a, b) => b.discount - a.discount);
  }

  /**
   * Get mock deals for testing
   */
  private getMockDeals(): AmazonDeal[] {
    return [
      {
        asin: "B08N5WRWNW",
        title: "Sony WH-1000XM4 Wireless Headphones - Premium Noise Cancelling",
        price: 248,
        originalPrice: 348,
        discount: 29,
        rating: 4.7,
        reviewCount: 12500,
        imageUrl: "https://images-na.ssl-images-amazon.com/images/I/41o8Q4OYPxL.jpg",
        productUrl: "https://www.amazon.com/dp/B08N5WRWNW",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      },
      {
        asin: "B0BSHF7WDM",
        title: "Apple iPad Air 5th Generation 64GB - M1 Chip",
        price: 549,
        originalPrice: 649,
        discount: 15,
        rating: 4.8,
        reviewCount: 8900,
        imageUrl: "https://images-na.ssl-images-amazon.com/images/I/41qKGW+DgqL.jpg",
        productUrl: "https://www.amazon.com/dp/B0BSHF7WDM",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      },
      {
        asin: "B08KBSTXQ4",
        title: "Instant Pot Duo Plus 6 Qt 9-in-1 Electric Pressure Cooker",
        price: 79.95,
        originalPrice: 119.95,
        discount: 33,
        rating: 4.6,
        reviewCount: 15200,
        imageUrl: "https://images-na.ssl-images-amazon.com/images/I/51Ygbw0l0CL.jpg",
        productUrl: "https://www.amazon.com/dp/B08KBSTXQ4",
        category: "Home & Kitchen",
        isPrime: true,
        dealType: "lightning",
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      },
      {
        asin: "B0BVD1QRHY",
        title: "Samsung 65\" Class QLED 4K Smart TV - 120Hz",
        price: 899,
        originalPrice: 1299,
        discount: 31,
        rating: 4.7,
        reviewCount: 5600,
        imageUrl: "https://images-na.ssl-images-amazon.com/images/I/51Ygbw0l0CL.jpg",
        productUrl: "https://www.amazon.com/dp/B0BVD1QRHY",
        category: "Electronics",
        isPrime: true,
        dealType: "regular",
      },
      {
        asin: "B08XVLC91N",
        title: "Dyson V15 Detect Cordless Vacuum - Laser Detection",
        price: 599,
        originalPrice: 749,
        discount: 20,
        rating: 4.8,
        reviewCount: 9200,
        imageUrl: "https://images-na.ssl-images-amazon.com/images/I/41qKGW+DgqL.jpg",
        productUrl: "https://www.amazon.com/dp/B08XVLC91N",
        category: "Home & Kitchen",
        isPrime: true,
        dealType: "regular",
      },
    ];
  }

  /**
   * Enrich deal with AI-generated content
   */
  async enrichDealWithAI(deal: AmazonDeal): Promise<{ description: string; tags: string }> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a product marketing expert. Generate compelling, clickbait-style product descriptions and SEO tags.",
          },
          {
            role: "user",
            content: `Create a compelling product description and tags for: "${deal.title}". Price: $${deal.price} (was $${deal.originalPrice}, ${deal.discount}% off). Rating: ${deal.rating}/5. Keep description under 150 words.`,
          },
        ],
      });

      const content = response.choices[0]?.message.content;
      const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : '');
      
      return {
        description: text || `${deal.title} - Limited time deal!`,
        tags: `${deal.category}, amazon deals, discount, ${deal.discount}% off, best price`,
      };
    } catch (error) {
      console.error("Error enriching deal with AI:", error);
      return {
        description: `${deal.title} - Save ${deal.discount}%! Limited time offer.`,
        tags: `${deal.category}, amazon deals, discount`,
      };
    }
  }
}

export const amazonDealsService = new AmazonDealsScraperService();
