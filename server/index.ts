import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { paymentMiddleware, Network, Resource } from "x402-hono";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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
}

interface Article {
  id: string;
  title: string;
  content: ArticleWord[];
  pricePerWord: string;
}

interface ArticleConfig {
  article: {
    id: string;
    title: string;
    content: string;
    blurredWords: string[];
    pricePerWord: string;
  };
}

// Load and parse article from config file
function loadArticleFromConfig(): Article {
  const configPath = join(__dirname, "article-config.json");
  const configData = readFileSync(configPath, "utf-8");
  const config: ArticleConfig = JSON.parse(configData);

  // Helper to normalize text for matching
  const normalize = (text: string) => 
    text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");

  // Build a map of which positions should be blurred (for multi-word phrase support)
  const contentLower = config.article.content.toLowerCase();
  const blurRanges: Array<{ start: number; end: number; phrase: string }> = [];

  // Find all occurrences of blurred phrases in the content
  config.article.blurredWords.forEach(blurPhrase => {
    const phraseLower = blurPhrase.toLowerCase();
    let searchPos = 0;
    
    while (true) {
      const foundPos = contentLower.indexOf(phraseLower, searchPos);
      if (foundPos === -1) break;
      
      // Make sure it's a word boundary (not part of another word)
      const beforeChar = foundPos > 0 ? config.article.content[foundPos - 1] : ' ';
      const afterChar = foundPos + phraseLower.length < config.article.content.length 
        ? config.article.content[foundPos + phraseLower.length] 
        : ' ';
      
      const isWordBoundary = /[\s.,!?;:'"()]/.test(beforeChar) && /[\s.,!?;:'"()]/.test(afterChar);
      
      if (isWordBoundary || foundPos === 0 || foundPos + phraseLower.length === config.article.content.length) {
        blurRanges.push({
          start: foundPos,
          end: foundPos + phraseLower.length,
          phrase: blurPhrase,
        });
      }
      
      searchPos = foundPos + 1;
    }
  });

  // Split content into words and assign IDs
  const words = config.article.content.split(/(\s+)/);
  let wordIndex = 0;
  let charPosition = 0;
  
  const content: ArticleWord[] = words
    .filter(w => w.trim().length > 0)
    .map(word => {
      wordIndex++;
      const wordId = `w${wordIndex}`;
      
      // Check if this word falls within any blur range
      const wordStart = charPosition;
      const wordEnd = charPosition + word.length;
      
      // Find which blur range (if any) this word belongs to
      const blurRange = blurRanges.find(range => {
        return wordStart < range.end && wordEnd > range.start;
      });
      
      const isBlurred = !!blurRange;
      const phraseId = blurRange ? `phrase-${blurRange.phrase.replace(/\s+/g, '-').toLowerCase()}` : undefined;
      
      charPosition = wordEnd;
      // Account for whitespace
      const nextWhitespace = config.article.content.substring(charPosition).match(/^\s+/);
      if (nextWhitespace) {
        charPosition += nextWhitespace[0].length;
      }

      return {
        id: wordId,
        text: word,
        isBlurred,
        phraseId,
      };
    });

  return {
    id: config.article.id,
    title: config.article.title,
    content,
    pricePerWord: config.article.pricePerWord,
  };
}

const article = loadArticleFromConfig();
console.log(`📚 Loaded article: "${article.title}" with ${article.content.filter(w => w.isBlurred).length} blurred words`);

// Track revealed words per user (in production, use proper user identification)
// For MVP, we'll track by wallet address
// Note: We track word TEXT (not word ID) so revealing one instance reveals all instances
const revealedWords = new Map<string, Set<string>>(); // Map<walletAddress, Set<wordText>>

// Configure x402 payment middleware dynamically for all blurred words
// Note: x402 doesn't support dynamic routes, so we need individual endpoints for each word
// We create one endpoint per blurred word instance (even if same word appears multiple times)
// But revealing any instance reveals ALL instances of that word
const paymentEndpoints: Record<string, { price: string; network: Network }> = {};
article.content
  .filter(word => word.isBlurred)
  .forEach(word => {
    paymentEndpoints[`/api/pay/reveal/${word.id}`] = {
      price: article.pricePerWord,
      network,
    };
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

// Free endpoint - get article with blur info (but not the actual words)
app.get("/api/article", (c) => {
  const walletAddress = c.req.header("X-Wallet-Address");
  
  // Get user's revealed words (stored as word text, not IDs)
  const userRevealed = walletAddress ? revealedWords.get(walletAddress.toLowerCase()) || new Set() : new Set();
  
  // Return article with words replaced by blur placeholders for unrevealed blurred words
  const maskedContent = article.content.map(word => {
    // Check if this word text has been revealed (normalize for comparison)
    const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
    const isWordRevealed = userRevealed.has(wordTextNormalized);
    
    if (word.isBlurred && !isWordRevealed) {
      return {
        id: word.id,
        text: "█████", // Placeholder for blurred text
        isBlurred: true,
        isRevealed: false,
      };
    }
    return {
      id: word.id,
      text: word.text,
      isBlurred: word.isBlurred,
      isRevealed: word.isBlurred ? isWordRevealed : false,
    };
  });

  return c.json({
    id: article.id,
    title: article.title,
    content: maskedContent,
    pricePerWord: article.pricePerWord,
  });
});

// Helper function to handle word reveal
const handleWordReveal = (wordId: string, walletAddress: string | undefined) => {
  // Find the word in the article
  const word = article.content.find(w => w.id === wordId);

  if (!word) {
    return { success: false, error: "Word not found", status: 404 };
  }

  if (!word.isBlurred) {
    return { success: false, error: "This word is not blurred", status: 400 };
  }

  // Track that this user has revealed this word/phrase
  if (walletAddress) {
    const userAddress = walletAddress.toLowerCase();
    if (!revealedWords.has(userAddress)) {
      revealedWords.set(userAddress, new Set());
    }
    
    // If this word is part of a phrase, reveal all words in that phrase
    if (word.phraseId) {
      // Find all words with the same phraseId and reveal them
      article.content
        .filter(w => w.phraseId === word.phraseId)
        .forEach(w => {
          const normalized = w.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
          revealedWords.get(userAddress)!.add(normalized);
        });
    } else {
      // Single word - store normalized word text
      const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()\u3000-\u303F\uFF00-\uFFEF]/g, "");
      revealedWords.get(userAddress)!.add(wordTextNormalized);
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

// Dynamically create paid endpoints for each blurred word
article.content
  .filter(word => word.isBlurred)
  .forEach(word => {
    app.post(`/api/pay/reveal/${word.id}`, (c) => {
      const walletAddress = c.req.header("X-Wallet-Address");
      const result = handleWordReveal(word.id, walletAddress);
      return c.json(result, result.status as any);
    });
  });

const blurredWords = article.content.filter(w => w.isBlurred);

console.log(`
🚀 Pay-Per-Reveal Article Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Accepting payments to: ${payTo}
🔗 Network: ${network}
🌐 Port: ${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Article: "${article.title}"
💸 Price per word reveal: ${article.pricePerWord}
🔒 Blurred words: ${blurredWords.length} (${blurredWords.map(w => `"${w.text}"`).join(", ")})
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