"""Create or update the schema by running db/schema/*.sql in name order. Never drops anything."""
from common import SCHEMA_DIR, connect


def apply(conn) -> None:
    for path in sorted(SCHEMA_DIR.glob("*.sql")):
        conn.execute(path.read_text(encoding="utf-8"))
        conn.commit()
        print(f"applied {path.name}")


def summary(conn) -> None:
    tables = [r[0] for r in conn.execute(
        "select table_name from information_schema.tables "
        "where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"
    )]
    print(f"\ntables in public ({len(tables)}): {', '.join(tables)}")

    has_ts = conn.execute(
        "select exists (select 1 from pg_extension where extname = 'timescaledb')"
    ).fetchone()[0]
    if not has_ts:
        print("listings hypertable: no (timescaledb not installed)")
        return
    is_hyper = conn.execute(
        "select exists (select 1 from timescaledb_information.hypertables "
        "where hypertable_name = 'listings')"
    ).fetchone()[0]
    print(f"listings hypertable: {'yes' if is_hyper else 'no'}")


if __name__ == "__main__":
    with connect() as conn:
        apply(conn)
        summary(conn)
