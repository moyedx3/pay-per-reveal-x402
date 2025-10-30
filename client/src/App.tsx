import React, { useState, useEffect } from 'react';
import { WalletConnect } from './components/WalletConnect';
import { useWallet } from './contexts/WalletContext';
import { api, updateApiClient, type Article, type ArticleWord } from './services/api';
import './App.css';

function App() {
  const { walletClient } = useWallet();
  const [serverStatus, setServerStatus] = useState<string>('checking...');
  const [article, setArticle] = useState<Article | null>(null);
  const [revealingWordId, setRevealingWordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update API client when wallet changes
  useEffect(() => {
    updateApiClient(walletClient);
    // Reload article when wallet changes to get user-specific revealed words
    if (article) {
      loadArticle();
    }
  }, [walletClient]);

  // Check server health and load article on mount
  useEffect(() => {
    checkServerHealth();
    loadArticle();
  }, []);

  const checkServerHealth = async () => {
    try {
      const health = await api.getHealth();
      setServerStatus(`✅ Connected to ${health.config.network}`);
    } catch (error) {
      setServerStatus('❌ Server offline');
    }
  };

  const loadArticle = async () => {
    try {
      const articleData = await api.getArticle();
      setArticle(articleData);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load article:', error);
      setError('Failed to load article. Please refresh the page.');
    }
  };

  const handleWordClick = async (word: ArticleWord) => {
    // Only allow clicking on blurred, unrevealed words
    if (!word.isBlurred || word.isRevealed) {
      return;
    }

    // Check if wallet is connected
    if (!walletClient || !walletClient.account) {
      setError('Please connect your wallet first to reveal words.');
      return;
    }

    setRevealingWordId(word.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await api.revealWord(word.id);
      
      // Update the article with the revealed word
      if (article) {
        const updatedContent = article.content.map(w => 
          w.id === word.id 
            ? { ...w, text: result.text, isRevealed: true } 
            : w
        );
        setArticle({ ...article, content: updatedContent });
      }

      setSuccessMessage(result.message);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to reveal word:', error);
      setError(error.message || 'Failed to reveal word. Please try again.');
    } finally {
      setRevealingWordId(null);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>💸 Pay-Per-Reveal Article</h1>
        <p>Click blurred words to reveal them for $0.10 each</p>
        <div className="server-status">{serverStatus}</div>
      </header>

      <main>
        <section className="wallet-section">
          <h2>Connect Your Wallet</h2>
          <WalletConnect />
          {!walletClient && (
            <p className="hint">Connect your wallet to start revealing words</p>
          )}
        </section>

        {(error || successMessage) && (
          <section className="message-section">
            {error && <div className="error-message">❌ {error}</div>}
            {successMessage && <div className="success-message">✅ {successMessage}</div>}
          </section>
        )}

        {article && (
          <section className="article-section">
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
                      title={isBlurredAndHidden ? `Click to reveal for ${article.pricePerWord}` : ''}
                    >
                      {word.text}
                      {index < article.content.length - 1 && ' '}
                    </span>
                  );
                })}
              </div>
            </article>
            
            <div className="article-info">
              <p className="price-info">💰 Price per word: {article.pricePerWord}</p>
              <p className="blur-info">
                🔒 Blurred words: {article.content.filter(w => w.isBlurred && !w.isRevealed).length} remaining
              </p>
            </div>
          </section>
        )}

        {!article && !error && (
          <section className="loading-section">
            <p>Loading article...</p>
          </section>
        )}
      </main>

      <footer>
        <p>
          This is a demonstration of pay-per-reveal content monetization using x402 micropayments.
          Each word reveal requires wallet approval.
        </p>
        <div className="builder-resources">
          <h3>🛠️ Built with x402</h3>
          <p>Frictionless micropayments for the web</p>
          <div className="resource-links">
            <a href="https://x402.org" target="_blank" rel="noopener noreferrer">
              📚 x402 Documentation
            </a>
            <a href="https://github.com/coinbase/x402" target="_blank" rel="noopener noreferrer">
              💻 GitHub Repository
            </a>
            <a href="https://discord.gg/invite/cdp" target="_blank" rel="noopener noreferrer">
              💬 Discord Community
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
