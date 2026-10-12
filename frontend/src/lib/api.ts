import "server-only";
import { getLanguage } from "./i18n-server";
import type { Category, StoreConfig, Product, CatalogPage } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string): Promise<T> {
  try {
    const response = await fetch(
      `${process.env.DJANGO_API_URL || "http://127.0.0.1:8000/api"}/${path}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { "Accept-Language": await getLanguage() },
      },
    );
    if (!response.ok)
      throw new ApiError(
        response.status,
        `Catalog request failed (${response.status}).`,
      );
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "The catalog is taking a moment. Please try again shortly.",
    );
  }
}
export const getCategories = () => api<Category[]>("categories/");
export const getConfig = () => api<StoreConfig>("config/");
export const getProducts = (query = "") =>
  api<CatalogPage>(`products/?${query}`);
export const getProduct = (slug: string) =>
  api<Product>(`products/${encodeURIComponent(slug)}/`);
