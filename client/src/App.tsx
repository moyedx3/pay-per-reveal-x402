import React, { useState, useEffect } from 'react';
import { WalletConnect } from './components/WalletConnect';
import { useWallet } from './contexts/WalletContext';
import { api, updateApiClient, type Article, type ArticleWord, type ArticleMetadata } from './services/api';
import './App.css';

function App() {
  const { walletClient } = useWallet();
  const [articles, setArticles] = useState<ArticleMetadata[]>([]);
  const [currentArticleIndex, setCurrentArticleIndex] = useState<number>(0);
  const [article, setArticle] = useState<Article | null>(null);
  const [revealingWordId, setRevealingWordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  useEffect(() => {
    updateApiClient(walletClient);
    if (article) {
      loadArticle(currentArticleIndex);
    }
  }, [walletClient]);

  useEffect(() => {
    loadArticles();
  }, []);

  useEffect(() => {
    loadArticle(currentArticleIndex);
  }, [currentArticleIndex]);

  const loadArticles = async () => {
    try {
      const response = await api.getArticles();
      setArticles(response.articles);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load articles:', error);
    }
  };

  const loadArticle = async (index: number) => {
    try {
      const articleData = await api.getArticle(index);
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
      await api.revealWord(currentArticleIndex, word.id);
      await loadArticle(currentArticleIndex);
    } catch (error: any) {
      setError('Payment failed');
      setTimeout(() => setError(null), 2000);
    } finally {
      setRevealingWordId(null);
    }
  };

  const blurredCount = article ? article.content.filter(w => w.isBlurred && !w.isRevealed).length : 0;
  const totalBlurred = article ? article.content.filter(w => w.isBlurred).length : 0;
  const unlockedCount = totalBlurred - blurredCount;
  const progressPercent = totalBlurred > 0 ? (unlockedCount / totalBlurred) * 100 : 0;

  return (
    <div className="app">
      {/* Logo - top left */}
      <div className="logo">
        <img src="/logo.png" alt="Logo" />
      </div>

      {/* Article navigation - top center */}
      {articles.length > 1 && (
        <div className="article-navigation">
          {articles.map((_, index) => (
            <button
              key={index}
              className={`article-nav-btn ${currentArticleIndex === index ? 'active' : ''}`}
              onClick={() => setCurrentArticleIndex(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

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
          
          {/* Progress indicator */}
          {totalBlurred > 0 && (
            <div className="progress-indicator">
              <div className="progress-text">
                {unlockedCount} of {totalBlurred} unlocked
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="article-content">
            {(() => {
              const renderedElements: JSX.Element[] = [];
              let currentGroup: ArticleWord[] = [];
              let currentType: ArticleWord['type'] = 'text';
              let currentLevel: number | undefined;
              
              const renderWord = (word: ArticleWord, nextWord?: ArticleWord) => {
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
                    {nextWord && ' '}
                  </span>
                );
              };
              
              const flushGroup = () => {
                if (currentGroup.length === 0) return;
                
                const content = currentGroup.map((word, idx) => 
                  renderWord(word, currentGroup[idx + 1])
                );
                
                if (currentType === 'heading') {
                  const HeadingTag = `h${currentLevel || 3}` as keyof JSX.IntrinsicElements;
                  renderedElements.push(
                    <HeadingTag key={currentGroup[0].id} className="article-heading">
                      {content}
                    </HeadingTag>
                  );
                } else if (currentType === 'list-item') {
                  renderedElements.push(
                    <li key={currentGroup[0].id} className="article-list-item">
                      {content}
                    </li>
                  );
                } else if (currentType === 'text') {
                  renderedElements.push(
                    <span key={currentGroup[0].id}>
                      {content}
                    </span>
                  );
                }
                
                currentGroup = [];
              };
              
              article.content.forEach((word, index) => {
                const nextWord = article.content[index + 1];
                
                // Handle structural elements
                if (word.type === 'paragraph-break') {
                  flushGroup();
                  renderedElements.push(<br key={word.id} />);
                  renderedElements.push(<br key={word.id + '-2'} />);
                  return;
                } else if (word.type === 'line-break') {
                  flushGroup();
                  renderedElements.push(<br key={word.id} />);
                  return;
                }
                
                // Check if we need to start a new group
                if (word.type !== currentType || word.level !== currentLevel) {
                  flushGroup();
                  currentType = word.type || 'text';
                  currentLevel = word.level;
                }
                
                currentGroup.push(word);
                
                // Flush at the end
                if (index === article.content.length - 1) {
                  flushGroup();
                }
              });

              return renderedElements;
            })()}
          </div>
        </article>
      )}

      {/* Disclaimer */}
      <div className="disclaimer">
        This content is for demonstration purposes only and does not constitute investment advice. Always conduct your own research before making any financial decisions.
      </div>
    </div>
  );
}

export default App;
