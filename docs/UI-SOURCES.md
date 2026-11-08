# UI source attribution

The Button, Input and Dialog (now Sheet) wrappers in `packages/ui/src/primitives` originate from the official [shadcn/ui](https://github.com/shadcn-ui/ui) Base UI / base-nova generator used in the earlier local scaffold. Only these generated UI building blocks were retained; the pages, app state, HTTP API, MCP service and database application code were implemented anew.

Unused exports and wrappers were removed for this application. The shadcn MIT license is preserved in `licenses/shadcn-LICENSE.md`. Components use the separately installed `@base-ui/react` package. `components.json` keeps the generator configuration for future additions.
