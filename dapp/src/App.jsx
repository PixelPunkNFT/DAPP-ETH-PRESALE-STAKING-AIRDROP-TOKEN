import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { connectWallet } from './utils/web3';
import Home from './pages/Home';
import Staking from './pages/Staking';

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
        isActive
          ? 'text-blue-600 hover:text-blue-700'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </Link>
  );
}

function Navigation() {
  return (
    <nav className="hidden md:flex space-x-8">
      <NavLink to="/">Home</NavLink>
      <NavLink to="/staking">Staking</NavLink>
    </nav>
  );
}

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState('');
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(true);

  useEffect(() => {
    // Verifica se MetaMask è installato
    if (!window.ethereum) {
      setIsMetaMaskInstalled(false);
    }
  }, []);

  const handleConnect = async () => {
    try {
      setError('');
      if (!window.ethereum) {
        setError('MetaMask non trovato! Installa MetaMask per utilizzare questa dApp.');
        setIsMetaMaskInstalled(false);
        return;
      }
      const address = await connectWallet();
      setWalletAddress(address);
    } catch (err) {
      console.error('Errore nella connessione al wallet:', err);
      if (err.code === 4902) {
        setError('Per favore aggiungi la rete Hardhat a MetaMask');
      } else if (err.code === -32002) {
        setError('Richiesta di connessione già in corso. Controlla MetaMask');
      } else {
        setError(err.message);
      }
    }
  };

  const renderMetaMaskMessage = () => {
    if (!isMetaMaskInstalled) {
      return (
        <div className="fixed top-0 left-0 right-0 bg-red-100 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <span className="text-red-700">
                MetaMask non trovato! 
                <a 
                  href="https://metamask.io/download.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-red-800 underline hover:text-red-900"
                >
                  Clicca qui per installare MetaMask
                </a>
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {renderMetaMaskMessage()}
        
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex-shrink-0">
                <Link to="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors duration-200">
                  SOP DApp
                </Link>
              </div>
              <div className="flex items-center">
                <Navigation />
                <button
                  onClick={handleConnect}
                  className={`ml-8 px-4 py-2 rounded-md text-white transition-colors duration-200 ${
                    !isMetaMaskInstalled 
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={!isMetaMaskInstalled}
                >
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect Wallet'}
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 text-sm">
              {error}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home walletAddress={walletAddress} />} />
            <Route path="/staking" element={<Staking walletAddress={walletAddress} />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="text-center text-gray-500 text-sm">
              © 2024 SOP Token. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
