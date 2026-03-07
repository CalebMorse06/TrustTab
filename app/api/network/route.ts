import { NextResponse } from "next/server";
import { Client } from "xrpl";

export async function GET() {
  let client: Client | null = null;
  try {
    client = new Client(process.env.XRPL_NETWORK || "wss://s.altnet.rippletest.net:51233");
    await client.connect();
    const serverInfo = await client.request({ command: "server_info" });
    const ledgerIndex = serverInfo.result.info.validated_ledger?.seq || 0;
    await client.disconnect();

    return NextResponse.json({
      connected: true,
      network: "testnet",
      ledgerIndex,
      serverState: serverInfo.result.info.server_state,
    });
  } catch (error) {
    if (client?.isConnected()) await client.disconnect();
    return NextResponse.json({ connected: false, network: "testnet", ledgerIndex: null });
  }
}
