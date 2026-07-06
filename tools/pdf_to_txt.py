#!/usr/bin/env python3
"""Extract text from a scanned PDF into a txt file using macOS Vision OCR.

Usage:
    python3 tools/pdf_to_txt.py input.pdf output.txt

Requirements:
    - pdf2image
    - Pillow
    - macOS with the Vision framework
    - poppler on PATH for pdf2image
"""

import os
import subprocess
import sys
import tempfile

from PIL import Image
from pdf2image import convert_from_path

_SWIFT_SRC = r'''
import Cocoa
import Vision

func ocr(path: String) -> String {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return "[ERROR: cannot load image \(path)]\n"
    }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    req.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: cg, orientation: .up)
    do { try handler.perform([req]) } catch { return "[ERROR: \(error)]\n" }
    guard let obs = req.results else { return "[NO RESULTS]\n" }
    var lines: [(Double, Double, String)] = []
    for o in obs {
        if let t = o.topCandidates(1).first?.string {
            let b = o.boundingBox
            lines.append((Double(b.origin.y), Double(b.origin.x), t))
        }
    }
    lines.sort { $0.0 != $1.0 ? $0.0 > $1.0 : $0.1 < $1.1 }
    return lines.map { $0.2 }.joined(separator: "\n") + "\n"
}
let args = CommandLine.arguments
for (i, a) in args.dropFirst().enumerated() {
    print("###PAGE \(i+1)###")
    print(ocr(path: a))
}
'''


def _run_swift_ocr(image_paths):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".swift", delete=False) as handle:
        handle.write(_SWIFT_SRC)
        swift_file = handle.name

    try:
        cache = tempfile.mkdtemp()
        proc = subprocess.run(
            ["swift", "-module-cache-path", cache, swift_file, *image_paths],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            sys.stderr.write(proc.stderr)
            sys.exit(f"swift OCR failed (exit {proc.returncode})")
        if proc.stderr.strip():
            sys.stderr.write(proc.stderr)
        return proc.stdout
    finally:
        os.unlink(swift_file)


def extract_text(pdf_path):
    pages = convert_from_path(pdf_path, dpi=300)
    output = []
    temp_dir = tempfile.mkdtemp()
    image_paths = []

    for index, page in enumerate(pages, 1):
        width, height = page.size
        reduced = page.resize((width // 2, height // 2), Image.LANCZOS)
        path = os.path.join(temp_dir, f"page-{index}.png")
        reduced.save(path, "PNG")
        image_paths.append(path)

    raw = _run_swift_ocr(image_paths)
    chunks = raw.split("###PAGE ")

    for chunk in chunks[1:]:
        _page_number, _sep, body = chunk.partition("###")
        output.append(body.strip("\n"))

    while len(output) < len(pages):
        output.append("")

    return output


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python3 tools/pdf_to_txt.py input.pdf [output.txt]")

    pdf_path = sys.argv[1]
    output_path = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.path.splitext(pdf_path)[0] + ".txt"
    )

    if not os.path.exists(pdf_path):
        sys.exit(f"input PDF not found: {pdf_path}")

    pages = extract_text(pdf_path)
    with open(output_path, "w", encoding="utf-8") as handle:
        for index, text in enumerate(pages, 1):
            handle.write(f"===== Page {index} =====\n")
            handle.write(text)
            handle.write("\n\n")

    print(f"wrote {len(pages)} page(s) -> {output_path}")


if __name__ == "__main__":
    main()
