import { ProductEditor } from "@/components/admin/product-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProductEditor id={(await params).id} />;
}
