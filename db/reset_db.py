"""Drop all project tables and recreate them. Dev only; asks first unless --yes."""
import argparse
import sys

from apply_schema import apply, summary
from common import connect, require_dev

# Dependency order: children first.
TABLES = [
    "reports", "group_members", "event_groups", "event_signups", "events",
    "user_availability", "user_interests", "interests",
    "lease_analyses", "listings", "users",
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    require_dev("reset_db.py")
    if not args.yes:
        if input("Type 'yes' to drop all project tables: ").strip().lower() != "yes":
            sys.exit("Aborted.")

    with connect() as conn:
        for table in TABLES:
            conn.execute(f"drop table if exists {table} cascade")
        conn.commit()
        print(f"dropped {len(TABLES)} tables")
        apply(conn)
        summary(conn)


if __name__ == "__main__":
    main()
