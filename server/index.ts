import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { paymentMiddleware, Network, Resource } from "x402-hono";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

config();

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment variables
const facilitatorUrl = process.env.FACILITATOR_URL as Resource || "https://x402.org/facilitator";
const payTo = process.env.ADDRESS as `0x${string}`;
const network = (process.env.NETWORK as Network) || "base-sepolia";
const port = parseInt(process.env.PORT || "3001");

if (!payTo) {
  console.error("❌ Please set your wallet ADDRESS in the .env file");
  process.exit(1);
}

const app = new Hono();

// Enable CORS for frontend
app.use("/*", cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://pay-per-reveal-x402-production.up.railway.app"
  ],
  credentials: true,
}));

// Article data structure
interface ArticleWord {
  id: string;
  text: string;
  isBlurred: boolean;
  phraseId?: string; // Groups words that belong to the same phrase
  type?: 'text' | 'heading' | 'list-item' | 'paragraph-break' | 'line-break';
  level?: number; // For headings (1-6)
}

interface Article {
  id: string;
  title: string;
  content: ArticleWord[];
  pricePerWord: string;
}

interface ArticleConfig {
  articles: Array<{
    id: string;
    title: string;
    content: string;
    blurredWords: string[];
    pricePerWord: string;
  }>;
}

// Load and parse a single article with markdown support
function parseArticle(articleConfig: ArticleConfig['articles'][0]): Article {
  const content: ArticleWord[] = [];
  let wordIndex = 0;
  
  // Parse markdown tokens
  const tokens = marked.lexer(articleConfig.content);
  
  // Helper to normalize text (remove punctuation)
  const normalize = (text: string) => 
    text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF-]/g, "").trim();
  
  // Separate single-word and multi-word blur phrases
  const singleWordBlurs = articleConfig.blurredWords.filter(phrase => !normalize(phrase).includes(' '));
  const multiWordBlurs = articleConfig.blurredWords.filter(phrase => normalize(phrase).includes(' '));
  
  // Process text and split into words with blur logic
  const processText = (rawText: string, type: ArticleWord['type'] = 'text', level?: number) => {
    // Parse inline markdown (bold, italic, etc.) and strip it
    const text = rawText
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Bold: **text** -> text
      .replace(/\*([^*]+)\*/g, '$1')      // Italic: *text* -> text
      .replace(/__([^_]+)__/g, '$1')      // Bold: __text__ -> text
      .replace(/_([^_]+)_/g, '$1');       // Italic: _text_ -> text
    
    const words = text.split(/(\s+)/);
    const normalizedText = normalize(text);
    
    // Find all multi-word phrase positions in the normalized text
    const multiPhraseRanges: Array<{ startWordIndex: number; endWordIndex: number; phrase: string }> = [];
    
    multiWordBlurs.forEach(blurPhrase => {
      const phraseNormalized = normalize(blurPhrase);
      const phraseWords = phraseNormalized.split(/\s+/);
      
      // Build normalized words array (skipping whitespace)
      const normalizedWords = words
        .map((w, idx) => ({ text: w, normalized: normalize(w), originalIndex: idx }))
        .filter(w => w.normalized.length > 0);
      
      // Find consecutive matches
      for (let i = 0; i <= normalizedWords.length - phraseWords.length; i++) {
        let matches = true;
        for (let j = 0; j < phraseWords.length; j++) {
          if (normalizedWords[i + j].normalized !== phraseWords[j]) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          multiPhraseRanges.push({
            startWordIndex: i,
            endWordIndex: i + phraseWords.length - 1,
            phrase: blurPhrase,
          });
        }
      }
    });
    
    // Now process words
    let wordArrayIndex = 0;
    words.forEach((word, idx) => {
      if (word.trim().length === 0) return;
      
      wordIndex++;
      const wordId = `w${wordIndex}`;
      const wordNormalized = normalize(word);
      
      // Check if this word is part of a multi-word phrase
      let blurPhrase: string | null = null;
      for (const range of multiPhraseRanges) {
        if (wordArrayIndex >= range.startWordIndex && wordArrayIndex <= range.endWordIndex) {
          blurPhrase = range.phrase;
          break;
        }
      }
      
      // If not part of multi-word, check single-word matches
      if (!blurPhrase) {
        for (const singleBlur of singleWordBlurs) {
          if (normalize(singleBlur) === wordNormalized) {
            blurPhrase = singleBlur;
            break;
          }
        }
      }
      
      content.push({
        id: wordId,
        text: word,
        isBlurred: !!blurPhrase,
        phraseId: blurPhrase ? `phrase-${blurPhrase.replace(/\s+/g, '-').toLowerCase()}` : undefined,
        type,
        level,
      });
      
      wordArrayIndex++;
    });
  };
  
  // Walk through tokens and build content
  tokens.forEach((token, tokenIndex) => {
    if (token.type === 'heading') {
      processText(token.text, 'heading', token.depth);
      // Add paragraph break after heading
      if (tokenIndex < tokens.length - 1) {
        wordIndex++;
        content.push({
          id: `w${wordIndex}`,
          text: '',
          isBlurred: false,
          type: 'paragraph-break',
        });
      }
    } else if (token.type === 'paragraph') {
      processText(token.text, 'text');
      // Add paragraph break after paragraph
      if (tokenIndex < tokens.length - 1) {
        wordIndex++;
        content.push({
          id: `w${wordIndex}`,
          text: '',
          isBlurred: false,
          type: 'paragraph-break',
        });
      }
    } else if (token.type === 'list') {
      token.items?.forEach((item: any, itemIndex: number) => {
        processText(item.text, 'list-item');
        // Add line break between list items
        if (itemIndex < (token.items?.length || 0) - 1) {
          wordIndex++;
          content.push({
            id: `w${wordIndex}`,
            text: '',
            isBlurred: false,
            type: 'line-break',
          });
        }
      });
      // Add paragraph break after list
      if (tokenIndex < tokens.length - 1) {
        wordIndex++;
        content.push({
          id: `w${wordIndex}`,
          text: '',
          isBlurred: false,
          type: 'paragraph-break',
        });
      }
    } else if (token.type === 'space') {
      // Skip spaces between blocks (handled by paragraph breaks)
    } else {
      // Fallback for any other token type
      if ('text' in token && token.text) {
        processText(token.text, 'text');
      }
    }
  });

  return {
    id: articleConfig.id,
    title: articleConfig.title,
    content,
    pricePerWord: articleConfig.pricePerWord,
  };
}

// Load all articles from config
function loadAllArticles(): Article[] {
  const configPath = join(__dirname, "article-config.json");
  const configData = readFileSync(configPath, "utf-8");
  const config: ArticleConfig = JSON.parse(configData);
  
  return config.articles.map(articleConfig => parseArticle(articleConfig));
}

const articles = loadAllArticles();
console.log(`📚 Loaded ${articles.length} article(s)`);
articles.forEach((article, idx) => {
  console.log(`  ${idx + 1}. "${article.title}" - ${article.content.filter(w => w.isBlurred).length} blurred words`);
});

// Track revealed words per user per article
// Map<walletAddress, Map<articleId, Set<wordText>>>
const revealedWords = new Map<string, Map<string, Set<string>>>();

// Configure x402 payment middleware dynamically for all blurred words across all articles
const paymentEndpoints: Record<string, { price: string; network: Network }> = {};
articles.forEach((article, articleIndex) => {
  article.content
    .filter(word => word.isBlurred)
    .forEach(word => {
      paymentEndpoints[`/api/pay/reveal/${articleIndex}/${word.id}`] = {
        price: article.pricePerWord,
        network,
      };
    });
});

console.log(`💰 Payment endpoints configured:`, Object.keys(paymentEndpoints).length);

app.use(
  paymentMiddleware(
    payTo,
    paymentEndpoints,
    {
      url: facilitatorUrl,
    },
  ),
);

// Free endpoint - health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    message: "Pay-per-reveal article server running",
    config: {
      network,
      payTo,
      facilitator: facilitatorUrl,
    },
  });
});

// Free endpoint - list all articles (metadata only)
app.get("/api/articles", (c) => {
  return c.json({
    articles: articles.map((article, index) => ({
      index,
      id: article.id,
      title: article.title,
      pricePerWord: article.pricePerWord,
      totalWords: article.content.length,
      blurredWords: article.content.filter(w => w.isBlurred).length,
    })),
  });
});

// Free endpoint - get a specific article by index
app.get("/api/article/:index", (c) => {
  const articleIndex = parseInt(c.req.param("index"));
  
  if (isNaN(articleIndex) || articleIndex < 0 || articleIndex >= articles.length) {
    return c.json({ error: "Invalid article index" }, 404);
  }
  
  const article = articles[articleIndex];
  const walletAddress = c.req.header("X-Wallet-Address");
  
  // Get user's revealed words for this specific article
  const userArticleRevealed = walletAddress 
    ? (revealedWords.get(walletAddress.toLowerCase())?.get(article.id) || new Set())
    : new Set();
  
  // Return article with words replaced by blur placeholders for unrevealed blurred words
  const maskedContent = article.content.map(word => {
    // Check if this word text has been revealed (normalize for comparison)
    const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
    const isWordRevealed = userArticleRevealed.has(wordTextNormalized);
    
    if (word.isBlurred && !isWordRevealed) {
      return {
        id: word.id,
        text: "█████", // Placeholder for blurred text
        isBlurred: true,
        isRevealed: false,
        type: word.type,
        level: word.level,
        phraseId: word.phraseId,
      };
    }
    return {
      id: word.id,
      text: word.text,
      isBlurred: word.isBlurred,
      isRevealed: word.isBlurred ? isWordRevealed : false,
      type: word.type,
      level: word.level,
      phraseId: word.phraseId,
    };
  });

  return c.json({
    index: articleIndex,
    id: article.id,
    title: article.title,
    content: maskedContent,
    pricePerWord: article.pricePerWord,
  });
});

// Helper function to handle word reveal
const handleWordReveal = (articleIndex: number, wordId: string, walletAddress: string | undefined) => {
  if (articleIndex < 0 || articleIndex >= articles.length) {
    return { success: false, error: "Invalid article index", status: 404 };
  }
  
  const article = articles[articleIndex];
  
  // Find the word in the article
  const word = article.content.find(w => w.id === wordId);

  if (!word) {
    return { success: false, error: "Word not found", status: 404 };
  }

  if (!word.isBlurred) {
    return { success: false, error: "This word is not blurred", status: 400 };
  }

  // Track that this user has revealed this word/phrase for this article
  if (walletAddress) {
    const userAddress = walletAddress.toLowerCase();
    if (!revealedWords.has(userAddress)) {
      revealedWords.set(userAddress, new Map());
    }
    
    const userArticles = revealedWords.get(userAddress)!;
    if (!userArticles.has(article.id)) {
      userArticles.set(article.id, new Set());
    }
    
    const userArticleWords = userArticles.get(article.id)!;
    
    // If this word is part of a phrase, reveal all words in that phrase
    if (word.phraseId) {
      // Find all words with the same phraseId and reveal them
      article.content
        .filter(w => w.phraseId === word.phraseId)
        .forEach(w => {
          const normalized = w.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
          userArticleWords.add(normalized);
        });
    } else {
      // Single word - store normalized word text
      const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
      userArticleWords.add(wordTextNormalized);
    }
  }

  // Get the full phrase text if it's a multi-word phrase
  let displayText = word.text;
  if (word.phraseId) {
    const phraseWords = article.content.filter(w => w.phraseId === word.phraseId);
    displayText = phraseWords.map(w => w.text).join(' ');
  }

  // Count how many instances of this word/phrase will be revealed
  const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
  const totalInstances = article.content.filter(w => {
    const wNormalized = w.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
    return wNormalized === wordTextNormalized && w.isBlurred;
  }).length;

  return {
    success: true,
    wordId,
    text: displayText,
    message: totalInstances > 1 
      ? `Word revealed: "${displayText}" (${totalInstances} instances unlocked)`
      : `Word revealed: "${displayText}"`,
    status: 200,
  };
};

// Dynamically create paid endpoints for each blurred word in all articles
articles.forEach((article, articleIndex) => {
  article.content
    .filter(word => word.isBlurred)
    .forEach(word => {
      app.post(`/api/pay/reveal/${articleIndex}/${word.id}`, (c) => {
        const walletAddress = c.req.header("X-Wallet-Address");
        const result = handleWordReveal(articleIndex, word.id, walletAddress);
        return c.json(result, result.status as any);
      });
    });
});

console.log(`
🚀 Pay-Per-Reveal Article Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Accepting payments to: ${payTo}
🔗 Network: ${network}
🌐 Port: ${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 ${articles.length} articles loaded
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Edit article-config.json to customize content and blurred words
📚 Learn more: https://x402.org
💬 Get help: https://discord.gg/invite/cdp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

serve({
  fetch: app.fetch,
  port,
}); 