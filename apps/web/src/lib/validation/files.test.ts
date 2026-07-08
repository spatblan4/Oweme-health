import { describe, expect, it } from "vitest";

import { parseUploadInitInput } from "./files";

describe("parseUploadInitInput", () => {
  it("accepts a supported claim file and normalizes its name", () => {
    expect(
      parseUploadInitInput({
        kind: "claim",
        originalName: "Claim Results 3.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileSizeBytes: 2048,
      }),
    ).toEqual({
      kind: "claim",
      originalName: "Claim Results 3.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSizeBytes: 2048,
    });
  });

  it("rejects unsupported file kinds", () => {
    expect(() =>
      parseUploadInitInput({
        kind: "invoice",
        originalName: "file.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
      }),
    ).toThrow("Invalid upload metadata");
  });

  it("rejects empty file names", () => {
    expect(() =>
      parseUploadInitInput({
        kind: "payment",
        originalName: "   ",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
      }),
    ).toThrow("Invalid upload metadata");
  });

  it("rejects image uploads that the worker cannot OCR yet", () => {
    expect(() =>
      parseUploadInitInput({
        kind: "payment",
        originalName: "statement.png",
        mimeType: "image/png",
        fileSizeBytes: 2048,
      }),
    ).toThrow("Invalid upload metadata");
  });
});
