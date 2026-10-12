import { NextRequest, NextResponse } from "next/server";
import { languageCookie, normalizeLanguage } from "@/lib/i18n";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  const validGet =
    /^(checkout|config|categories|products|products\/[a-zA-Z0-9_-]+)$/.test(
      route,
    );
  if (
    !(request.method === "GET" && validGet) &&
    !(request.method === "POST" && ["bag/validate", "checkout"].includes(route))
  )
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  let body: string | undefined;
  if (request.method === "POST") {
    body = await request.text();
    if (body.length > 20000)
      return NextResponse.json(
        { detail: "Bag is too large." },
        { status: 413 },
      );
  }
  try {
    const response = await fetch(
      `${process.env.DJANGO_API_URL || "http://127.0.0.1:8000/api"}/${route}/${request.nextUrl.search}`,
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          ...(route === "checkout" ? { Cookie: request.headers.get("cookie") || "", "X-CSRFToken": request.headers.get("x-csrftoken") || "", ...(request.headers.get("origin") ? { Origin: request.headers.get("origin")! } : {}) } : {}),
          "Accept-Language": normalizeLanguage(
            request.cookies.get(languageCookie)?.value,
          ),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    for (const cookie of response.headers.getSetCookie())
      responseHeaders.append("Set-Cookie", cookie);
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "The catalog is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST };
