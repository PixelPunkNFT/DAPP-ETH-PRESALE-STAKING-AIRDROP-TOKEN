// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract Presale is Ownable, ReentrancyGuard {
    IERC20 public token;
    IUniswapV2Router02 public uniswapRouter;
    
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public minContribution;
    uint256 public maxContribution;
    uint256 public presalePrice;
    uint256 public totalRaised;
    
    mapping(address => uint256) public contributions;
    bool public presaleFinalized;
    bool public liquidityAdded;

    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event PresaleFinalized(uint256 totalRaised);
    event LiquidityAdded(uint256 ethAmount, uint256 tokenAmount);

    constructor(
        address _token,
        address _uniswapRouter,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _presalePrice
    ) {
        require(_token != address(0), "Invalid token address");
        require(_uniswapRouter != address(0), "Invalid router address");
        require(_softCap < _hardCap, "SoftCap must be less than HardCap");
        require(_minContribution < _maxContribution, "Min must be less than Max");
        
        token = IERC20(_token);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        softCap = _softCap;
        hardCap = _hardCap;
        minContribution = _minContribution;
        maxContribution = _maxContribution;
        presalePrice = _presalePrice;
    }

    function participate() external payable nonReentrant {
        require(!presaleFinalized, "Presale finalized");
        require(msg.value >= minContribution, "Below min contribution");
        require(msg.value <= maxContribution, "Exceeds max contribution");
        require(contributions[msg.sender] + msg.value <= maxContribution, "Would exceed max contribution");
        require(totalRaised + msg.value <= hardCap, "Hard cap reached");

        uint256 tokenAmount = (msg.value * presalePrice) / 1 ether;
        require(token.balanceOf(address(this)) >= tokenAmount, "Insufficient tokens");

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        // Trasferisce immediatamente i token all'acquirente
        require(token.transfer(msg.sender, tokenAmount), "Token transfer failed");

        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    function finalize() external onlyOwner {
        require(!presaleFinalized, "Already finalized");
        require(totalRaised >= softCap, "Soft cap not reached");

        presaleFinalized = true;
        
        // Add liquidity to Uniswap
        uint256 tokensForLiquidity = token.balanceOf(address(this)) / 2;
        uint256 ethForLiquidity = address(this).balance / 2;

        token.approve(address(uniswapRouter), tokensForLiquidity);
        
        uniswapRouter.addLiquidityETH{value: ethForLiquidity}(
            address(token),
            tokensForLiquidity,
            0,
            0,
            owner(),
            block.timestamp + 300
        );

        liquidityAdded = true;
        
        // Transfer remaining tokens and ETH to owner
        if (token.balanceOf(address(this)) > 0) {
            token.transfer(owner(), token.balanceOf(address(this)));
        }
        if (address(this).balance > 0) {
            payable(owner()).transfer(address(this).balance);
        }

        emit PresaleFinalized(totalRaised);
        emit LiquidityAdded(ethForLiquidity, tokensForLiquidity);
    }

    function refund() external nonReentrant {
        require(presaleFinalized, "Presale not finalized");
        require(totalRaised < softCap, "Soft cap reached");
        require(contributions[msg.sender] > 0, "No contribution");

        uint256 refundAmount = contributions[msg.sender];
        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(refundAmount);
    }

    receive() external payable {}
}
