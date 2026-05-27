type InternalPaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | null;

export type PaymentResultUiState = "confirming" | "completed" | "failed" | "not_found";

export function mapPaymentResultState(input: {
  hasPaymentIdHint: boolean;
  internalStatus: InternalPaymentStatus;
  redirectStatus?: string;
  collectionStatus?: string;
}): PaymentResultUiState {
  const { hasPaymentIdHint, internalStatus } = input;

  if (!hasPaymentIdHint) {
    return "not_found";
  }

  if (internalStatus === "COMPLETED") {
    return "completed";
  }

  if (internalStatus === "FAILED") {
    return "failed";
  }

  return "confirming";
}
