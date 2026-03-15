import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Loader2, LogOut, Plus, Trash2, Zap, BarChart3, Settings, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [generatingImages, setGeneratingImages] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    asin: "",
    title: "",
    description: "",
    price: "",
    originalPrice: "",
    discount: "",
    category: "Electronics",
    productUrl: "",
  });

  // Queries
  const { data: products, isLoading: productsLoading, refetch } = trpc.products.list.useQuery({ limit: 100, offset: 0 });
  const { data: dashboardStats } = trpc.admin.getDashboardStats.useQuery();
  const { data: adminLogs } = trpc.admin.getAdminLogs.useQuery({ limit: 20, offset: 0 });

  // Mutations
  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Product created successfully!");
      setFormData({ asin: "", title: "", description: "", price: "", originalPrice: "", discount: "", category: "Electronics", productUrl: "" });
      setShowAddForm(false);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Product deleted");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkDeleteProducts = trpc.products.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deletedCount} products`);
      setSelectedProductIds([]);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const generateProductImage = trpc.imageGeneration.generateProductImage.useMutation({
    onSuccess: () => {
      toast.success("Image generated successfully!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkGenerateImages = trpc.imageGeneration.bulkGenerateImages.useMutation({
    onSuccess: (data) => {
      const successful = data.results.filter(r => r.success).length;
      toast.success(`Generated ${successful} images`);
      setGeneratingImages(false);
      setSelectedProductIds([]);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const logoutUser = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      setLocation("/");
    },
  });

  // Handlers
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.asin || !formData.title || !formData.productUrl) {
      toast.error("Please fill in required fields");
      return;
    }

    createProduct.mutate({
      asin: formData.asin,
      title: formData.title,
      description: formData.description || undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
      discount: formData.discount ? parseInt(formData.discount) : undefined,
      category: formData.category,
      productUrl: formData.productUrl,
    });
  };

  const handleGenerateImages = async () => {
    if (selectedProductIds.length === 0) {
      toast.error("Please select products");
      return;
    }
    setGeneratingImages(true);
    bulkGenerateImages.mutate({ productIds: selectedProductIds });
  };

  // Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="border-2 border-secondary">
          <CardContent className="pt-6">
            <p className="text-lg font-bold text-center mb-4">Access Denied</p>
            <p className="text-muted-foreground text-center mb-6">You need admin access to view this page.</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/10">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-sidebar text-sidebar-foreground border-b-2 border-primary shadow-lg">
        <div className="container flex items-center justify-between h-16">
          <div className="text-2xl font-black">
            ⚙️ ADMIN PANEL
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{user.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutUser.mutate()}
              className="border-sidebar-accent text-sidebar-accent hover:bg-sidebar-accent/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Stats Overview */}
        {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-primary">Total Products</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-primary">{dashboardStats.totalProducts}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-secondary/30 bg-gradient-to-br from-secondary/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-secondary">Top Product</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold line-clamp-2">{dashboardStats.topProducts[0]?.title || "N/A"}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-accent">Top Clicks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-accent">{dashboardStats.topProducts[0]?.clickCount || 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white border-2 border-border">
            <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              📦 Products
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              🖼️ Images
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              📋 Logs
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card className="border-2 border-primary/30">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Product Management</CardTitle>
                    <CardDescription>Manage your product catalog</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedProductIds.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => bulkDeleteProducts.mutate({ ids: selectedProductIds })}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete {selectedProductIds.length}
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="bg-gradient-to-r from-primary to-secondary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {showAddForm && (
                <CardContent className="border-t-2 border-primary/30 pt-6">
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        placeholder="ASIN"
                        value={formData.asin}
                        onChange={(e) => setFormData({ ...formData, asin: e.target.value })}
                        className="border-2 border-primary/30"
                        required
                      />
                      <Input
                        placeholder="Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="border-2 border-primary/30"
                        required
                      />
                      <Input
                        placeholder="Price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="border-2 border-primary/30"
                      />
                      <Input
                        placeholder="Original Price"
                        type="number"
                        step="0.01"
                        value={formData.originalPrice}
                        onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                        className="border-2 border-primary/30"
                      />
                      <Input
                        placeholder="Discount %"
                        type="number"
                        value={formData.discount}
                        onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                        className="border-2 border-primary/30"
                      />
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="border-2 border-primary/30 rounded-md px-3 py-2"
                      >
                        <option>Electronics</option>
                        <option>Home & Kitchen</option>
                        <option>Sports & Outdoors</option>
                        <option>Fashion</option>
                        <option>Beauty</option>
                      </select>
                    </div>
                    <Input
                      placeholder="Product URL"
                      type="url"
                      value={formData.productUrl}
                      onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                      className="border-2 border-primary/30"
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border-2 border-primary/30 rounded-md px-3 py-2 min-h-24"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-primary to-secondary"
                        disabled={createProduct.isPending}
                      >
                        {createProduct.isPending ? "Creating..." : "Create Product"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              )}

              <CardContent>
                {productsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-primary/30">
                          <TableHead className="w-12">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.length === products?.length && products?.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds(products?.map(p => p.id) || []);
                                } else {
                                  setSelectedProductIds([]);
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="font-bold">Title</TableHead>
                          <TableHead className="font-bold">Price</TableHead>
                          <TableHead className="font-bold">Clicks</TableHead>
                          <TableHead className="font-bold">Conversions</TableHead>
                          <TableHead className="font-bold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products?.map((product) => (
                          <TableRow key={product.id} className="border-primary/20">
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedProductIds.includes(product.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductIds([...selectedProductIds, product.id]);
                                  } else {
                                    setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium max-w-xs truncate">{product.title}</TableCell>
                            <TableCell>${product.price}</TableCell>
                            <TableCell className="font-bold text-primary">{product.clickCount}</TableCell>
                            <TableCell className="font-bold text-secondary">{product.conversionCount}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Delete this product?")) {
                                    deleteProduct.mutate({ id: product.id });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-4">
            <Card className="border-2 border-secondary/30">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Image Generation</CardTitle>
                    <CardDescription>Generate AI-powered 8K clickbait product images</CardDescription>
                  </div>
                  {selectedProductIds.length > 0 && (
                    <Button
                      onClick={handleGenerateImages}
                      disabled={generatingImages}
                      className="bg-gradient-to-r from-secondary to-accent"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {generatingImages ? "Generating..." : `Generate ${selectedProductIds.length} Images`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-secondary/10 border-2 border-secondary/30 rounded-lg p-6 text-center">
                  <ImageIcon className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <p className="font-bold mb-2">Select products from the Products tab to generate images</p>
                  <p className="text-sm text-muted-foreground">Images will be generated in 8K with clickbait styling</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card className="border-2 border-accent/30">
              <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
                <CardDescription>Products with the most clicks and conversions</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardStats?.topProducts && dashboardStats.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardStats.topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-accent/10 rounded-lg border border-accent/30">
                        <div className="flex-1">
                          <p className="font-bold text-sm">{idx + 1}. {product.title}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span>Clicks: {product.clickCount}</span>
                            <span>Conversions: {product.conversionCount}</span>
                            <span>Rate: {product.conversionRate ? (typeof product.conversionRate === 'string' ? parseFloat(product.conversionRate).toFixed(2) : (product.conversionRate as number).toFixed(2)) : '0.00'}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No analytics data yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card className="border-2 border-primary/30">
              <CardHeader>
                <CardTitle>Admin Activity Logs</CardTitle>
                <CardDescription>Recent admin actions and system events</CardDescription>
              </CardHeader>
              <CardContent>
                {adminLogs && adminLogs.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {adminLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                        <div className="flex justify-between">
                          <span className="font-bold text-primary">{log.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.details && <p className="text-xs text-muted-foreground mt-1">{log.details}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No logs yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
