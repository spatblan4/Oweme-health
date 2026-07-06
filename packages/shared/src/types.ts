export type FileKind = "claim" | "payment" | "eob" | "receipt" | "other";

export type FileJobStatus = "queued" | "running" | "succeeded" | "failed";

export type FileStatus = "uploaded" | "processing" | "processed" | "failed";

export type FindingType =
  | "possible_credit"
  | "allocation_unclear"
  | "questionable_canceled_charge"
  | "claim_in_process"
  | "unmatched_payment";

export type FindingSeverity = "info" | "attention" | "urgent";

export type FindingStatus = "open" | "resolved" | "dismissed";

