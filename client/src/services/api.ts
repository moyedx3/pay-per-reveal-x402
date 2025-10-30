import axios from "axios";
import type { AxiosInstance } from "axios";
import type { WalletClient } from "viem";
import { withPaymentInterceptor } from "x402-axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// Base axios instance without payment interceptor
const baseApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// This will be dynamically set based on wallet connection
let apiClient: AxiosInstance = baseApiClient;
let currentWalletAddress: string | null = null;

// Update the API client with a wallet
export function updateApiClient(walletClient: WalletClient | null) {
  if (walletClient && walletClient.account) {
    // Create axios instance with x402 payment interceptor
    apiClient = withPaymentInterceptor(baseApiClient, walletClient as any);
    currentWalletAddress = walletClient.account.address;
    console.log("💳 API client updated with wallet:", walletClient.account.address);
  } else {
    // No wallet connected - reset to base client
    apiClient = baseApiClient;
    currentWalletAddress = null;
    console.log("⚠️ API client reset - no wallet connected");
  }
}

// Helper to add wallet address header
function getHeaders() {
  const headers: Record<string, string> = {};
  if (currentWalletAddress) {
    headers["X-Wallet-Address"] = currentWalletAddress;
  }
  return headers;
}

// API endpoints
export const api = {
  // Free endpoints
  getHealth: async () => {
    const response = await apiClient.get("/api/health");
    return response.data;
  },

  getArticle: async () => {
    const response = await apiClient.get("/api/article", { headers: getHeaders() });
    return response.data;
  },

  // Paid endpoint - reveal a word
  revealWord: async (wordId: string) => {
    console.log(`💰 Paying to reveal word: ${wordId}...`);
    const response = await apiClient.post(`/api/pay/reveal/${wordId}`, {}, { headers: getHeaders() });
    console.log("✅ Word revealed:", response.data);
    return response.data;
  },
};

// Types for API responses
export interface ArticleWord {
  id: string;
  text: string;
  isBlurred: boolean;
  isRevealed: boolean;
  phraseId?: string;
}

export interface Article {
  id: string;
  title: string;
  content: ArticleWord[];
  pricePerWord: string;
}

export interface RevealResponse {
  success: boolean;
  wordId: string;
  text: string;
  message: string;
} 