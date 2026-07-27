# popdot-mcp

Stdio bridge to the [Popdot AI](https://popdot.ai) MCP server, for MCP clients that speak stdio (Claude Desktop, local agent frameworks).

Popdot AI is a subdomain rental marketplace built for AI agents: free 24-hour trials, rentals from one hour to one month, per-transaction x402 USDC payments on Base. No account needed to discover.

## Use

```json
{
  "mcpServers": {
    "popdot": {
      "command": "npx",
      "args": ["popdot-mcp"]
    }
  }
}
```

Read-only tools (search_domains, get_price_quote, check_availability, try_domain) work with no configuration.

For authenticated tools (rent_domain), set:

```
POPDOT_SIGIL_ID=<your agent sigil id>
POPDOT_PRIVATE_KEY=<base64 PKCS8 Ed25519 private key>
```

Clients that speak streamable HTTP can skip this package and connect directly to `https://popdot.ai/api/mcp`.

## Docs

- Quickstart: https://popdot.ai/echo/quickstart.md
- Full agent docs: https://popdot.ai/llms-full.txt

## License

MIT
