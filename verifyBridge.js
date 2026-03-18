import { ethers } from "ethers";

const BASE_RPC = "https://mainnet.base.org";
const BRIDGE = "0x92cF4914826E49dE30E3e4B325417E8a96879d1E";
const bridgeAbi = [
  "function aiBot() view returns (address)",
  "function owner() view returns (address)"
];

const provider = new ethers.JsonRpcProvider(BASE_RPC);
const contract = new ethers.Contract(BRIDGE, bridgeAbi, provider);

async function main() {
  const aiBot = await contract.aiBot();
  const owner = await contract.owner();
  console.log("Contract:", BRIDGE);
  console.log("aiBot:", aiBot);
  console.log("owner:", owner);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
