// types/tables.ts
// Ergonomic aliases over the generated types/db.ts (which is overwritten by
// `npm run gen:types` -- never hand-edit it). Use these instead of spelling
// out Database["public"]["Tables"]["x"]["Row"] everywhere.
//
//   import type { Row, Insert, Update } from "@/types/tables";
//   const patch: Update<"categories"> = {};
//   function handle(p: Row<"products">) { ... }
import type { Database } from "@/types/db";

type Tables = Database["public"]["Tables"];

export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type { Json } from "@/types/db";
