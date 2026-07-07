import sys
import time

from worker.config import load_config
from worker.jobs import poll_once


def main() -> int:
    poll_seconds = load_config().poll_seconds
    try:
        while True:
            try:
                poll_once()
            except Exception as exc:
                print(f"worker poll error: {exc}", file=sys.stderr)
            time.sleep(poll_seconds)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
