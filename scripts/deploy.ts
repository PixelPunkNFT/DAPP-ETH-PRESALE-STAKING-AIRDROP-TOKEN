import { ethers, run, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Token
  console.log("\nDeploying Token...");
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(
    process.env.TOKEN_NAME || "Your Token",
    process.env.TOKEN_SYMBOL || "TOKEN",
    process.env.INITIAL_SUPPLY || "1000000000"
  );
  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());

  // Deploy Presale
  console.log("\nDeploying Presale...");
  const Presale = await ethers.getContractFactory("Presale");
  const presale = await Presale.deploy(
    await token.getAddress(),
    process.env.UNISWAP_ROUTER || "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
    ethers.parseEther(process.env.SOFT_CAP || "100"),
    ethers.parseEther(process.env.HARD_CAP || "500"),
    ethers.parseEther(process.env.MIN_CONTRIBUTION || "0.1"),
    ethers.parseEther(process.env.MAX_CONTRIBUTION || "5"),
    process.env.PRESALE_PRICE || "1000000"
  );
  await presale.waitForDeployment();
  console.log("Presale deployed to:", await presale.getAddress());

  // Deploy Staking
  console.log("\nDeploying Staking...");
  const Staking = await ethers.getContractFactory("Staking");
  const minStakingPeriod = process.env.MIN_STAKING_PERIOD ? parseInt(process.env.MIN_STAKING_PERIOD) : 60;
  console.log("Setting minimum staking period to:", minStakingPeriod, "seconds");
  const staking = await Staking.deploy(
    await token.getAddress(),
    process.env.REWARD_RATE || "100",
    minStakingPeriod.toString()
  );
  await staking.waitForDeployment();
  console.log("Staking deployed to:", await staking.getAddress());

  // Transfer tokens to contracts
  console.log("\nTransferring tokens to contracts...");
  const initialSupply = ethers.parseEther(process.env.INITIAL_SUPPLY || "1000000000");
  
  // 50% to presale
  await token.transfer(await presale.getAddress(), initialSupply / 2n);
  console.log("Transferred 50% of tokens to presale contract");
  
  // 25% to staking
  await token.transfer(await staking.getAddress(), initialSupply / 4n);
  console.log("Transferred 25% of tokens to staking contract");

  // Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY && network.name !== "hardhat") {
    console.log("\nVerifying contracts on Etherscan...");
    try {
      // Wait for contracts to be deployed properly
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds delay

      await run("verify", {
        address: await token.getAddress(),
        constructorArguments: [
          process.env.TOKEN_NAME || "Your Token",
          process.env.TOKEN_SYMBOL || "TOKEN",
          process.env.INITIAL_SUPPLY || "1000000000"
        ],
      });

      await run("verify", {
        address: await presale.getAddress(),
        constructorArguments: [
          await token.getAddress(),
          process.env.UNISWAP_ROUTER || "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          ethers.parseEther(process.env.SOFT_CAP || "100"),
          ethers.parseEther(process.env.HARD_CAP || "500"),
          ethers.parseEther(process.env.MIN_CONTRIBUTION || "0.1"),
          ethers.parseEther(process.env.MAX_CONTRIBUTION || "5"),
          process.env.PRESALE_PRICE || "1000000"
        ],
      });

      await run("verify", {
        address: await staking.getAddress(),
        constructorArguments: [
          await token.getAddress(),
          process.env.REWARD_RATE || "100",
          minStakingPeriod.toString()
        ],
      });
      
      console.log("Contracts verified successfully");
    } catch (error) {
      console.error("Error verifying contracts:", error);
    }
  }

  // Log deployment summary
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("Token:", await token.getAddress());
  console.log("Presale:", await presale.getAddress());
  console.log("Staking:", await staking.getAddress());
  console.log("Minimum Staking Period:", minStakingPeriod, "seconds");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
