import { CeloProvider } from "@celo-tools/celo-ethers-wrapper";
import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";

const config = {
  CELO_NODE_RPC_URL:
    process.env.CELO_NODE_RPC_URL ?? "https://alfajores-forno.celo-testnet.org",
  TRANSACTION_HASH:
    process.env.TRANSACTION_HASH ??
    "0x900e2997467c1747bb1d4a1175f8ee3f89600c842e297abda98251913edbf7db",
  RECIPIENT_ADDRESS:
    process.env.RECIPIENT_ADDRESS ??
    "0xc66CC824028Fec88C5A6652723c1702d8e9b1e6a",
};

async function getTransactionReceipt({
  transactionHash,
  recipientAddress,
}: {
  transactionHash: string;
  recipientAddress: string;
}): Promise<{
  from: string;
  to: string | null;
  amount: number | null;
} | null> {
  const kit = newKitFromWeb3(new Web3(config.CELO_NODE_RPC_URL));
  const provider = new CeloProvider(config.CELO_NODE_RPC_URL);

  const receipt = await provider.getTransactionReceipt(transactionHash);

  if (!receipt) {
    throw new Error("Transaction receipt not found");
  }

  const transferEvent = "Transfer(address,address,uint256)";
  const transferEventHex = kit.web3.utils.keccak256(transferEvent);

  const log = receipt.logs
    .map((log) => {
      //filter only transfer events
      if (!log.topics[0].startsWith(transferEventHex)) {
        return null;
      }
      try {
        const decodedLog = kit.web3.eth.abi.decodeLog(
          [
            {
              indexed: true,
              internalType: "address",
              name: "from",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          log.data,
          log.topics.slice(1),
        );
        return {
          from: decodedLog.from,
          to: decodedLog.to,
          value: Number(kit.web3.utils.fromWei(decodedLog.value, "ether")),
        };
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean)
    .find((log) => log?.to.toLowerCase() === recipientAddress.toLowerCase());

  if (!log) {
    throw new Error("Transaction receipt sender does not match");
  }

  return {
    from: receipt.from,
    to: recipientAddress,
    amount: log.value,
  };
}

(async () => {
  console.log("Processing transaction receipt...");
  const result = await getTransactionReceipt({
    transactionHash: config.TRANSACTION_HASH,
    recipientAddress: config.RECIPIENT_ADDRESS,
  });
  console.log("Transaction receipt: ", JSON.stringify(result, null, 2));
  process.exit(0);
})();
