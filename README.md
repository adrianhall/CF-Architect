# CF Architect

A web application for designing, building, and sharing architecture diagrams for the Cloudflare Developer Platform. Drag and drop Cloudflare service nodes onto an interactive canvas, connect them to represent data flow and service bindings, and share finished diagrams via a read-only link.

Built with Astro, React, and React Flow, running entirely on the Cloudflare Developer Platform.

## Key Features

- **30 Cloudflare service nodes** across 6 categories (Compute, Storage, AI, Media, Network, External)
- **4 edge types** with distinct visual styles (data flow, service binding, trigger, external)
- **Drag-and-drop** from the service palette onto the canvas
- **Auto-layout** powered by ELK (layered, orthogonal edge routing)
- **Autosave** with 500ms debounce and save status indicator
- **Undo/redo** with session-scoped history (Ctrl+Z / Ctrl+Shift+Z)
- **Share links** with read-only view and copy-to-clipboard
- **Dark mode** with system preference detection and manual toggle
- **Responsive** layout (palette collapses on smaller screens)
- **Properties panel** for editing node labels, descriptions, edge types, and protocols

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [npm](https://www.npmjs.com/) v10 or later
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (for deployment; not required for local development)

## Quickstart

```bash
npm install
npm run db:migrate:local
npm run dev
```

Then browse to http://localhost:4321

## Additional Information

See the following files for more information:

* [Project Structure](./docs/STRUCTURE.md)
* [Local Development](./docs/LOCAL_DEVELOPMENT.md)
* [Manual Deployment](./docs/MANUAL_DEPLOYMENT.md)
* [Deploy via GitHub Actions](./docs/CICD.md)

## License

Private -- not open source.
