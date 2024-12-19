import { expect } from "chai";
import { ethers } from "hardhat";
import type { Token, Presale, Staking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Token Ecosystem", function () {
  let token: Token;
  let presale: Presale;
  let staking: Staking;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;
  let signers: SignerWithAddress[];
  let uniswapRouter: string;
  let startTime: number;

  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const INITIAL_SUPPLY = "1000000000";
  const SOFT_CAP = "100";
  const HARD_CAP = "500";
  const MIN_CONTRIBUTION = "0.1";
  const MAX_CONTRIBUTION = "5";
  const PRESALE_PRICE = "1000000";
  const REWARD_RATE = "100";
  const MIN_STAKING_PERIOD = "86400"; // 1 day
  const PRESALE_DURATION = "604800"; // 7 days

  beforeEach(async function () {
    signers = await ethers.getSigners();
    [owner, addr1, addr2, addr3] = signers;
    
    // Deploy mock Uniswap router
    const MockRouter = await ethers.getContractFactory("MockUniswapV2Router02");
    const mockRouter = await MockRouter.deploy();
    uniswapRouter = await mockRouter.getAddress();

    // Get current timestamp
    const latestBlock = await ethers.provider.getBlock('latest');
    startTime = latestBlock!.timestamp;

    // Deploy Token
    const TokenFactory = await ethers.getContractFactory("Token");
    token = await (await TokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY)).connect(owner) as Token;
    await token.waitForDeployment();

    // Deploy Presale
    const PresaleFactory = await ethers.getContractFactory("Presale");
    presale = await (await PresaleFactory.deploy(
      await token.getAddress(),
      uniswapRouter,
      ethers.parseEther(SOFT_CAP),
      ethers.parseEther(HARD_CAP),
      ethers.parseEther(MIN_CONTRIBUTION),
      ethers.parseEther(MAX_CONTRIBUTION),
      PRESALE_PRICE,
      startTime,
      PRESALE_DURATION
    )).connect(owner) as Presale;
    await presale.waitForDeployment();

    // Deploy Staking
    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await (await StakingFactory.deploy(
      await token.getAddress(),
      REWARD_RATE,
      MIN_STAKING_PERIOD
    )).connect(owner) as Staking;
    await staking.waitForDeployment();

    // Transfer tokens to contracts
    await token.transfer(await presale.getAddress(), ethers.parseEther(INITIAL_SUPPLY) / 2n);
    await token.transfer(await staking.getAddress(), ethers.parseEther(INITIAL_SUPPLY) / 4n);
  });

  describe("Token", function () {
    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should have correct total supply and distribution", async function () {
      const totalSupply = await token.totalSupply();
      const ownerBalance = await token.balanceOf(owner.address);
      const presaleBalance = await token.balanceOf(await presale.getAddress());
      const stakingBalance = await token.balanceOf(await staking.getAddress());

      expect(totalSupply).to.equal(ethers.parseEther(INITIAL_SUPPLY));
      expect(presaleBalance).to.equal(ethers.parseEther(INITIAL_SUPPLY) / 2n);
      expect(stakingBalance).to.equal(ethers.parseEther(INITIAL_SUPPLY) / 4n);
      expect(ownerBalance).to.equal(ethers.parseEther(INITIAL_SUPPLY) / 4n);
    });
  });

  describe("Presale", function () {
    it("Should allow contributions within limits", async function () {
      const contribution = ethers.parseEther("1");
      await presale.connect(addr1).participate({ value: contribution });
      
      const addr1Contribution = await presale.contributions(addr1.address);
      expect(addr1Contribution).to.equal(contribution);
    });

    it("Should not allow contributions below minimum", async function () {
      const lowContribution = ethers.parseEther("0.05");
      await expect(
        presale.connect(addr1).participate({ value: lowContribution })
      ).to.be.revertedWith("Below min contribution");
    });

    it("Should not allow contributions above maximum", async function () {
      const highContribution = ethers.parseEther("6");
      await expect(
        presale.connect(addr1).participate({ value: highContribution })
      ).to.be.revertedWith("Exceeds max contribution");
    });

    it("Should not allow multiple contributions exceeding maximum", async function () {
      const contribution1 = ethers.parseEther("3");
      const contribution2 = ethers.parseEther("3");
      
      await presale.connect(addr1).participate({ value: contribution1 });
      await expect(
        presale.connect(addr1).participate({ value: contribution2 })
      ).to.be.revertedWith("Would exceed max contribution");
    });

    it("Should finalize presale and add liquidity when soft cap is reached", async function () {
      // Meet soft cap with multiple contributions from different addresses
      const contribution = ethers.parseEther("5"); // Max contribution per address
      const numContributors = Math.ceil(Number(SOFT_CAP) / Number(MAX_CONTRIBUTION));
      
      for (let i = 0; i < numContributors && i < signers.length; i++) {
        await presale.connect(signers[i]).participate({ value: contribution });
      }
      
      // Advance time to end presale
      await time.increaseTo(startTime + Number(PRESALE_DURATION) + 1);
      
      // Finalize presale
      await presale.finalize();
      
      expect(await presale.presaleFinalized()).to.be.true;
      expect(await presale.liquidityAdded()).to.be.true;
    });

    it("Should allow refund if soft cap not reached", async function () {
      // Make contribution
      const contribution = ethers.parseEther("1");
      await presale.connect(addr1).participate({ value: contribution });
      
      // Advance time to end presale
      await time.increaseTo(startTime + Number(PRESALE_DURATION) + 1);
      
      // Get balances before refund
      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      
      // Request refund
      await presale.connect(addr1).refund();
      
      // Get balances after refund
      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      
      // Account for gas costs
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Staking", function () {
    it("Should allow staking tokens", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await token.transfer(addr1.address, stakeAmount);
      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      
      await staking.connect(addr1).stake(stakeAmount);
      const stakeInfo = await staking.getStakeInfo(addr1.address);
      expect(stakeInfo[0]).to.equal(stakeAmount);
    });

    it("Should handle multiple stakers correctly", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      // Setup stakers
      for (const staker of [addr1, addr2]) {
        await token.transfer(staker.address, stakeAmount);
        await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
        await staking.connect(staker).stake(stakeAmount);
      }
      
      // Advance time
      await time.increase(86400); // 1 day
      
      // Check rewards for both stakers
      for (const staker of [addr1, addr2]) {
        const rewards = await staking.calculateRewards(staker.address);
        expect(rewards).to.be.gt(0);
      }
    });

    it("Should not allow withdrawal before minimum staking period", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await token.transfer(addr1.address, stakeAmount);
      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
      
      await expect(
        staking.connect(addr1).withdraw(stakeAmount)
      ).to.be.revertedWith("Minimum staking period not met");
    });

    it("Should calculate and distribute rewards correctly", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await token.transfer(addr1.address, stakeAmount);
      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
      
      // Advance time
      await time.increase(86400); // 1 day
      
      const rewards = await staking.calculateRewards(addr1.address);
      expect(rewards).to.be.gt(0);
      
      const balanceBefore = await token.balanceOf(addr1.address);
      await staking.connect(addr1).claimRewards();
      const balanceAfter = await token.balanceOf(addr1.address);
      
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should allow withdrawal after minimum staking period", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await token.transfer(addr1.address, stakeAmount);
      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
      
      // Advance time past minimum staking period
      await time.increase(86401); // 1 day + 1 second
      
      await staking.connect(addr1).withdraw(stakeAmount);
      const stakeInfo = await staking.getStakeInfo(addr1.address);
      expect(stakeInfo[0]).to.equal(0);
    });

    it("Should handle partial withdrawals correctly", async function () {
      const stakeAmount = ethers.parseEther("1000");
      const withdrawAmount = ethers.parseEther("400");
      
      await token.transfer(addr1.address, stakeAmount);
      await token.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);
      
      // Advance time past minimum staking period
      await time.increase(86401);
      
      await staking.connect(addr1).withdraw(withdrawAmount);
      const stakeInfo = await staking.getStakeInfo(addr1.address);
      expect(stakeInfo[0]).to.equal(stakeAmount - withdrawAmount);
    });
  });
});
