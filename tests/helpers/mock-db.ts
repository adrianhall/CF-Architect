/**
 * In-memory mock of the Drizzle query builder for testing.
 *
 * Stores rows per table and evaluates Drizzle `eq` / `and` conditions
 * against stored data. Supports the specific chain patterns used in the
 * codebase: select, insert, update, delete with where/orderBy/get.
 */

// ---------------------------------------------------------------------------
// Drizzle SQL expression introspection helpers
// ---------------------------------------------------------------------------

function isColumn(chunk: unknown): chunk is { name: string; table: unknown } {
  return (
    !!chunk && typeof chunk === "object" && "name" in chunk && "table" in chunk
  );
}

function isParam(chunk: unknown): chunk is { value: unknown } {
  if (!chunk || typeof chunk !== "object") return false;
  const obj = chunk as Record<string, unknown>;
  return (
    "value" in obj &&
    !Array.isArray(obj.value) &&
    !("table" in obj) &&
    !("queryChunks" in obj)
  );
}

function isSQL(chunk: unknown): chunk is { queryChunks: unknown[] } {
  return !!chunk && typeof chunk === "object" && "queryChunks" in chunk;
}

/** Build a mapping from SQL column names to JS property names for a Drizzle table. */
function buildColumnMap(table: object): Map<string, string> {
  const map = new Map<string, string>();
  for (const [jsName, col] of Object.entries(table)) {
    if (isColumn(col)) {
      map.set(col.name, jsName);
    }
  }
  return map;
}

/** Extract all `column = value` pairs from a Drizzle SQL expression tree. */
function extractEqPairs(
  chunks: unknown[],
  colMap: Map<string, string>,
): Array<[string, unknown]> {
  const pairs: Array<[string, unknown]> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (isSQL(chunk)) {
      pairs.push(...extractEqPairs(chunk.queryChunks, colMap));
      continue;
    }

    if (isColumn(chunk) && i + 2 < chunks.length && isParam(chunks[i + 2])) {
      const jsName = colMap.get(chunk.name) ?? chunk.name;
      pairs.push([jsName, (chunks[i + 2] as { value: unknown }).value]);
      i += 2;
    }
  }

  return pairs;
}

/** Evaluate a Drizzle SQL condition against a row using the column map. */
function evaluateCondition(
  condition: unknown,
  row: Record<string, unknown>,
  colMap: Map<string, string>,
): boolean {
  if (!condition || !isSQL(condition)) return true;
  const pairs = extractEqPairs(condition.queryChunks, colMap);
  return pairs.every(([key, val]) => row[key] === val);
}

/** Extract sort column and direction from a Drizzle `desc(col)` / `asc(col)` expression. */
function extractOrderBy(
  order: unknown,
  colMap: Map<string, string>,
): { key: string; dir: "asc" | "desc" } | null {
  if (!isSQL(order)) return null;
  const chunks = (order as { queryChunks: unknown[] }).queryChunks;

  for (const chunk of chunks) {
    if (isColumn(chunk)) {
      const jsName = colMap.get(chunk.name) ?? chunk.name;
      const hasDesc = chunks.some(
        (c: unknown) =>
          !!c &&
          typeof c === "object" &&
          "value" in c &&
          Array.isArray((c as { value: unknown }).value) &&
          (c as { value: string[] }).value.some(
            (v) => typeof v === "string" && v.includes("desc"),
          ),
      );
      return { key: jsName, dir: hasDesc ? "desc" : "asc" };
    }
  }
  return null;
}

/** Project a row down to the columns specified in a `select({ ... })` call. */
function projectRow(
  row: Record<string, unknown>,
  columns: Record<string, unknown>,
  colMap: Map<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [alias, col] of Object.entries(columns)) {
    if (isColumn(col)) {
      const jsName = colMap.get(col.name) ?? col.name;
      result[alias] = row[jsName];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Chain builders
// ---------------------------------------------------------------------------

class SelectChain {
  private _table: object | null = null;
  private _condition: unknown = null;
  private _ordering: unknown = null;

  constructor(
    private db: MockDatabase,
    private _columns?: Record<string, unknown>,
  ) {}

  from(table: object) {
    this._table = table;
    this.db.registerTable(table);
    return this;
  }

  where(condition: unknown) {
    this._condition = condition;
    return this;
  }

  orderBy(...args: unknown[]) {
    this._ordering = args[0];
    return this;
  }

  private execute(): Record<string, unknown>[] {
    if (!this._table) return [];
    const colMap = this.db.getColumnMap(this._table);
    let rows = this.db.getRows(this._table).map((r) => ({ ...r }));

    if (this._condition) {
      rows = rows.filter((row) =>
        evaluateCondition(this._condition, row, colMap),
      );
    }

    if (this._ordering) {
      const order = extractOrderBy(this._ordering, colMap);
      if (order) {
        rows.sort((a, b) => {
          const va = (a[order.key] as string) ?? "";
          const vb = (b[order.key] as string) ?? "";
          return order.dir === "desc"
            ? vb.localeCompare(va)
            : va.localeCompare(vb);
        });
      }
    }

    if (this._columns) {
      rows = rows.map((row) => projectRow(row, this._columns!, colMap));
    }

    return rows;
  }

  get(): Promise<Record<string, unknown> | undefined> {
    return Promise.resolve(this.execute()[0]);
  }

  then<TResult1 = Record<string, unknown>[], TResult2 = never>(
    resolve?:
      | ((value: Record<string, unknown>[]) => TResult1 | PromiseLike<TResult1>)
      | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute();
      return resolve
        ? Promise.resolve(resolve(result))
        : Promise.resolve(result as unknown as TResult1);
    } catch (err) {
      return reject
        ? Promise.resolve(reject(err))
        : Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

class InsertChain {
  constructor(
    private db: MockDatabase,
    private _table: object,
  ) {}

  values(row: Record<string, unknown>): PromiseLike<void> {
    this.db.addRow(this._table, row);
    return Promise.resolve();
  }
}

class UpdateChain {
  private _updates: Record<string, unknown> = {};

  constructor(
    private db: MockDatabase,
    private _table: object,
  ) {}

  set(updates: Record<string, unknown>) {
    this._updates = updates;
    return this;
  }

  where(condition: unknown): PromiseLike<void> {
    const colMap = this.db.getColumnMap(this._table);
    const rows = this.db.getRows(this._table);
    for (const row of rows) {
      if (evaluateCondition(condition, row, colMap)) {
        Object.assign(row, this._updates);
      }
    }
    return Promise.resolve();
  }
}

class DeleteChain {
  constructor(
    private db: MockDatabase,
    private _table: object,
  ) {}

  where(condition: unknown): PromiseLike<void> {
    const colMap = this.db.getColumnMap(this._table);
    const rows = this.db.getRows(this._table);
    const toKeep = rows.filter(
      (row) => !evaluateCondition(condition, row, colMap),
    );
    rows.length = 0;
    rows.push(...toKeep);
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// MockDatabase
// ---------------------------------------------------------------------------

export class MockDatabase {
  private tables = new Map<object, Record<string, unknown>[]>();
  private columnMaps = new Map<object, Map<string, string>>();

  registerTable(table: object): void {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
      this.columnMaps.set(table, buildColumnMap(table));
    }
  }

  getRows(table: object): Record<string, unknown>[] {
    return this.tables.get(table) ?? [];
  }

  getColumnMap(table: object): Map<string, string> {
    return this.columnMaps.get(table) ?? new Map();
  }

  addRow(table: object, row: Record<string, unknown>): void {
    this.registerTable(table);
    this.tables.get(table)!.push({ ...row });
  }

  /** Seed a table with rows, replacing any existing data. */
  seed(table: object, rows: Record<string, unknown>[]): void {
    this.registerTable(table);
    this.tables.set(
      table,
      rows.map((r) => ({ ...r })),
    );
  }

  /** Remove all data from all tables. */
  reset(): void {
    for (const [, rows] of this.tables) {
      rows.length = 0;
    }
  }

  /** Remove all tables and column maps entirely. */
  clear(): void {
    this.tables.clear();
    this.columnMaps.clear();
  }

  // Drizzle-compatible query API
  select(columns?: Record<string, unknown>) {
    return new SelectChain(this, columns);
  }

  insert(table: object) {
    return new InsertChain(this, table);
  }

  update(table: object) {
    return new UpdateChain(this, table);
  }

  delete(table: object) {
    return new DeleteChain(this, table);
  }
}

/** Create a fresh MockDatabase instance. */
export function createMockDatabase(): MockDatabase {
  return new MockDatabase();
}
