import { useState, useEffect } from 'react';
import { getPresaleStatus, participate, getTokenBalance, initializeProvider, verifyPresaleContract, getPresaleContract } from '../utils/web3';
import { ethers } from 'ethers';

export default function Home({ walletAddress }) {
  const [contribution, setContribution] = useState('');
  const [presaleData, setPresaleData] = useState({
    isActive: false,
    statusMessage: '',
    rate: '0',
    hardCap: '0',
    totalSold: '0',
    minContribution: '0',
    maxContribution: '0',
    userContribution: '0'
  });
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);
  const [estimatedGas, setEstimatedGas] = useState(null);

  useEffect(() => {
    if (walletAddress) {
      initializeProvider();
      loadPresaleData();
      const interval = setInterval(loadPresaleData, 10000); // Aggiorna ogni 10 secondi
      return () => clearInterval(interval);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      loadTokenBalance();
    }
  }, [walletAddress]);

  const loadPresaleData = async () => {
    if (!walletAddress) return;
    
    try {
      const data = await getPresaleStatus();
      setPresaleData(data);
      setError(''); // Pulisci eventuali errori precedenti
    } catch (error) {
      console.error('Errore nel caricamento dei dati della presale:', error);
      setError(error.message || 'Errore nel caricamento dei dati della presale');
      // Reset dei dati in caso di errore
      setPresaleData(prev => ({
        ...prev,
        isActive: false,
        statusMessage: 'Errore nel caricamento dei dati'
      }));
    }
  };

  const loadTokenBalance = async () => {
    if (!walletAddress) return;

    try {
      const balance = await getTokenBalance(walletAddress);
      setTokenBalance(balance);
    } catch (error) {
      console.error('Errore nel caricamento del balance:', error);
      setTokenBalance('0');
    }
  };

  const handleContributionChange = async (e) => {
    const value = e.target.value;
    setError('');
    setEstimatedGas(null);
    
    // Permette solo numeri positivi con massimo 18 decimali
    if (value === '' || /^\d*\.?\d{0,18}$/.test(value)) {
      setContribution(value);
      await validateContribution(value);
    }
  };

  const validateContribution = async (value) => {
    if (!value) return;
    
    try {
      const amount = parseFloat(value);
      const minContrib = ethers.utils.formatEther(presaleData.minContribution);
      const maxContrib = ethers.utils.formatEther(presaleData.maxContribution);
      const userContrib = ethers.utils.formatEther(presaleData.userContribution);
      const remainingContrib = parseFloat(maxContrib) - parseFloat(userContrib);

      if (amount < parseFloat(minContrib)) {
        setError(`Il contributo minimo è ${minContrib} ETH`);
        return false;
      } else if (amount > parseFloat(maxContrib)) {
        setError(`Il contributo massimo è ${maxContrib} ETH`);
        return false;
      } else if (amount > remainingContrib) {
        setError(`Puoi contribuire ancora massimo ${remainingContrib.toFixed(18)} ETH`);
        return false;
      }

      // Verifica il saldo ETH e stima il gas
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balance = await provider.getBalance(walletAddress);
      const amountWei = ethers.utils.parseEther(value);
      
      // Stima il gas necessario
      try {
        const contract = await getPresaleContract(true);
        const gasEstimate = await contract.estimateGas.participate({ value: amountWei });
        const gasPrice = await provider.getGasPrice();
        const estimatedGasCost = gasEstimate.mul(gasPrice);
        const totalCost = amountWei.add(estimatedGasCost);
        
        setEstimatedGas({
          gas: gasEstimate.toString(),
          gasCost: ethers.utils.formatEther(estimatedGasCost),
          total: ethers.utils.formatEther(totalCost)
        });

        if (balance.lt(totalCost)) {
          setError(`Saldo ETH insufficiente. Necessario: ${ethers.utils.formatEther(totalCost)} ETH (incluso gas stimato: ${ethers.utils.formatEther(estimatedGasCost)} ETH)`);
          return false;
        }
      } catch (error) {
        console.error('Errore nella stima del gas:', error);
        if (error.message.includes('gas required exceeds')) {
          setError('La transazione richiederebbe troppo gas. Prova con un importo minore.');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Errore nella validazione:', error);
      setError('Errore nella validazione del contributo');
      return false;
    }
  };

  const handleVerifyContract = async () => {
    try {
      setLoading(true);
      const info = await verifyPresaleContract();
      setDebugInfo(info);
      setError('');
    } catch (error) {
      console.error('Errore nella verifica del contratto:', error);
      setError(error.message || 'Errore nella verifica del contratto');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async () => {
    if (!walletAddress) {
      setError('Per favore connetti il tuo wallet prima di contribuire');
      return;
    }

    if (!contribution || parseFloat(contribution) <= 0) {
      setError('Inserisci un importo valido');
      return;
    }

    // Validazione finale prima della transazione
    const isValid = await validateContribution(contribution);
    if (!isValid) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Ricarica i dati della presale prima di procedere
      await loadPresaleData();
      
      // Verifica che la presale sia ancora attiva
      if (!presaleData.isActive) {
        throw new Error(presaleData.statusMessage || 'La presale non è attiva');
      }

      await participate(contribution);
      await loadPresaleData();
      await loadTokenBalance();
      setContribution('');
      setEstimatedGas(null);
      alert('Acquisto completato con successo!');
    } catch (error) {
      console.error('Errore nell\'acquisto dei token:', error);
      // Gestione specifica degli errori più comuni
      if (error.message.includes('user rejected')) {
        setError('Transazione rifiutata dall\'utente');
      } else if (error.message.includes('insufficient funds')) {
        setError('Saldo ETH insufficiente per completare la transazione');
      } else if (error.message.includes('gas required exceeds')) {
        setError('Gas richiesto troppo alto. Riprova con un importo minore');
      } else if (error.message.includes('Internal JSON-RPC error')) {
        setError('Errore nella transazione. Verifica di avere abbastanza ETH per il gas e riprova');
      } else {
        setError(error.message || 'Errore durante l\'acquisto dei token');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateTokens = () => {
    if (!contribution || !presaleData.rate) return '0';
    try {
      // Calcolo: amount * presalePrice / 1 ether
      const amount = ethers.utils.parseEther(contribution || '0');
      const tokens = amount.mul(presaleData.rate).div(ethers.constants.WeiPerEther);
      return ethers.utils.formatEther(tokens);
    } catch (error) {
      console.error('Errore nel calcolo dei token:', error);
      return '0';
    }
  };

  // Calcola il progresso in ETH invece che in token
  const calculateProgress = () => {
    if (presaleData.hardCap === '0') return 0;
    
    try {
      const totalSoldBN = ethers.BigNumber.from(presaleData.totalSold);
      const hardCapBN = ethers.BigNumber.from(presaleData.hardCap);
      
      // Moltiplica per 10000 per ottenere 2 decimali di precisione
      const progressBN = totalSoldBN.mul(10000).div(hardCapBN);
      return progressBN.toNumber() / 100;
    } catch (error) {
      console.error('Errore nel calcolo del progresso:', error);
      return 0;
    }
  };

  const progress = calculateProgress();

  // Calcola i token venduti moltiplicando gli ETH raccolti per il rate
  const tokensSold = presaleData.totalSold !== '0' && presaleData.rate !== '0'
    ? ethers.utils.formatEther(
        ethers.BigNumber.from(presaleData.totalSold)
          .mul(presaleData.rate)
          .div(ethers.constants.WeiPerEther)
      )
    : '0';

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Benvenuto nella Presale di SOP Token</h1>
          <p className="text-xl text-gray-600">Per favore connetti il tuo wallet per partecipare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-5xl font-extrabold sm:text-6xl md:text-7xl">
            <span className="block text-gray-900 mb-2">Welcome to</span>
            <span className="hero-title">SOP Token Presale</span>
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-lg text-gray-600 sm:text-xl md:text-2xl leading-relaxed">
            Join our presale event and be among the first to own SOP tokens. 
            Participate in the future of decentralized finance.
          </p>
        </div>

        {/* Debug Button */}
        <div className="text-center mb-8">
          <button
            onClick={handleVerifyContract}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            disabled={loading}
          >
            {loading ? 'Verifica in corso...' : 'Verifica Stato Contratto'}
          </button>
        </div>

        {/* Debug Info */}
        {debugInfo && (
          <div className="mb-8 p-4 bg-gray-100 rounded-lg overflow-x-auto">
            <h3 className="text-lg font-semibold mb-2">Informazioni di Debug:</h3>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        {/* Status Message */}
        {presaleData.statusMessage && (
          <div className={`text-center mb-8 p-4 rounded-lg ${
            presaleData.isActive ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {presaleData.statusMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-center mb-8 p-4 bg-red-100 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Gas Estimate Info */}
        {estimatedGas && !error && (
          <div className="text-center mb-8 p-4 bg-blue-50 text-blue-800 rounded-lg">
            <p>Gas stimato: {estimatedGas.gas}</p>
            <p>Costo gas stimato: {estimatedGas.gasCost} ETH</p>
            <p>Costo totale stimato: {estimatedGas.total} ETH</p>
          </div>
        )}

        {/* Presale Stats */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Il Tuo Balance</h3>
            <p className="stat-value mt-3">{tokenBalance} SOP</p>
          </div>
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Prezzo Token</h3>
            <p className="stat-value mt-3">{ethers.utils.formatEther(presaleData.rate || '0')} SOP per ETH</p>
          </div>
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Token Venduti</h3>
            <p className="stat-value mt-3">{tokensSold} SOP</p>
          </div>
          <div className="stat-card">
            <h3 className="text-lg font-medium text-gray-600">Il Tuo Contributo</h3>
            <p className="stat-value mt-3">{ethers.utils.formatEther(presaleData.userContribution)} ETH</p>
          </div>
        </div>

        {/* Contribution Section */}
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Partecipa alla Presale</h2>
            <div className="space-y-8">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Il Tuo Contributo (Min: {ethers.utils.formatEther(presaleData.minContribution || '0')} ETH, Max: {ethers.utils.formatEther(presaleData.maxContribution || '0')} ETH)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={contribution}
                    onChange={handleContributionChange}
                    className="input pr-16 text-lg"
                    placeholder="0.0"
                    disabled={!presaleData.isActive || loading}
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg">ETH</span>
                  </div>
                </div>
                <p className="mt-3 text-lg text-gray-500">
                  Riceverai: {calculateTokens()} SOP Tokens
                </p>
              </div>
              <button 
                className={`btn-primary w-full text-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleContribute}
                disabled={!presaleData.isActive || loading || !walletAddress || !!error}
              >
                {loading ? 'Elaborazione...' : 'Contribuisci alla Presale'}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-12">
              <div className="flex justify-between text-lg font-medium text-gray-700 mb-3">
                <span>Progresso</span>
                <span>{progress.toFixed(2)}%</span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(progress, 0.5)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-lg text-gray-500 mt-3">
                <span>{ethers.utils.formatEther(presaleData.totalSold)} ETH</span>
                <span>{ethers.utils.formatEther(presaleData.hardCap || '0')} ETH</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
