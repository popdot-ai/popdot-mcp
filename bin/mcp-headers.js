/**
 * Streamable HTTP header derivation for the stdio bridge. Pure, no I/O, so it
 * can be unit tested apart from the CLI's stdin loop.
 */

// Header-safe per RFC 9110 field-value rules; anything else (non-ASCII,
// whitespace, control chars, or a value that itself matches the sentinel) is
// carried in the Base64 sentinel form the transport defines.
export function headerValue(v) {
  return /^[\x21-\x7e]+$/.test(v) && !/^=\?base64\?.*\?=$/.test(v)
    ? v
    : `=?base64?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

// A modern (2026-07-28) request self-describes in the body _meta. The bridge
// mirrors the required values into HTTP headers so the Streamable HTTP server
// accepts it; a legacy request carries no _meta version and gets none of these.
export function protocolHeaders(message) {
  const version = message?.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  if (typeof version !== "string") return {};
  const headers = { "MCP-Protocol-Version": version };
  if (typeof message.method === "string") headers["Mcp-Method"] = message.method;
  const name =
    message.method === "tools/call" || message.method === "prompts/get"
      ? message?.params?.name
      : message.method === "resources/read"
        ? message?.params?.uri
        : undefined;
  if (typeof name === "string") headers["Mcp-Name"] = headerValue(name);
  return headers;
}
