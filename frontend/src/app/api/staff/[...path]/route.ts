import { NextRequest, NextResponse } from "next/server";
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const route = (await context.params).path.join("/");
  if (
    !/^(csrf|login|logout|session|overview|inventory|settings|activity|users(?:\/\d+)?|orders(?:\/\d+)?|(?:products|categories|images|variants)(?:\/\d+(?:\/reorder_images)?)?)$/.test(
      route,
    )
  )
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  if (Number(request.headers.get("content-length") || 0) > 12 * 1024 * 1024)
    return NextResponse.json(
      { detail: "Upload is too large." },
      { status: 413 },
    );
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  if (body && body.byteLength > 12 * 1024 * 1024)
    return NextResponse.json(
      { detail: "Upload is too large." },
      { status: 413 },
    );
  const headers = new Headers();
  for (const name of [
    "cookie",
    "content-type",
    "x-csrftoken",
    "origin",
    "referer",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(
      `${process.env.DJANGO_API_URL || "http://127.0.0.1:8000/api"}/staff/${route}/${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      },
    );
    const out = new Headers({
      "Content-Type":
        response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    for (const cookie of response.headers.getSetCookie())
      out.append("Set-Cookie", cookie);
    return new NextResponse(
      response.status === 204 ? null : await response.text(),
      { status: response.status, headers: out },
    );
  } catch {
    return NextResponse.json(
      { detail: "The admin service is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
  proxy as PUT,
};
