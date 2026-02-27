# Creating Blueprints

Blueprints are pre-built diagram templates that appear in the "Start from Blueprint" gallery. They are defined as static data in `src/lib/blueprints.ts` rather than stored in the database. This guide explains how to design a diagram in the editor, export its JSON, and turn it into a new blueprint entry.

---

## Quick Start

1. Open the editor and build your architecture diagram.
2. Click the **`</>`** (Show JSON) button in the bottom-left of the status bar.
3. Click **Copy to Clipboard** in the modal that appears.
4. Add a new entry to the `BLUEPRINTS` array in `src/lib/blueprints.ts` using the copied JSON as `graphData`.

---

## Step-by-Step Walkthrough

### 1. Design the diagram

Create a new diagram (or open an existing one) and lay out the architecture you want to template. Use auto-layout or manual positioning — the node positions are captured in the export.

### 2. Export the JSON

In the editor status bar (bottom of the canvas), click the **`</>`** icon button on the left side. A modal opens showing the full JSON representation of the current diagram including `nodes`, `edges`, and `viewport`. Click **Copy to Clipboard**.

The exported JSON has this shape:

```json
{
  "nodes": [
    {
      "id": "worker-1",
      "type": "cf-node",
      "position": { "x": 250, "y": 100 },
      "data": { "typeId": "worker", "label": "My Worker", "description": "" }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "worker-1",
      "target": "db-1",
      "type": "cf-edge",
      "data": { "edgeType": "data-flow" }
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

### 3. Add the blueprint entry

Open `src/lib/blueprints.ts` and add a new object to the `BLUEPRINTS` array. You have two options for supplying the `graphData`:

#### Option A: Use `buildGraphData` (preferred)

The file provides a `buildGraphData(nodes, edges)` helper that produces a clean, consistent JSON string. Translate your exported JSON into the helper's compact format:

```typescript
{
  id: "my-pattern",
  title: "My Architecture Pattern",
  description: "Short summary of what this pattern does.",
  category: "Serverless",
  graphData: buildGraphData(
    [
      { id: "worker-1", x: 250, y: 100, typeId: "worker", label: "My Worker" },
      { id: "db-1",     x: 500, y: 100, typeId: "d1",     label: "D1 Database" },
    ],
    [
      { id: "e1", source: "worker-1", target: "db-1", edgeType: "data-flow" },
    ],
  ),
},
```

This is the approach used by all existing blueprints. It keeps the file readable and normalises the JSON (e.g. `description: ""` and `viewport: { x: 0, y: 0, zoom: 1 }` are added automatically).

#### Option B: Paste raw JSON

If you prefer, paste the exported JSON directly as a string literal:

```typescript
{
  id: "my-pattern",
  title: "My Architecture Pattern",
  description: "Short summary of what this pattern does.",
  category: "Serverless",
  graphData: '{"nodes":[...],"edges":[...],"viewport":{"x":0,"y":0,"zoom":1}}',
},
```

This works but is harder to read and maintain. Option A is recommended.

### 4. Choose an ID and category

| Field         | Requirements                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `id`          | Unique slug, lowercase with hyphens (e.g. `"ai-rag"`, `"event-driven"`).                        |
| `title`       | Human-readable name shown in the gallery.                                                       |
| `description` | One or two sentences describing the architecture pattern.                                       |
| `category`    | Grouping label. Existing categories: `"Serverless"`, `"AI"`, `"Media"`. Add new ones as needed. |

### 5. Verify

Run the checks to make sure the new blueprint compiles and existing tests still pass:

```bash
npm run check
npm run test
```

The blueprint gallery page (`/blueprints`) and the "Create Diagram" modal automatically pick up any entries in the `BLUEPRINTS` array — no other code changes are needed.

---

## Blueprint Interface

For reference, every blueprint must satisfy this interface (defined in `src/lib/blueprints.ts`):

```typescript
interface Blueprint {
  id: string; // Stable slug identifier
  title: string; // Human-readable name
  description: string; // Short summary
  category: string; // Grouping category
  graphData: string; // Serialised JSON: { nodes, edges, viewport }
}
```

---

## Valid Node and Edge Types

### Node `typeId` values

Nodes use the `typeId` field to reference a Cloudflare product from the catalog (`src/lib/catalog.ts`). Common values include:

`worker`, `worker-hono`, `worker-astro`, `pages`, `d1`, `kv`, `r2`, `durable-object`, `queues`, `vectorize`, `workers-ai`, `ai-gateway`, `stream`, `images`, `cdn`, `client-browser`, `client-mobile`, and others.

Run `grep "id:" src/lib/catalog.ts` for the full list.

### Edge `edgeType` values

| Value               | Meaning                                       |
| ------------------- | --------------------------------------------- |
| `"data-flow"`       | General data transfer (HTTP, TCP, etc.)       |
| `"service-binding"` | Cloudflare service binding (Worker-to-Worker) |
| `"trigger"`         | Event trigger (e.g. Queue consumer, Cron)     |
| `"external"`        | Connection to an external/third-party service |

---

## Tips

- **Reset viewport before exporting.** If you want the blueprint to open centered, use Ctrl+Shift+F (fit view) before exporting to normalise the viewport.
- **Use meaningful node IDs.** When translating to `buildGraphData`, replace auto-generated UUIDs with short descriptive slugs (`"gateway"`, `"auth-db"`) for readability.
- **Keep positions on a grid.** Aligning `x`/`y` values to multiples of 25 or 50 keeps blueprints tidy.
