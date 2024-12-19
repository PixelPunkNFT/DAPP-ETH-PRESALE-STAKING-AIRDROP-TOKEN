import { ethers } from "hardhat";

async function main() {
  const Token = await ethers.getContractFactory("Token");
  const token = Token.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");
  
  const presaleAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const presaleBalance = await token.balanceOf(presaleAddress);
  
  console.log("Presale contract token balance:", presaleBalance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
