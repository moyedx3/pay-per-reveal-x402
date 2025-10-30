import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { paymentMiddleware, Network, Resource } from "x402-hono";
import { v4 as uuidv4 } from "uuid";

config();

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
}

// Hardcoded article for MVP
const article: Article = {
  id: "article-1",
  title: "The Future of Micropayments on the Web",
  content: [
    { id: "w1", text: "The", isBlurred: false },
    { id: "w2", text: "internet", isBlurred: false },
    { id: "w3", text: "has", isBlurred: false },
    { id: "w4", text: "long", isBlurred: false },
    { id: "w5", text: "struggled", isBlurred: false },
    { id: "w6", text: "with", isBlurred: false },
    { id: "w7", text: "monetization.", isBlurred: true }, // Blurred word 1
    { id: "w8", text: "Traditional", isBlurred: false },
    { id: "w9", text: "payment", isBlurred: false },
    { id: "w10", text: "systems", isBlurred: false },
    { id: "w11", text: "impose", isBlurred: false },
    { id: "w12", text: "high", isBlurred: false },
    { id: "w13", text: "fees", isBlurred: false },
    { id: "w14", text: "and", isBlurred: false },
    { id: "w15", text: "complex", isBlurred: false },
    { id: "w16", text: "integrations,", isBlurred: false },
    { id: "w17", text: "making", isBlurred: false },
    { id: "w18", text: "small", isBlurred: false },
    { id: "w19", text: "payments", isBlurred: false },
    { id: "w20", text: "impractical.", isBlurred: false },
    { id: "w21", text: "Enter", isBlurred: false },
    { id: "w22", text: "blockchain-based", isBlurred: true }, // Blurred word 2
    { id: "w23", text: "payment", isBlurred: false },
    { id: "w24", text: "protocols", isBlurred: false },
    { id: "w25", text: "like", isBlurred: false },
    { id: "w26", text: "x402,", isBlurred: false },
    { id: "w27", text: "which", isBlurred: false },
    { id: "w28", text: "enable", isBlurred: false },
    { id: "w29", text: "frictionless", isBlurred: false },
    { id: "w30", text: "micropayments", isBlurred: false },
    { id: "w31", text: "with", isBlurred: false },
    { id: "w32", text: "no", isBlurred: false },
    { id: "w33", text: "fees", isBlurred: false },
    { id: "w34", text: "and", isBlurred: false },
    { id: "w35", text: "instant", isBlurred: false },
    { id: "w36", text: "settlement.", isBlurred: false },
  ],
};

// Track revealed words per user (in production, use proper user identification)
// For MVP, we'll track by wallet address
const revealedWords = new Map<string, Set<string>>(); // Map<walletAddress, Set<wordId>>

// Configure x402 payment middleware for word reveals
// Note: x402 doesn't support dynamic routes, so we need individual endpoints for each word
app.use(
  paymentMiddleware(
    payTo,
    {
      "/api/pay/reveal/w7": {
        price: "$0.010",
        network,
      },
      "/api/pay/reveal/w22": {
        price: "$0.010",
        network,
      },
    },
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
  
  // Get user's revealed words
  const userRevealed = walletAddress ? revealedWords.get(walletAddress.toLowerCase()) || new Set() : new Set();
  
  // Return article with words replaced by blur placeholders for unrevealed blurred words
  const maskedContent = article.content.map(word => {
    if (word.isBlurred && !userRevealed.has(word.id)) {
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
      isRevealed: word.isBlurred ? userRevealed.has(word.id) : false,
    };
  });

  return c.json({
    id: article.id,
    title: article.title,
    content: maskedContent,
    pricePerWord: "$0.10",
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

  // Track that this user has revealed this word
  if (walletAddress) {
    const userAddress = walletAddress.toLowerCase();
    if (!revealedWords.has(userAddress)) {
      revealedWords.set(userAddress, new Set());
    }
    revealedWords.get(userAddress)!.add(wordId);
  }

  return {
    success: true,
    wordId,
    text: word.text,
    message: `Word revealed: "${word.text}"`,
    status: 200,
  };
};

// Paid endpoints - reveal specific words ($0.10 each)
app.post("/api/pay/reveal/w7", (c) => {
  const walletAddress = c.req.header("X-Wallet-Address");
  const result = handleWordReveal("w7", walletAddress);
  return c.json(result, result.status as any);
});

app.post("/api/pay/reveal/w22", (c) => {
  const walletAddress = c.req.header("X-Wallet-Address");
  const result = handleWordReveal("w22", walletAddress);
  return c.json(result, result.status as any);
});

console.log(`
🚀 Pay-Per-Reveal Article Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Accepting payments to: ${payTo}
🔗 Network: ${network}
🌐 Port: ${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Article: "${article.title}"
💸 Price per word reveal: $0.10
🔒 Blurred words: ${article.content.filter(w => w.isBlurred).length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Learn more: https://x402.org
💬 Get help: https://discord.gg/invite/cdp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

serve({
  fetch: app.fetch,
  port,
}); 