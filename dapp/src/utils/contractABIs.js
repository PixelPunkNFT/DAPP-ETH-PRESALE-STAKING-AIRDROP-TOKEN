export const TokenABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export const StakingABI = [
  "function stake(uint256 _amount) external",
  "function withdraw(uint256 _amount) external",
  "function claimRewards() external",
  "function calculateRewards(address _staker) public view returns (uint256)",
  "function getStakeInfo(address _staker) external view returns (uint256 amount, uint256 startTime, uint256 pendingRewards)",
  "function stakingToken() external view returns (address)",
  "function rewardRate() external view returns (uint256)",
  "function minimumStakingPeriod() external view returns (uint256)",
  "function totalStaked() external view returns (uint256)",
  "event Staked(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)",
  "event RewardsClaimed(address indexed user, uint256 reward)"
];

export const PresaleABI = [
  "function token() view returns (address)",
  "function uniswapRouter() view returns (address)",
  "function softCap() view returns (uint256)",
  "function hardCap() view returns (uint256)",
  "function minContribution() view returns (uint256)",
  "function maxContribution() view returns (uint256)",
  "function presalePrice() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function contributions(address) view returns (uint256)",
  "function presaleFinalized() view returns (bool)",
  "function liquidityAdded() view returns (bool)",
  "function participate() external payable",
  "function finalize() external",
  "function refund() external",
  "event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount)",
  "event PresaleFinalized(uint256 totalRaised)",
  "event LiquidityAdded(uint256 ethAmount, uint256 tokenAmount)"
];
