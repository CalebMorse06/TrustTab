import { NextRequest, NextResponse } from "next/server";
import { Client } from "xrpl";

const RLUSD_CURRENCY = "524C555344000000000000000000000000000000";
const RLUSD_ISSUER = "rQhWct2fTR9z73ep2mhEoEUauD8CHTkwyR";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  let client: Client | null = null;
  try {
    client = new Client(process.env.XRPL_NETWORK || "wss://s.altnet.rippletest.net:51233");
    await client.connect();

    // Get XRP balance
    const accountInfo = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });
    const xrpDrops = accountInfo.result.account_data.Balance;
    const xrpBalance = Number(xrpDrops) / 1_000_000;

    // Get RLUSD balance from trustlines
    let rlusdBalance = "0";
    try {
      const lines = await client.request({
        command: "account_lines",
        account: address,
        peer: RLUSD_ISSUER,
      });
      const rlusdLine = lines.result.lines.find(
        (l: any) => l.currency === RLUSD_CURRENCY || l.currency === "RLUSD"
      );
      if (rlusdLine) {
        rlusdBalance = rlusdLine.balance;
      }
    } catch {
      // No trustline yet
    }

    // Check if trustline exists
    let hasTrustline = false;
    try {
      const lines = await client.request({
        command: "account_lines",
        account: address,
      });
      hasTrustline = lines.result.lines.some(
        (l: any) => (l.currency === RLUSD_CURRENCY || l.currency === "RLUSD") && l.account === RLUSD_ISSUER
      );
    } catch {}

    await client.disconnect();

    return NextResponse.json({
      address,
      xrp: xrpBalance.toFixed(2),
      rlusd: rlusdBalance,
      hasTrustline,
    });
  } catch (error) {
    if (client?.isConnected()) await client.disconnect();
    return NextResponse.json({
      address,
      xrp: "0",
      rlusd: "0",
      hasTrustline: false,
      error: "Failed to fetch balance",
    });
  }
}
