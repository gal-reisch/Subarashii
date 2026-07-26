import type { PostgrestError } from "@supabase/supabase-js";

// Postgres raises 42703 `undefined_column` when a statement names a column
// the table doesn't have. In this app that means exactly one thing: a
// migration in supabase/migrations/ hasn't been applied to the database yet.
//
// Migrations here are run by hand in the Supabase SQL editor, so code and
// schema can legitimately be out of step for a while — someone pulls a
// deploy before running the SQL. Where that gap would break something
// important (saving a recipe, listing the box) the call retries without the
// new column instead, and the feature quietly lights up once the migration
// lands.
//
// Matching on the code specifically, rather than on "did it error", matters:
// a blanket retry would also swallow constraint violations, permission
// errors and dropped connections, turning real failures into silent
// half-writes.
const UNDEFINED_COLUMN = "42703";

export function isUndefinedColumn(error: PostgrestError | null): boolean {
  return error?.code === UNDEFINED_COLUMN;
}
