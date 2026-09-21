#!/usr/bin/env node
/**
 * popdot-mcp: stdio bridge to the Popdot AI MCP server.
 *
 * Proxies newline-delimited JSON-RPC messages from stdin to
 * https://popdot.ai/api/mcp and writes responses to stdout. No business
 * logic lives here; it is a connector.
 *
 * Environment:
 *   POPDOT_MCP_URL      override the server URL (default https://popdot.ai/api/mcp)
 *   POPDOT_SIGIL_ID     agent sigil id, enables authenticated tools
 *   POPDOT_PRIVATE_KEY  base64 PKCS8 Ed25519 private key for request signing
 */

import { createInterface } from "node:readline";
import { webcrypto } from "node:crypto";
import { protocolHeaders } from "./mcp-headers.js";

const URL_ = process.env.POPDOT_MCP_URL || "https://popdot.ai/api/mcp";
const SIGIL_ID = process.env.POPDOT_SIGIL_ID;
const PRIVATE_KEY = process.env.POPDOT_PRIVATE_KEY;

let signingKey = null;
async function getSigningKey() {
  if (!PRIVATE_KEY) return null;
  if (!signingKey) {
    signingKey = await webcrypto.subtle.importKey(
      "pkcs8",
      Buffer.from(PRIVATE_KEY, "base64"),
      { name: "Ed25519" },
      false,
      ["sign"]
    );
  }
  return signingKey;
}

async function authHeaders(bodyText) {
  if (!SIGIL_ID || !PRIVATE_KEY) return {};
  const key = await getSigningKey();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = Buffer.from(
    await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyText))
  ).toString("hex");
  const path = new URL(URL_).pathname;
  const message = `${timestamp}\nPOST\n${path}\n${bodyHash}`;
  const signature = Buffer.from(
    await webcrypto.subtle.sign("Ed25519", key, new TextEncoder().encode(message))
  ).toString("base64");
  return {
    "X-Popdot-Sigil-Id": SIGIL_ID,
    "X-Popdot-Timestamp": timestamp,
    "X-Popdot-Signature": signature,
  };
}

async function forward(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return; // not JSON, ignore
  }

  const bodyText = JSON.stringify(message);
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...protocolHeaders(message),
        ...(await authHeaders(bodyText)),
      },
      body: bodyText,
    });

    // Notifications are acknowledged with 202 and no body: nothing to write.
    if (res.status === 202) return;

    const text = await res.text();
    if (text) process.stdout.write(text.trim() + "\n");
  } catch (err) {
    if ("id" in message) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32000, message: `popdot-mcp transport error: ${err.message}` },
        }) + "\n"
      );
    }
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
let queue = Promise.resolve();
rl.on("line", (line) => {
  if (!line.trim()) return;
  // Serialize forwards so stdout responses keep request order
  queue = queue.then(() => forward(line));
});
rl.on("close", () => {
  queue.then(() => process.exit(0));
});
