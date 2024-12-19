import { ethers } from "hardhat";

async function main() {
  const Presale = await ethers.getContractFactory("Presale");
  const presale = Presale.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
  
  const presaleFinalized = await presale.presaleFinalized();
  const presalePrice = await presale.presalePrice();
  const hardCap = await presale.hardCap();
  const totalRaised = await presale.totalRaised();
  const minContribution = await presale.minContribution();
  const maxContribution = await presale.maxContribution();
  
  console.log("Presale Status:");
  console.log("- Finalized:", presaleFinalized);
  console.log("- Price:", presalePrice.toString());
  console.log("- Hard Cap:", hardCap.toString());
  console.log("- Total Raised:", totalRaised.toString());
  console.log("- Min Contribution:", minContribution.toString());
  console.log("- Max Contribution:", maxContribution.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
