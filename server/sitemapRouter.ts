import { Router } from "express";
import * as db from "./db";

const router = Router();

router.get("/sitemap.xml", async (req, res) => {
  try {
    const products = await db.getProducts(1000, 0);
    
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Add homepage
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';
    
    // Add product pages
    products?.forEach((product) => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/?product=${product.id}</loc>\n`;
      xml += `    <lastmod>${new Date(product.updatedAt).toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += `    <priority>${0.8}</priority>\n`;
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    res.status(500).send("Error generating sitemap");
  }
});

export default router;
