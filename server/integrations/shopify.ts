import { ENV } from "../_core/env";

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  tags: string;
  status: string;
  variants: Array<{
    id: string;
    product_id: string;
    title: string;
    price: string;
    sku: string;
    position: number;
    inventory_quantity: number;
    weight: number;
    volume: number;
    option1: string;
    option2: string;
    option3: string;
    created_at: string;
    updated_at: string;
    taxable: boolean;
    barcode: string;
    grams: number;
    image_id: string;
    weight_unit: string;
    inventory_item_id: string;
    inventory_management: string;
    fulfillment_service: string;
    requires_shipping: boolean;
  }>;
  images: Array<{
    id: string;
    product_id: string;
    position: number;
    created_at: string;
    updated_at: string;
    alt: string;
    width: number;
    height: number;
    src: string;
    variant_ids: string[];
  }>;
}

export class ShopifyClient {
  private storeUrl: string;
  private accessToken: string;
  private apiVersion = "2024-01";

  constructor() {
    const storeName = process.env.SHOPIFY_STORE_NAME || "";
    this.storeUrl = `https://${storeName}.myshopify.com/admin/api/${this.apiVersion}`;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.storeUrl}${endpoint}`;
    const headers = {
      "X-Shopify-Access-Token": this.accessToken,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getProducts(limit = 250, cursor?: string) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append("after", cursor);

    const data = await this.makeRequest(`/products.json?${params}`);
    return data.products as ShopifyProduct[];
  }

  async getProduct(productId: string) {
    const data = await this.makeRequest(`/products/${productId}.json`);
    return data.product as ShopifyProduct;
  }

  async createProduct(product: Partial<ShopifyProduct>) {
    const data = await this.makeRequest("/products.json", {
      method: "POST",
      body: JSON.stringify({ product }),
    });
    return data.product as ShopifyProduct;
  }

  async updateProduct(productId: string, product: Partial<ShopifyProduct>) {
    const data = await this.makeRequest(`/products/${productId}.json`, {
      method: "PUT",
      body: JSON.stringify({ product }),
    });
    return data.product as ShopifyProduct;
  }

  async deleteProduct(productId: string) {
    await this.makeRequest(`/products/${productId}.json`, {
      method: "DELETE",
    });
  }

  async getInventoryLevels(inventoryItemIds: string[]) {
    const params = new URLSearchParams();
    inventoryItemIds.forEach((id) => params.append("inventory_item_ids[]", id));

    const data = await this.makeRequest(`/inventory_levels.json?${params}`);
    return data.inventory_levels;
  }

  async updateInventory(inventoryItemId: string, locationId: string, quantity: number) {
    const data = await this.makeRequest("/inventory_levels/adjust.json", {
      method: "POST",
      body: JSON.stringify({
        reason_code: "correction",
        body: {
          inventory_item_id: inventoryItemId,
          available_adjustment: quantity,
          location_id: locationId,
        },
      }),
    });
    return data.inventory_level;
  }

  async testConnection() {
    try {
      const data = await this.makeRequest("/shop.json");
      return { success: true, shop: data.shop };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export const shopifyClient = new ShopifyClient();
