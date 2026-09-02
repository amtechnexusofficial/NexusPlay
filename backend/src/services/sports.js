// Sports is a small global reference table (seeded in schema.sql), not
// tenant-scoped — every org picks from the same catalog.

export async function listSports(sql) {
  return sql`select * from sports order by name`;
}
