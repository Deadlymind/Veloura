"use client";
import { clientTranslate as t } from "./i18n";
import type { Translations } from "@/components/admin/translation-fields";
let csrfToken = "";
export class StaffError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
function explain(value: unknown): string {
  if (typeof value === "string") return t(value);
  if (Array.isArray(value)) return value.map(explain).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([key, val]) =>
          `${key === "detail" || key === "non_field_errors" ? "" : `${key.replaceAll("_", " ")}: `}${explain(val)}`,
      )
      .join("\n");
  return t("Something went wrong. Please try again.");
}
export async function staffApi<T = unknown>(
  path: string,
  options: { method?: string; data?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";
  if (method !== "GET" && !csrfToken) {
    const response = await fetch("/api/staff/csrf", { cache: "no-store" });
    if (!response.ok)
      throw new StaffError(
        t("Unable to start a secure session."),
        response.status,
      );
    csrfToken = (await response.json()).csrfToken;
  }
  const multipart = options.data instanceof FormData;
  const response = await fetch(`/api/staff/${path}`, {
    method,
    headers: {
      ...(multipart ? {} : { "Content-Type": "application/json" }),
      ...(method !== "GET" ? { "X-CSRFToken": csrfToken } : {}),
    },
    body:
      options.data === undefined
        ? undefined
        : multipart
          ? (options.data as FormData)
          : JSON.stringify(options.data),
    cache: "no-store",
  });
  let data;
  try {
    data = response.status === 204 ? null : await response.json();
  } catch {
    throw new StaffError(
      t("The server returned an unexpected response. Please try again."),
      response.status,
    );
  }
  if (!response.ok) {
    if (response.status === 403) csrfToken = "";
    throw new StaffError(explain(data), response.status);
  }
  if (data?.csrfToken) csrfToken = data.csrfToken;
  return data as T;
}
export function uploadImage<T>(
  path: string,
  form: FormData,
  onProgress: (n: number) => void,
  method = "POST",
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      if (!csrfToken) await staffApi("csrf");
      const xhr = new XMLHttpRequest();
      xhr.open(method, `/api/staff/${path}`);
      xhr.setRequestHeader("X-CSRFToken", csrfToken);
      xhr.timeout = 60000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onerror = () =>
        reject(new Error(t("Upload failed. Check your connection.")));
      xhr.ontimeout = () =>
        reject(new Error(t("Upload timed out. Try a smaller image.")));
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new StaffError(explain(data), xhr.status));
        } catch {
          reject(new Error(t("Upload failed. Please try again.")));
        }
      };
      xhr.send(form);
    } catch (error) {
      reject(error);
    }
  });
}
export type StaffUser = {
  id: number;
  username: string;
  first_name: string;
  email: string;
  role: "Administrator" | "Catalog Editor";
  is_active: boolean;
  permissions: string[];
};
export type StaffCategory = {
  translations: Translations;
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  preview_image: string;
  position: number;
  product_count: number;
};
export type StaffImage = {
  translations: Translations;
  id: number;
  product: number;
  url: string;
  image_url: string;
  alt: string;
  position: number;
};
export type StaffVariant = {
  translations: Translations;
  id: number;
  product: number;
  name: string;
  sku: string;
  shade: string;
  color: string;
  size: string;
  price: string | null;
  stock: number;
  position: number;
};
export type StaffProduct = {
  translations: Translations;
  id: number;
  name: string;
  slug: string;
  subtitle: string;
  category: number;
  category_name: string;
  description: string;
  price: string;
  stock: number;
  stock_total: number;
  ingredients: string;
  usage: string;
  details: string;
  attribute: string;
  featured: boolean;
  is_new: boolean;
  is_active: boolean;
  is_demo: boolean;
  images: StaffImage[];
  variants: StaffVariant[];
  created_at: string;
};
export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export type Activity = {
  id: number;
  actor_name: string;
  action: string;
  target: string;
  changes: Record<string, { before?: string; after?: string }>;
  created_at: string;
};
