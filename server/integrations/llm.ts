import { invokeLLM } from "../_core/llm";

export async function generateProductDescription(product: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert product description writer for e-commerce. Write compelling, SEO-optimized product descriptions that highlight benefits and drive conversions.",
        },
        {
          role: "user",
          content: `Write a compelling product description for: ${product.title}. Price: $${product.price}. Category: ${product.category}. Keep it under 200 words and focus on benefits and value proposition.`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : '');
    return text || "High-quality product";
  } catch (error) {
    console.error("Failed to generate product description:", error);
    return `${product.title} - A premium product in the ${product.category} category.`;
  }
}

export async function generatePinterestCaption(product: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a Pinterest marketing expert. Write engaging, clickbait-style captions that drive clicks and engagement on Pinterest.",
        },
        {
          role: "user",
          content: `Write a Pinterest caption for: ${product.title}. Price: $${product.price}. Make it catchy, use relevant emojis, and include trending keywords. Keep it under 150 characters.`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : '');
    return text || `🔥 ${product.title} - Limited Time Deal! 💰`;
  } catch (error) {
    console.error("Failed to generate Pinterest caption:", error);
    return `🔥 ${product.title} - Amazing Deal! 💰`;
  }
}

export async function generateProductTags(product: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an SEO expert. Generate relevant, high-traffic keywords and tags for e-commerce products.",
        },
        {
          role: "user",
          content: `Generate 10 relevant SEO tags for: ${product.title}. Category: ${product.category}. Format as comma-separated values.`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : '');
    return text || `${product.title}, ${product.category}, deals, shopping`;
  } catch (error) {
    console.error("Failed to generate product tags:", error);
    return `${product.title}, ${product.category}, deals`;
  }
}

export async function analyzeDealWorthiness(product: any): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a deal analyst. Analyze products and determine if they are good deals based on price, discount, and market value.",
        },
        {
          role: "user",
          content: `Analyze this product: ${product.title}. Price: $${product.price}. Original Price: $${product.originalPrice}. Discount: ${product.discount}%. Rating: ${product.rating}/5. Is this a good deal? Provide a brief analysis.`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : '');
    return text || "Good value for the price";
  } catch (error) {
    console.error("Failed to analyze deal:", error);
    return "Product available at current price";
  }
}
