export function deliveryStatusLabel(status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "RETRYING"): string {
  switch (status) {
    case "SENT":
      return "Accepted by mail server";
    case "QUEUED":
      return "Queued";
    case "SENDING":
      return "Sending";
    case "RETRYING":
      return "Retrying";
    case "FAILED":
      return "Failed";
  }
}

export function batchStatusLabel(status: "QUEUED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED"): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "PROCESSING":
      return "Processing";
    case "COMPLETED":
      return "Completed";
    case "COMPLETED_WITH_ERRORS":
      return "Completed with errors";
    case "FAILED":
      return "Failed";
  }
}
