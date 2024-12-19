import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getTokenBalance, getStakingContract, getTokenContract, stake, unstake, getStakedBalance } from '../utils/web3';

export default function Staking({ walletAddress }) {
  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [stakeStartTime, setStakeStartTime] = useState('0');
  const [minimumStakingPeriod, setMinimumStakingPeriod] = useState('0');
  const [canWithdraw, setCanWithdraw] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      loadBalances();
      const interval = setInterval(loadBalances, 10000); // Aggiorna ogni 10 secondi
      return () => clearInterval(interval);
    }
  }, [walletAddress]);

  const loadBalances = async () => {
    try {
      const balance = await getTokenBalance(walletAddress);
      const stakeInfo = await getStakedBalance(walletAddress);
      
      setTokenBalance(balance);
      setStakedBalance(stakeInfo.amount);
      setRewards(stakeInfo.pendingRewards);
      setStakeStartTime(stakeInfo.startTime);
      setMinimumStakingPeriod(stakeInfo.minimumStakingPeriod);

      // Verifica se è possibile fare withdraw
      const startTimeMs = parseInt(stakeInfo.startTime) * 1000;
      const minimumPeriodMs = parseInt(stakeInfo.minimumStakingPeriod) * 1000;
      const now = Date.now();
      setCanWithdraw(now >= startTimeMs + minimumPeriodMs);

      console.log('Stake Info:', {
        tokenBalance: balance,
        stakedAmount: stakeInfo.amount,
        pendingRewards: stakeInfo.pendingRewards,
        startTime: new Date(stakeInfo.startTime * 1000).toLocaleString(),
        minimumStakingPeriod: stakeInfo.minimumStakingPeriod
      });
    } catch (error) {
      console.error('Errore nel caricamento dei bilanci:', error);
    }
  };

  const handleStake = async () => {
    if (!walletAddress) {
      alert('Per favore connetti il tuo wallet prima di fare staking');
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      alert('Inserisci un importo valido');
      return;
    }

    try {
      setLoading(true);
      // Prima approviamo il contratto di staking a spendere i token
      const tokenContract = await getTokenContract(true);
      const stakingContract = await getStakingContract();
      console.log('Approvazione token per:', stakingContract.address);
      
      const approvalTx = await tokenContract.approve(
        stakingContract.address,
        ethers.utils.parseEther(stakeAmount)
      );
      console.log('Transazione di approvazione inviata:', approvalTx.hash);
      await approvalTx.wait();
      console.log('Approvazione completata');

      // Poi facciamo lo stake
      console.log('Iniziando lo stake di:', stakeAmount, 'token');
      await stake(stakeAmount);
      console.log('Stake completato');
      
      await loadBalances();
      setStakeAmount('');
      alert('Staking completato con successo!');
    } catch (error) {
      console.error('Errore nello staking:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!walletAddress) {
      alert('Per favore connetti il tuo wallet prima di ritirare');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Inserisci un importo valido');
      return;
    }

    if (parseFloat(withdrawAmount) > parseFloat(stakedBalance)) {
      alert('Non puoi ritirare più token di quanti ne hai in staking');
      return;
    }

    if (!canWithdraw) {
      alert('Non è ancora possibile ritirare i token. Il periodo minimo di staking non è stato raggiunto.');
      return;
    }

    try {
      setLoading(true);
      console.log('Tentativo di withdraw di:', withdrawAmount, 'tokens');
      await unstake(withdrawAmount);
      await loadBalances();
      setWithdrawAmount('');
      alert('Ritiro completato con successo!');
    } catch (error) {
      console.error('Errore nel ritiro:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!walletAddress) {
      alert('Per favore connetti il tuo wallet prima di reclamare le ricompense');
      return;
    }

    try {
      setLoading(true);
      const stakingContract = await getStakingContract(true);
      const tx = await stakingContract.claimRewards();
      await tx.wait();
      await loadBalances();
      alert('Ricompense reclamate con successo!');
    } catch (error) {
      console.error('Errore nel reclamo delle ricompense:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedRewards = (amount) => {
    if (!amount) return { daily: 0, monthly: 0, yearly: 0 };
    const apr = 0.2; // 20% APR
    const amountNum = parseFloat(amount);
    const yearly = amountNum * apr;
    const monthly = yearly / 12;
    const daily = yearly / 365;
    return { daily, monthly, yearly };
  };

  const estimatedRewards = calculateEstimatedRewards(stakeAmount);

  const getStakingDuration = () => {
    if (stakeStartTime === '0') return 'Non ancora in staking';
    const start = parseInt(stakeStartTime) * 1000; // Converti in millisecondi
    const now = Date.now();
    const diff = now - start;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const getMinimumStakingPeriodText = () => {
    const seconds = parseInt(minimumStakingPeriod);
    if (seconds < 60) return `${seconds} secondi`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minuti`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ore`;
    const days = Math.floor(hours / 24);
    return `${days} giorni`;
  };

  const getRemainingLockTime = () => {
    if (stakeStartTime === '0') return 'Non ancora in staking';
    const start = parseInt(stakeStartTime) * 1000;
    const minimumPeriodMs = parseInt(minimumStakingPeriod) * 1000;
    const unlockTime = start + minimumPeriodMs;
    const now = Date.now();
    
    if (now >= unlockTime) {
      return 'Periodo di lock completato';
    }

    const remaining = unlockTime - now;
    const seconds = Math.floor(remaining / 1000);
    if (seconds < 60) return `${seconds} secondi rimanenti`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minuti rimanenti`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ore rimanenti`;
    const days = Math.floor(hours / 24);
    return `${days} giorni rimanenti`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-20">
          <h1 className="text-5xl font-extrabold sm:text-6xl md:text-7xl">
            <span className="hero-title">SOP Token Staking</span>
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-lg text-gray-600 sm:text-xl md:text-2xl leading-relaxed">
            Stake your SOP tokens and earn rewards. The longer you stake, the more you earn.
          </p>
        </div>

        {/* Staking Stats */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Token Balance</h3>
            <p className="stat-value mt-3">{tokenBalance} SOP</p>
          </div>
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Your Stake</h3>
            <p className="stat-value mt-3">{stakedBalance} SOP</p>
          </div>
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">APR</h3>
            <p className="stat-value mt-3">20%</p>
          </div>
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Your Rewards</h3>
            <p className="stat-value mt-3">{rewards} SOP</p>
          </div>
        </div>

        {/* Staking Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Stake Section */}
          <div className="card">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Stake Tokens</h2>
            <div className="space-y-8">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">Amount to Stake</label>
                <div className="relative rounded-xl shadow-sm">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="input pr-16"
                    placeholder="0.0"
                    disabled={loading || !walletAddress}
                    min="0"
                    step="0.000000000000000001"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg">SOP</span>
                  </div>
                </div>
                <p className="mt-3 text-lg text-gray-500">
                  Balance: {tokenBalance} SOP
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Periodo minimo di staking: {getMinimumStakingPeriodText()}
                </p>
              </div>
              <button 
                className="btn-primary w-full text-lg"
                onClick={handleStake}
                disabled={loading || !walletAddress}
              >
                {loading ? 'Elaborazione...' : 'Stake Tokens'}
              </button>
            </div>

            {/* Estimated Rewards */}
            <div className="mt-8 p-6 bg-blue-50/50 backdrop-blur-sm rounded-xl border border-blue-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Estimated Rewards</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">Daily</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {estimatedRewards.daily.toFixed(6)} SOP
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-2">Monthly</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {estimatedRewards.monthly.toFixed(6)} SOP
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-2">Yearly</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {estimatedRewards.yearly.toFixed(6)} SOP
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Withdraw Section */}
          <div className="card">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Withdraw Tokens</h2>
            <div className="space-y-8">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">Amount to Withdraw</label>
                <div className="relative rounded-xl shadow-sm">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="input pr-16"
                    placeholder="0.0"
                    disabled={loading || !walletAddress || !canWithdraw}
                    min="0"
                    max={stakedBalance}
                    step="0.000000000000000001"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg">SOP</span>
                  </div>
                </div>
                <p className="mt-3 text-lg text-gray-500">
                  Staked: {stakedBalance} SOP
                </p>
                <p className={`mt-2 text-sm ${canWithdraw ? 'text-green-600' : 'text-red-600'}`}>
                  {getRemainingLockTime()}
                </p>
              </div>
              <button 
                className="btn-primary w-full text-lg"
                onClick={handleUnstake}
                disabled={loading || !walletAddress || !canWithdraw}
              >
                {loading ? 'Elaborazione...' : 'Withdraw Tokens'}
              </button>
              <button 
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 
                          text-white rounded-xl font-semibold shadow-lg hover:shadow-xl 
                          hover:scale-105 hover:from-emerald-700 hover:to-green-700 
                          transform transition-all duration-200 ease-in-out text-lg"
                onClick={handleClaimRewards}
                disabled={loading || !walletAddress}
              >
                {loading ? 'Elaborazione...' : 'Claim Rewards'}
              </button>
            </div>

            {/* Staking Info */}
            <div className="mt-8 p-6 bg-blue-50/50 backdrop-blur-sm rounded-xl border border-blue-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Staking Info</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">Total Staked</p>
                  <p className="text-lg font-semibold text-blue-600">{stakedBalance} SOP</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">Pending Rewards</p>
                  <p className="text-lg font-semibold text-blue-600">{rewards} SOP</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">Staking Duration</p>
                  <p className="text-lg font-semibold text-blue-600">{getStakingDuration()}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">APR</p>
                  <p className="text-lg font-semibold text-blue-600">20%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
