# Pay-Per-Reveal Article App

> 💰 **Micropayments for content revelation using x402**

A web app where readers pay tiny amounts to reveal blurred words in articles. Built with [x402 payment protocol](https://x402.org) for instant, no-fee micropayments.

## What This Does

- Display articles with strategically blurred words
- Click any blurred word to pay and reveal it instantly
- Uses browser wallet + x402 for frictionless micropayments
- Perfect for pay-per-word or premium content monetization

## Current Features

- ✅ **Configurable articles** via JSON file
- ✅ **Choose any words to blur** - just list them
- ✅ **Set your own price** per word reveal
- ✅ **Pay once, reveal all** - revealing one instance reveals ALL instances of that word
- ✅ **Full internationalization** - supports Korean, Japanese, Chinese, and all languages
- ✅ Instant payment via browser wallet
- ✅ Persistent reveals (once paid, stays revealed)
- ✅ Smart word matching (handles punctuation & case)

## What is x402?

x402 is a payments protocol for the internet built on HTTP. It enables:
- **1 line of code** to accept digital dollars
- **No fees**, 2 second settlement
- **$0.001 minimum** payments

Learn more at [x402.org](https://x402.org) or check out the [GitHub repository](https://github.com/coinbase/x402).

## Quick Start

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Configure the Server

Create `server/.env`:
```env
FACILITATOR_URL=https://x402.org/facilitator
NETWORK=base-sepolia
ADDRESS=0x_YOUR_WALLET_ADDRESS_HERE
PORT=3001
```

### 3. Run Both Server and Client

```bash
npm run dev
```

This starts:
- Server on http://localhost:3001
- Client on http://localhost:5173

## How It Works

### Payment Flow

1. **Load Article**: User sees article with blurred words
2. **Click Blurred Word**: User clicks on a blurred word
3. **Connect Wallet** (if not connected): Browser wallet prompts connection
4. **Sign Payment**: User signs the $0.10 payment request
5. **Reveal Word**: Word is instantly revealed after payment confirmation
6. **Persistent State**: Revealed words stay visible for that user

## API Endpoints

### Free Endpoints

- `GET /api/health` - Server health check
- `GET /api/article` - Get the article with blur metadata

### Paid Endpoints

- `POST /api/pay/reveal/:wordId` - Pay to reveal a specific word ($0.10)

## Testing

1. Get Base Sepolia ETH from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. Get Base Sepolia USDC from [Circle Faucet](https://faucet.circle.com/)
3. Connect browser wallet to the app
4. Click a blurred word and confirm payment
5. Watch it reveal instantly

## Customization

### Configure Your Article

Edit `server/article-config.json`:

```json
{
  "article": {
    "id": "my-article",
    "title": "Your Title Here",
    "content": "Your article text...",
    "blurredWords": ["word1", "secret", "premium"],
    "pricePerWord": "$0.010"
  }
}
```

Restart server, done! See `server/ARTICLE_CONFIG_GUIDE.md` for detailed guide.

## Future Enhancements

- [ ] Multiple articles with routing
- [ ] Variable pricing per word (rare words cost more)
- [ ] Author dashboard to manage articles
- [ ] Analytics (which words get revealed most)
- [ ] Bulk reveal option (pay to reveal all)
- [ ] Time-based pricing (words get cheaper over time)
- [ ] Database persistence (currently in-memory)

## Use Cases

This pattern works great for:

- **Premium Articles**: Blur key insights, readers pay for the good stuff
- **Educational Content**: Blur answers in tutorials or quizzes
- **Research Papers**: Blur methodology or results sections
- **Recipe Sites**: Blur secret ingredients or techniques
- **Code Tutorials**: Blur solution code snippets
- **News Sites**: Blur exclusive details or scoops

## Architecture

```
Client (React + Viem)
  ↓
  Clicks blurred word
  ↓
Server (Hono + x402)
  ↓
  Validates payment
  ↓
Returns word content
```

## Get Help

Building something with x402? We're here to help!

- 📚 **Documentation**: [x402.org](https://x402.org)
- 💻 **Source Code**: [github.com/coinbase/x402](https://github.com/coinbase/x402)
- 💬 **Community**: [Join our Discord](https://discord.gg/invite/cdp)
- 🐛 **Issues**: [GitHub Issues](https://github.com/coinbase/x402/issues)

## License

This app is open source and available under the same license as the x402 protocol.

---

**Start monetizing content word by word!** 💸
