// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Router02 {
    event LiquidityAdded(
        address token,
        uint256 tokenAmount,
        uint256 ethAmount,
        address to
    );

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint,     // amountTokenMin
        uint,     // amountETHMin
        address to,
        uint      // deadline
    )
        external
        payable
        returns (
            uint amountToken,
            uint amountETH,
            uint liquidity
        )
    {
        // Transfer tokens from sender to this contract
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        
        emit LiquidityAdded(token, amountTokenDesired, msg.value, to);
        
        // Mock implementation that just returns the input amounts
        return (amountTokenDesired, msg.value, amountTokenDesired);
    }

    function WETH() external pure returns (address) {
        return address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    function factory() external pure returns (address) {
        return address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    }

    // Function to receive ETH
    receive() external payable {}
}
