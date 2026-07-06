export function requireRequestUserId(request: Request) {
  const headerUserId = request.headers.get("x-oweme-user-id");
  if (headerUserId) {
    return headerUserId;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)oweme-user-id=([^;]+)/);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  throw new Error("Unauthorized");
}

