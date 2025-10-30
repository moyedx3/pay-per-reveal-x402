import React, { useState, useEffect } from 'react';
import { WalletConnect } from './components/WalletConnect';
import { useWallet } from './contexts/WalletContext';
import { api, updateApiClient, type Article, type ArticleWord } from './services/api';
import './App.css';

function App() {
  const { walletClient } = useWallet();
  const [article, setArticle] = useState<Article | null>(null);
  const [revealingWordId, setRevealingWordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  useEffect(() => {
    updateApiClient(walletClient);
    if (article) {
      loadArticle();
    }
  }, [walletClient]);

  useEffect(() => {
    loadArticle();
  }, []);

  const loadArticle = async () => {
    try {
      const articleData = await api.getArticle();
      setArticle(articleData);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load article:', error);
    }
  };

  const handleWordClick = async (word: ArticleWord) => {
    if (!word.isBlurred || word.isRevealed) return;

    if (!walletClient || !walletClient.account) {
      setError('Connect wallet to reveal');
      setTimeout(() => setError(null), 2000);
      return;
    }

    setRevealingWordId(word.id);
    setError(null);

    try {
      await api.revealWord(word.id);
      await loadArticle();
    } catch (error: any) {
      setError('Payment failed');
      setTimeout(() => setError(null), 2000);
    } finally {
      setRevealingWordId(null);
    }
  };

  const blurredCount = article ? article.content.filter(w => w.isBlurred && !w.isRevealed).length : 0;

  return (
    <div className="app">
      {/* Help button and wallet - top right */}
      <div className="top-right-controls">
        <button 
          className="help-button"
          onClick={() => setShowHelp(!showHelp)}
          aria-label="Help"
        >
          ?
        </button>
        
        <div className="wallet-button">
          <WalletConnect />
          {article && (
            <div className="wallet-info-panel">
              <div className="info-item">{blurredCount} blurred</div>
              <div className="info-item">{article.pricePerWord} each</div>
            </div>
          )}
        </div>
      </div>

      {/* Help popup */}
      {showHelp && (
        <div className="help-popup">
          <div className="help-content">
            <button className="help-close" onClick={() => setShowHelp(false)}>×</button>
            
            <h3>How it works</h3>
            <ol>
              <li>Connect your wallet (top right)</li>
              <li>Click any blurred word to reveal it</li>
              <li>Pay the small fee to unlock the word</li>
            </ol>
            <p className="help-note">Each payment reveals all instances of that word.</p>
            
            <div className="help-divider"></div>
            
            <h3>The tech</h3>
            <p className="help-tech">
              Powered by <strong>x402</strong>, a micropayment protocol for instant, 
              fee-free transactions on <strong>Base Sepolia</strong> testnet.
            </p>
          </div>
        </div>
      )}

      {/* Error toast - minimal */}
      {error && <div className="toast">{error}</div>}

      {/* Article - center stage */}
      {article && (
        <article className="article">
          <h1 className="article-title">{article.title}</h1>
          <div className="article-content">
            {article.content.map((word, index) => {
              const isBlurredAndHidden = word.isBlurred && !word.isRevealed;
              const isRevealing = revealingWordId === word.id;
              
              return (
                <span
                  key={word.id}
                  className={`word ${isBlurredAndHidden ? 'blurred' : ''} ${isRevealing ? 'revealing' : ''} ${word.isRevealed ? 'revealed' : ''}`}
                  onClick={() => handleWordClick(word)}
                  title={isBlurredAndHidden ? `${article.pricePerWord}` : ''}
                >
                  {word.text}
                  {index < article.content.length - 1 && ' '}
                </span>
              );
            })}
          </div>
        </article>
      )}
    </div>
  );
}

export default App;
