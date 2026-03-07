export interface Participant {
  id: string;
  name: string;
  avatar: string;
  wallet: {
    address: string;
    seed: string;
  };
}

export interface Split {
  participantId: string;
  amount: number;
  settled: boolean;
}

export interface ExtractedReceipt {
  vendor: string;
  date: string;
  lineItems: { name: string; quantity: number; price: number }[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  confidence: number;
}

export interface ReceiptArtifact {
  pinataCid: string;
  pinataFileId: string;
  fileName: string;
  mimeType: string;
  extractedData: ExtractedReceipt | null;
}

export interface Expense {
  id: string;
  tripId: string;
  paidBy: string;
  description: string;
  amount: number;
  splitType: "equal" | "custom";
  splits: Split[];
  receipt: ReceiptArtifact | null;
  status: "pending" | "settled";
  createdAt: string;
}

export interface Trip {
  id: string;
  name: string;
  participants: Participant[];
  expenses: Expense[];
  status: "active" | "settled";
  createdAt: string;
}

export interface Obligation {
  from: string;
  to: string;
  amount: number;
  rlusdAmount: number;
  txHash?: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
}

export interface EscrowRecord {
  from: string;
  to: string;
  amount: number;
  escrowId?: number;
  condition?: string;
  fulfillment?: string;
  status: "created" | "finished" | "cancelled";
}

export interface SettlementResult {
  tripId: string;
  obligations: Obligation[];
  escrows: EscrowRecord[];
  totalTransactions: number;
  status: "pending" | "in_progress" | "completed" | "failed";
}
