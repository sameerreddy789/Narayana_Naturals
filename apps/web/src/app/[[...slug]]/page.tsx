import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront";

const pages = new Set(["", "shop", "oil/groundnut", "our-ghani", "delivery", "faq", "contact", "cart", "checkout", "sign-in", "account", "account/addresses", "account/orders", "policies/privacy", "policies/terms", "policies/shipping", "policies/returns", "admin", "admin/sign-in", "admin/orders", "admin/catalogue", "admin/inventory", "admin/delivery", "admin/customers", "admin/content", "admin/settings"]);

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const path = slug.join("/");
  if (!pages.has(path) && !/^(?:account\/orders|order-result|admin\/orders)\/[A-Za-z0-9_-]{8,128}$/.test(path)) notFound();
  return <Storefront />;
}
