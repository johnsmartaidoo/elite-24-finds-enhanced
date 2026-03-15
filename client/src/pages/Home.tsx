import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, Share2, TrendingUp, Zap, ShoppingCart, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random()}`);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const { data: products, isLoading } = trpc.products.list.useQuery({ limit: 50, offset: 0 });
  const { data: trendingProducts } = trpc.products.trending.useQuery({ limit: 8 });
  const trackClick = trpc.analytics.trackClick.useMutation();
  const trackView = trpc.analytics.trackView.useMutation();

  const categories = [
    "Electronics",
    "Home & Kitchen",
    "Sports & Outdoors",
    "Fashion",
    "Beauty",
    "Toys & Games",
    "Books",
    "All",
  ];

  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const handleProductClick = (productId: number, productUrl: string) => {
    trackClick.mutate({ productId, sessionId });
    trackView.mutate({ productId, sessionId });
    setTimeout(() => {
      window.open(productUrl, "_blank");
    }, 100);
  };

  const handleShare = (product: any) => {
    const text = `Check out this amazing deal! ${product.title} - Just $${product.price}! 🔥`;
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    }
  };

  const handleEmailCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast.success("Thanks! Check your email for exclusive deals 🎉");
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border shadow-lg">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              🔥 ELITE 24
            </div>
            <span className="text-xs font-bold text-secondary animate-pulse">DEALS</span>
          </div>

          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/10 border-secondary/30 focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm font-medium hidden sm:inline">{user.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/dashboard")}
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  Dashboard
                </Button>
              </>
            ) : (
              <Button size="sm" className="bg-gradient-to-r from-primary to-secondary">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-12">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-8 md:p-12 text-white shadow-2xl">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_50%,#fff,transparent_50%)]" />
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              🚀 INSANE DEALS EVERY DAY
            </h1>
            <p className="text-lg md:text-xl mb-6 font-semibold opacity-95">
              Discover the hottest products at unbeatable prices. Limited time offers you can't miss!
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-bold">
                🔥 SHOP NOW
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 font-bold">
                VIEW TRENDING
              </Button>
            </div>
          </div>
        </section>

        {/* Email Capture */}
        <section className="bg-white rounded-xl p-6 md:p-8 border-2 border-primary shadow-lg">
          <h2 className="text-2xl font-black text-primary mb-2">💌 GET EXCLUSIVE DEALS</h2>
          <p className="text-muted-foreground mb-4">Join 50,000+ deal hunters and get alerts for the best offers</p>
          <form onSubmit={handleEmailCapture} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="Enter your email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border-2 border-secondary/50 focus:border-primary"
              required
            />
            <Button
              type="submit"
              className="bg-gradient-to-r from-primary to-secondary hover:shadow-lg font-bold"
            >
              SUBSCRIBE
            </Button>
          </form>
        </section>

        {/* Trending Products */}
        {trendingProducts && trendingProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-secondary" />
              <h2 className="text-3xl font-black text-primary">🔥 TRENDING NOW</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendingProducts.map((product) => (
                <Card
                  key={product.id}
                  className="group overflow-hidden border-2 border-secondary/30 hover:border-primary hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => handleProductClick(product.id, product.productUrl || "#")}
                >
                  <div className="relative h-40 bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-primary/50" />
                      </div>
                    )}
                    {product.discount && product.discount > 0 && (
                      <div className="absolute top-2 right-2 bg-secondary text-white font-black px-3 py-1 rounded-full text-sm">
                        -{product.discount}%
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="font-bold text-sm line-clamp-2 text-foreground mb-2">{product.title}</p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-lg font-black text-primary">${product.price}</span>
                      {product.originalPrice && (
                        <span className="text-sm line-through text-muted-foreground">${product.originalPrice}</span>
                      )}
                    </div>
                    {product.rating && (
                      <div className="flex items-center gap-1 text-xs text-yellow-500 font-bold mb-2">
                        ⭐ {product.rating} ({product.reviewCount})
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-primary to-secondary text-white font-bold h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product.id, product.productUrl || "#");
                        }}
                      >
                        BUY NOW
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-secondary text-secondary hover:bg-secondary/10 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(product);
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Category Filter */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-primary">📂 SHOP BY CATEGORY</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className={selectedCategory === cat ? "bg-gradient-to-r from-primary to-secondary text-white font-bold" : "border-2 border-primary/30 hover:border-primary"}
                onClick={() => setSelectedCategory(cat === "All" ? null : cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </section>

        {/* Products Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-primary">💎 ALL DEALS</h2>
            <span className="text-sm font-bold text-secondary">{filteredProducts.length} products</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card className="border-2 border-secondary/30">
              <CardContent className="py-12 text-center">
                <p className="text-lg text-muted-foreground font-semibold">No deals found matching your search</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="group overflow-hidden border-2 border-secondary/20 hover:border-primary hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => handleProductClick(product.id, product.productUrl || "#")}
                >
                  <div className="relative h-48 bg-gradient-to-br from-primary/5 to-secondary/5 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-12 h-12 text-primary/30" />
                      </div>
                    )}
                    {product.isPrime && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white font-bold px-2 py-1 rounded text-xs">
                        Prime
                      </div>
                    )}
                    {product.discount && product.discount > 0 && (
                      <div className="absolute top-2 right-2 bg-secondary text-white font-black px-3 py-1 rounded-full text-sm shadow-lg">
                        -{product.discount}%
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <p className="font-bold text-sm line-clamp-2 text-foreground mb-3">{product.title}</p>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-black text-primary">${product.price}</span>
                      {product.originalPrice && (
                        <span className="text-sm line-through text-muted-foreground">${product.originalPrice}</span>
                      )}
                    </div>
                    {product.rating && (
                      <div className="flex items-center gap-1 text-xs text-yellow-500 font-bold mb-3">
                        ⭐ {product.rating} ({product.reviewCount})
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-primary to-secondary text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product.id, product.productUrl || "#");
                        }}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        BUY
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-secondary text-secondary hover:bg-secondary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(product);
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Social Proof */}
        <section className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-8 border-2 border-primary/20">
          <h2 className="text-2xl font-black text-primary mb-6 text-center">⭐ TRUSTED BY MILLIONS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-black text-secondary">50K+</p>
              <p className="text-muted-foreground font-semibold">Active Deal Hunters</p>
            </div>
            <div>
              <p className="text-3xl font-black text-primary">100K+</p>
              <p className="text-muted-foreground font-semibold">Deals Shared</p>
            </div>
            <div>
              <p className="text-3xl font-black text-accent">$10M+</p>
              <p className="text-muted-foreground font-semibold">Saved Together</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-sidebar text-sidebar-foreground mt-16 py-8 border-t-2 border-primary/20">
        <div className="container text-center">
          <p className="font-bold mb-2">© 2026 Elite 24 Finds. All rights reserved.</p>
          <p className="text-sm text-sidebar-foreground/70">Find the best deals, every single day. 🔥</p>
        </div>
      </footer>
    </div>
  );
}
