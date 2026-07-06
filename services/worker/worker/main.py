from worker.jobs import poll_once


def main() -> int:
    return poll_once()


if __name__ == "__main__":
    raise SystemExit(main())
