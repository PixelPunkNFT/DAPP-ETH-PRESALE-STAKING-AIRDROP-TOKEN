import { ethers } from 'ethers';
import { contractAddresses } from './contracts';
import { StakingABI, TokenABI, PresaleABI } from './contractABIs';

let provider = null;

export const initializeProvider = () => {
    if (!window.ethereum) {
        throw new Error('MetaMask non trovato! Installa MetaMask per utilizzare questa dApp.');
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    return provider;
};

export const getProvider = () => {
    if (!provider) {
        return initializeProvider();
    }
    return provider;
};

export const connectWallet = async () => {
    try {
        const provider = getProvider();
        const accounts = await provider.send("eth_requestAccounts", []);
        
        // Verifica che siamo sulla rete corretta (BSC Testnet)
        const network = await provider.getNetwork();
        if (network.chainId !== 97) { // 97 è il chainId della BSC Testnet
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x61' }], // 0x61 è 97 in hex
                });
            } catch (switchError) {
                // Se la rete non è stata ancora aggiunta a MetaMask
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x61',
                            chainName: 'BSC Testnet',
                            nativeCurrency: {
                                name: 'tBNB',
                                symbol: 'tBNB',
                                decimals: 18
                            },
                            rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                            blockExplorerUrls: ['https://testnet.bscscan.com']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }
        
        return accounts[0];
    } catch (error) {
        console.error('Errore nella connessione al wallet:', error);
        throw error;
    }
};

export const getSigner = async () => {
    const provider = getProvider();
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
};

export const getTokenContract = async (withSigner = false) => {
    if (withSigner) {
        const signer = await getSigner();
        return new ethers.Contract(contractAddresses.token, TokenABI, signer);
    }
    const provider = getProvider();
    return new ethers.Contract(contractAddresses.token, TokenABI, provider);
};

export const getStakingContract = async (withSigner = false) => {
    if (withSigner) {
        const signer = await getSigner();
        return new ethers.Contract(contractAddresses.staking, StakingABI, signer);
    }
    const provider = getProvider();
    return new ethers.Contract(contractAddresses.staking, StakingABI, provider);
};

export const getPresaleContract = async (withSigner = false) => {
    if (withSigner) {
        const signer = await getSigner();
        return new ethers.Contract(contractAddresses.presale, PresaleABI, signer);
    }
    const provider = getProvider();
    return new ethers.Contract(contractAddresses.presale, PresaleABI, provider);
};

export const getTokenBalance = async (address) => {
    const contract = await getTokenContract();
    const balance = await contract.balanceOf(address);
    return ethers.utils.formatEther(balance);
};

export const getStakedBalance = async (address) => {
    const contract = await getStakingContract();
    const stakeInfo = await contract.getStakeInfo(address);
    const minimumStakingPeriod = await contract.minimumStakingPeriod();
    return {
        amount: ethers.utils.formatEther(stakeInfo.amount),
        startTime: stakeInfo.startTime.toString(),
        pendingRewards: ethers.utils.formatEther(stakeInfo.pendingRewards),
        minimumStakingPeriod: minimumStakingPeriod.toString()
    };
};

export const getPresaleStatus = async () => {
    try {
        const contract = await getPresaleContract();
        const signer = await getSigner();
        const userAddress = await signer.getAddress();

        const [
            softCap,
            hardCap,
            totalRaised,
            minContribution,
            maxContribution,
            presaleFinalized,
            liquidityAdded,
            rate,
            userContribution
        ] = await Promise.all([
            contract.softCap(),
            contract.hardCap(),
            contract.totalRaised(),
            contract.minContribution(),
            contract.maxContribution(),
            contract.presaleFinalized(),
            contract.liquidityAdded(),
            contract.presalePrice(),
            contract.contributions(userAddress)
        ]);

        const isActive = !presaleFinalized && !liquidityAdded;
        let statusMessage = '';

        if (presaleFinalized && liquidityAdded) {
            statusMessage = 'Presale completata e liquidità aggiunta';
        } else if (presaleFinalized) {
            statusMessage = 'Presale completata, in attesa di aggiungere liquidità';
        } else {
            statusMessage = 'Presale attiva';
        }

        return {
            isActive,
            statusMessage,
            softCap,
            hardCap,
            totalSold: totalRaised,
            minContribution,
            maxContribution,
            rate,
            userContribution
        };
    } catch (error) {
        console.error('Errore nel recupero dello stato della presale:', error);
        throw error;
    }
};

export const participate = async (amount) => {
    try {
        const contract = await getPresaleContract(true);
        const tx = await contract.participate({
            value: ethers.utils.parseEther(amount)
        });
        await tx.wait();
        return true;
    } catch (error) {
        console.error('Errore nella partecipazione alla presale:', error);
        throw error;
    }
};

export const verifyPresaleContract = async () => {
    try {
        const contract = await getPresaleContract();
        const [
            tokenAddress,
            routerAddress,
            softCap,
            hardCap,
            minContribution,
            maxContribution,
            presalePrice,
            totalRaised,
            presaleFinalized,
            liquidityAdded
        ] = await Promise.all([
            contract.token(),
            contract.uniswapRouter(),
            contract.softCap(),
            contract.hardCap(),
            contract.minContribution(),
            contract.maxContribution(),
            contract.presalePrice(),
            contract.totalRaised(),
            contract.presaleFinalized(),
            contract.liquidityAdded()
        ]);

        return {
            tokenAddress,
            routerAddress,
            softCap: ethers.utils.formatEther(softCap),
            hardCap: ethers.utils.formatEther(hardCap),
            minContribution: ethers.utils.formatEther(minContribution),
            maxContribution: ethers.utils.formatEther(maxContribution),
            presalePrice: ethers.utils.formatEther(presalePrice),
            totalRaised: ethers.utils.formatEther(totalRaised),
            presaleFinalized,
            liquidityAdded
        };
    } catch (error) {
        console.error('Errore nella verifica del contratto:', error);
        throw error;
    }
};

export const stake = async (amount) => {
    try {
        const stakingContract = await getStakingContract(true);
        const parsedAmount = ethers.utils.parseEther(amount.toString());
        const tx = await stakingContract.stake(parsedAmount);
        await tx.wait();
        return true;
    } catch (error) {
        console.error('Errore durante lo staking:', error);
        throw error;
    }
};

export const unstake = async (amount) => {
    try {
        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Importo non valido');
        }
        
        const stakingContract = await getStakingContract(true);
        console.log('Tentativo di withdraw di:', amount, 'tokens');
        const parsedAmount = ethers.utils.parseEther(amount.toString());
        console.log('Importo convertito in wei:', parsedAmount.toString());
        const tx = await stakingContract.withdraw(parsedAmount);
        console.log('Transazione di withdraw inviata:', tx.hash);
        await tx.wait();
        console.log('Withdraw completato');
        return true;
    } catch (error) {
        console.error('Errore durante il withdraw:', error);
        throw error;
    }
};
