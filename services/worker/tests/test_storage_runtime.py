from pathlib import Path

from worker.storage import download_source_file


def test_download_source_file_writes_bytes_to_a_temp_path(tmp_path: Path):
    downloaded = download_source_file(
        {
            "id": "file-1",
            "original_name": "claim-results.xlsx",
            "bucket": "uploads",
            "storage_path": "uploads/user-1/file-1-claim-results.xlsx",
        },
        deps={
            "download_bytes": lambda bucket, storage_path: b"hello world",
            "temp_dir": tmp_path,
        },
    )

    assert downloaded.name == "file-1-claim-results.xlsx"
    assert downloaded.read_bytes() == b"hello world"

