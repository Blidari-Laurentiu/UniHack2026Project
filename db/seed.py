"""Seed listings (A) and events (B). Dev only."""
import seed_events
import seed_listings
from common import connect, require_dev


def main() -> None:
    require_dev("seed.py")
    with connect() as conn:
        seed_listings.seed(conn)
        seed_events.seed(conn)
        conn.commit()
    print("seed done")


if __name__ == "__main__":
    main()
