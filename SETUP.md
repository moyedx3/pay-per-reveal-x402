# Quick Setup Guide

## 1. Install Dependencies

```bash
npm run install:all
```

## 2. Configure Server

Create `server/.env` with your wallet address:

```env
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=base-sepolia
ADDRESS=0x_YOUR_WALLET_ADDRESS_HERE
PORT=3001
```

Replace `0x_YOUR_WALLET_ADDRESS_HERE` with your actual wallet address that will receive payments.

## 3. Run the App

```bash
npm run dev
```

This starts:
- **Server**: http://localhost:3001
- **Client**: http://localhost:5173

## 4. Get Test Tokens

Before testing, you need test tokens on Base Sepolia:

1. **Get Base Sepolia ETH**: [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. **Get Base Sepolia USDC**: [Circle Faucet](https://faucet.circle.com/)

## 5. Test the App

1. Open http://localhost:5173 in your browser
2. Connect your wallet (make sure you're on Base Sepolia network)
3. Read the article and click on any blurred word (they show as █████)
4. Approve the $0.10 payment in your wallet
5. Watch the word reveal instantly!

## How It Works

- **Article**: Hardcoded article with 2 blurred words ("monetization." and "blockchain-based")
- **Payment**: $0.10 per word reveal via x402
- **Persistence**: Once you pay to reveal a word, it stays revealed for your wallet address
- **Server**: Tracks revealed words per wallet address (in-memory for MVP)

## Customization

### Change Which Words Are Blurred

Edit `server/index.ts` around line 53 and 68:

```typescript
{ id: "w7", text: "monetization.", isBlurred: true }, // Change to false to unblur
{ id: "w22", text: "blockchain-based", isBlurred: true }, // Or blur different words
```

### Change the Article

Edit the `article` constant in `server/index.ts` starting at line 43.

### Change the Price

Edit `server/index.ts` line 96:

```typescript
"/api/pay/reveal/:wordId": {
  price: "$0.010",  // Change this
  network,
}
```

## Troubleshooting

**Server won't start**: Make sure you've set the ADDRESS in `server/.env`

**Payment fails**: Ensure you have both ETH (for gas) and USDC on Base Sepolia

**Words don't reveal**: Check browser console for errors and ensure wallet is connected

**Article shows "Loading..."**: Check that server is running on port 3001

## Architecture

```
User clicks blurred word
    ↓
Client sends payment via x402
    ↓
Server validates payment
    ↓
Server returns actual word text
    ↓
Client reveals word in UI
```

## Next Steps

- Add more articles to a database
- Let authors configure which words to blur
- Add analytics dashboard
- Implement variable pricing per word
- Add user authentication and payment history

