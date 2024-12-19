// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Ownable {
    IERC20 public stakingToken;
    
    // Staking settings
    uint256 public rewardRate; // Rewards per second per token
    uint256 public minimumStakingPeriod; // Minimum time tokens must be staked
    uint256 public totalStaked;

    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 unclaimableRewards;
    }

    mapping(address => StakeInfo) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 reward);

    constructor(
        address _stakingToken,
        uint256 _rewardRate,
        uint256 _minimumStakingPeriod
    ) {
        require(_stakingToken != address(0), "Invalid token address");
        stakingToken = IERC20(_stakingToken);
        rewardRate = _rewardRate;
        minimumStakingPeriod = _minimumStakingPeriod;
    }

    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot stake 0");
        
        // Update rewards before modifying stake
        uint256 pendingReward = calculateRewards(msg.sender);
        stakes[msg.sender].unclaimableRewards += pendingReward;
        
        // Transfer tokens to contract
        require(stakingToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        // Update stake info
        if (stakes[msg.sender].amount == 0) {
            stakes[msg.sender].startTime = block.timestamp;
            stakes[msg.sender].lastClaimTime = block.timestamp;
        }
        
        stakes[msg.sender].amount += _amount;
        totalStaked += _amount;
        
        emit Staked(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0 && _amount <= stakes[msg.sender].amount, "Invalid amount");
        require(
            block.timestamp >= stakes[msg.sender].startTime + minimumStakingPeriod,
            "Minimum staking period not met"
        );
        
        // Update rewards before modifying stake
        uint256 pendingReward = calculateRewards(msg.sender);
        stakes[msg.sender].unclaimableRewards += pendingReward;
        
        // Update stake info
        stakes[msg.sender].amount -= _amount;
        totalStaked -= _amount;
        
        // Transfer tokens back to user
        require(stakingToken.transfer(msg.sender, _amount), "Transfer failed");
        
        emit Withdrawn(msg.sender, _amount);
    }

    function claimRewards() external nonReentrant {
        uint256 rewards = calculateRewards(msg.sender) + stakes[msg.sender].unclaimableRewards;
        require(rewards > 0, "No rewards to claim");
        
        stakes[msg.sender].lastClaimTime = block.timestamp;
        stakes[msg.sender].unclaimableRewards = 0;
        
        require(stakingToken.transfer(msg.sender, rewards), "Reward transfer failed");
        
        emit RewardsClaimed(msg.sender, rewards);
    }

    function calculateRewards(address _staker) public view returns (uint256) {
        if (stakes[_staker].amount == 0) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - stakes[_staker].lastClaimTime;
        return (stakes[_staker].amount * timeElapsed * rewardRate) / 1e18;
    }

    // Admin functions
    function updateRewardRate(uint256 _newRate) external onlyOwner {
        rewardRate = _newRate;
    }

    function updateMinimumStakingPeriod(uint256 _newPeriod) external onlyOwner {
        minimumStakingPeriod = _newPeriod;
    }

    // View functions
    function getStakeInfo(address _staker) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 pendingRewards
    ) {
        StakeInfo memory stake = stakes[_staker];
        return (
            stake.amount,
            stake.startTime,
            calculateRewards(_staker) + stake.unclaimableRewards
        );
    }
}
