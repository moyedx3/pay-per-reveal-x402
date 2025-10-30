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
    "http://127.0.0.1:3000"
  ],
  credentials: true,
}));

// Article data structure
interface ArticleWord {
  id: string;
  text: string;
  isBlurred: boolean;
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

  // Split content into words and assign IDs
  const words = config.article.content.split(/(\s+)/); // Split but keep whitespace
  let wordIndex = 0;
  
  const content: ArticleWord[] = words
    .filter(w => w.trim().length > 0) // Remove pure whitespace entries
    .map(word => {
      wordIndex++;
      const wordId = `w${wordIndex}`;
      
      // Check if this word (or word without punctuation) should be blurred
      const wordLower = word.toLowerCase();
      const wordNoPunct = word.replace(/[.,!?;:'"()]/g, "").toLowerCase();
      
      const isBlurred = config.article.blurredWords.some(blurWord => {
        const blurLower = blurWord.toLowerCase();
        return wordLower === blurLower || 
               wordNoPunct === blurLower ||
               wordLower.startsWith(blurLower) ||
               wordNoPunct === blurLower.replace(/[.,!?;:'"()]/g, "");
      });

      return {
        id: wordId,
        text: word,
        isBlurred,
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
    const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()]/g, "");
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

  // Track that this user has revealed this word TEXT (not just this ID)
  // This means all instances of the same word will be revealed
  if (walletAddress) {
    const userAddress = walletAddress.toLowerCase();
    if (!revealedWords.has(userAddress)) {
      revealedWords.set(userAddress, new Set());
    }
    
    // Store normalized word text (lowercase, no punctuation)
    const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()]/g, "");
    revealedWords.get(userAddress)!.add(wordTextNormalized);
  }

  // Count how many instances of this word will be revealed
  const wordTextNormalized = word.text.toLowerCase().replace(/[.,!?;:'"()]/g, "");
  const totalInstances = article.content.filter(w => {
    const wNormalized = w.text.toLowerCase().replace(/[.,!?;:'"()]/g, "");
    return wNormalized === wordTextNormalized && w.isBlurred;
  }).length;

  return {
    success: true,
    wordId,
    text: word.text,
    message: totalInstances > 1 
      ? `Word revealed: "${word.text}" (${totalInstances} instances unlocked)`
      : `Word revealed: "${word.text}"`,
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