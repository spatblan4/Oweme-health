export type PreparedDemoUploadKind = "claim" | "payment";

export type PreparedDemoUpload = {
  clientId: string;
  name: string;
  status: "uploaded";
  fileId: string;
};

const preparedDemoUploads: Record<PreparedDemoUploadKind, PreparedDemoUpload> = {
  claim: {
    clientId: "prepared-demo-claim",
    name: "ClaimResults.xlsx",
    status: "uploaded",
    fileId: "prepared-demo-claim-file",
  },
  payment: {
    clientId: "prepared-demo-payment",
    name: "HSATransactionsAsOf_07032026.csv",
    status: "uploaded",
    fileId: "prepared-demo-payment-file",
  },
};

export function getPreparedDemoUpload(kind: PreparedDemoUploadKind) {
  return { ...preparedDemoUploads[kind] };
}

export function areDemoUploadsReady(selectedUploads: {
  claim: Array<{ status: string; fileId?: string }>;
  payment: Array<{ status: string; fileId?: string }>;
}) {
  return (['claim', 'payment'] as const).every((kind) =>
    selectedUploads[kind].some((upload) => upload.status === "uploaded" && Boolean(upload.fileId)),
  );
}
