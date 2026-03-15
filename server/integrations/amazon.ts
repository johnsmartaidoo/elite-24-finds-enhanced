export function generateAffiliateLink(asin: string, associateId: string): string {
  if (!associateId) {
    return `https://www.amazon.com/dp/${asin}`;
  }
  return `https://www.amazon.com/dp/${asin}?tag=${associateId}`;
}

export function extractASINFromUrl(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}
