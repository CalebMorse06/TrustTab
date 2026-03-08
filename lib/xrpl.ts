import { Client, Wallet, Payment, xrpToDrops } from "xrpl";
import { Obligation } from "./types";

const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.altnet.rippletest.net:51233";

let clientInstance: Client | null = null;

async function getClient(): Promise<Client> {
  if (clientInstance?.isConnected()) return clientInstance;
  // Clean up old instance
  if (clientInstance) {
    try { await clientInstance.disconnect(); } catch {}
    clientInstance = null;
  }
  clientInstance = new Client(XRPL_NETWORK);
  await clientInstance.connect();
  return clientInstance;
}

export async function disconnectClient(): Promise<void> {
  if (clientInstance) {
    try { await clientInstance.disconnect(); } catch {}
    clientInstance = null;
  }
}

// Cache funded wallets to avoid faucet rate limits
const walletCache: { address: string; seed: string }[] = [];

export async function generateFundedWallet(): Promise<{
  address: string;
  seed: string;
}> {
  // Use cached wallet if available
  if (walletCache.length > 0) {
    return walletCache.pop()!;
  }
  const client = await getClient();
  const { wallet } = await client.fundWallet();
  return { address: wallet.address, seed: wallet.seed! };
}

// Pre-fund wallets in background for faster demo
export async function prefundWallets(count: number): Promise<void> {
  try {
    const client = await getClient();
    for (let i = 0; i < count; i++) {
      const { wallet } = await client.fundWallet();
      walletCache.push({ address: wallet.address, seed: wallet.seed! });
    }
  } catch (e) {
    console.error("Prefund failed:", e);
  }
}

export async function sendXRPPayment(
  senderSeed: string,
  destinationAddress: string,
  amountXRP: string,
  memoCid?: string
): Promise<{ txHash: string; success: boolean; ledgerIndex?: number }> {
  const client = await getClient();
  const wallet = Wallet.fromSeed(senderSeed);

  const payment: Payment = {
    TransactionType: "Payment",
    Account: wallet.address,
    Destination: destinationAddress,
    Amount: xrpToDrops(amountXRP),
    Memos: memoCid
      ? [
          {
            Memo: {
              MemoType: Buffer.from("text/plain").toString("hex").toUpperCase(),
              MemoData: Buffer.from(memoCid).toString("hex").toUpperCase(),
            },
          },
        ]
      : undefined,
  };

  try {
    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    const success =
      typeof meta === "object" &&
      meta !== null &&
      "TransactionResult" in meta &&
      (meta as { TransactionResult: string }).TransactionResult === "tesSUCCESS";

    // Extract ledger index for proof
    const ledgerIndex =
      typeof meta === "object" && meta !== null && "ledger_index" in result.result
        ? (result.result as any).ledger_index
        : undefined;

    return {
      txHash: typeof result.result.hash === "string" ? result.result.hash : "",
      success,
      ledgerIndex,
    };
  } catch (error) {
    console.error("XRP payment failed:", error);
    return { txHash: "", success: false };
  }
}

export async function executeSettlement(
  obligations: Obligation[],
  participants: Map<string, { seed: string; address: string }>,
  receiptCid?: string
): Promise<(Obligation & { ledgerIndex?: number })[]> {
  const results: (Obligation & { ledgerIndex?: number })[] = [];

  for (const obligation of obligations) {
    const sender = participants.get(obligation.from);
    const receiver = participants.get(obligation.to);

    if (!sender || !receiver) {
      results.push({ ...obligation, status: "failed" });
      continue;
    }

    let status: Obligation["status"] = "submitted";
    let txHash = "";
    let ledgerIndex: number | undefined;

    // Retry up to 2 times on failure
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await sendXRPPayment(
          sender.seed,
          receiver.address,
          obligation.rlusdAmount.toFixed(6),
          receiptCid
        );

        txHash = result.txHash;
        ledgerIndex = result.ledgerIndex;
        status = result.success ? "confirmed" : "failed";

        if (status === "confirmed") break;
        // Wait before retry
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      } catch {
        status = "failed";
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      }
    }

    results.push({ ...obligation, status, txHash, ledgerIndex });
  }

  return results;
}

export function getExplorerUrl(txHash: string): string {
  return `https://testnet.xrpl.org/transactions/${txHash}`;
}
