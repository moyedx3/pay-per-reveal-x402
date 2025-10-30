# Article Configuration Guide

## How to Configure Your Article

Edit `article-config.json` to customize your pay-per-reveal article.

## Configuration Structure

```json
{
  "article": {
    "id": "unique-article-id",
    "title": "Your Article Title",
    "content": "Your full article text goes here...",
    "blurredWords": [
      "word1",
      "word2"
    ],
    "pricePerWord": "$0.010"
  }
}
```

## Fields Explained

### `id` (string)
Unique identifier for your article. Can be anything like `"article-1"`, `"crypto-101"`, etc.

### `title` (string)
The article title that appears at the top.

### `content` (string)
The full article text as a single string. The server will automatically split it into words.

**Tips:**
- Write naturally - don't worry about formatting
- The parser handles punctuation automatically
- Line breaks and multiple spaces are normalized

### `blurredWords` (array of strings)
List of words you want to blur. The matching is smart:
- **Case-insensitive**: "Bitcoin" matches "bitcoin" or "BITCOIN"
- **Punctuation-aware**: "monetization" matches "monetization." or "monetization,"
- **Partial matching**: Works with different forms

**Examples:**
```json
"blurredWords": [
  "blockchain",      // Matches: blockchain, Blockchain, blockchain., etc.
  "monetization",    // Matches: monetization, monetization., Monetization
  "cryptocurrency"   // Matches any form
]
```

### `pricePerWord` (string)
Price to reveal each blurred word. Must be in format `"$0.XXX"`.

**Examples:**
- `"$0.010"` - 1 cent
- `"$0.100"` - 10 cents
- `"$1.000"` - 1 dollar

## Example Configurations

### News Article with Spoilers

```json
{
  "article": {
    "id": "breaking-news-1",
    "title": "Major Announcement Tomorrow",
    "content": "Sources close to the company suggest that Apple will unveil a revolutionary new product at tomorrow's event. The device is rumored to combine AI capabilities with augmented reality in ways never seen before.",
    "blurredWords": [
      "Apple",
      "revolutionary",
      "augmented reality"
    ],
    "pricePerWord": "$0.050"
  }
}
```

### Educational Content

```json
{
  "article": {
    "id": "chemistry-lesson",
    "title": "Understanding Chemical Reactions",
    "content": "When hydrogen combines with oxygen, water is formed. This exothermic reaction releases energy in the form of heat and light.",
    "blurredWords": [
      "water",
      "exothermic",
      "energy"
    ],
    "pricePerWord": "$0.010"
  }
}
```

### Recipe with Secret Ingredients

```json
{
  "article": {
    "id": "secret-recipe",
    "title": "Grandma's Famous Cookie Recipe",
    "content": "The secret to these amazing cookies is the combination of brown sugar and vanilla extract, baked at exactly 350 degrees for 12 minutes.",
    "blurredWords": [
      "brown sugar",
      "vanilla extract",
      "350 degrees"
    ],
    "pricePerWord": "$0.020"
  }
}
```

## How to Apply Changes

1. Edit `server/article-config.json`
2. Save the file
3. Restart the server:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```
4. The server will automatically load the new configuration

## Important: Repeated Words Feature

**If the same word appears multiple times in your article, users only pay once!**

When a user pays to reveal one instance of a word, ALL instances of that word are automatically revealed.

**Example:**
```json
{
  "content": "Adam started a company. Adam worked hard. Adam succeeded.",
  "blurredWords": ["Adam"]
}
```

In this example:
- "Adam" appears 3 times in the article
- User clicks any blurred "Adam" and pays $0.010
- **All 3 instances of "Adam" are revealed immediately**
- The message shows: "Word revealed: Adam (3 instances unlocked)"

This makes sense for:
- Names (people, places, companies)
- Technical terms that repeat
- Key concepts mentioned multiple times
- Any word where revealing once should reveal all

**Note:** The matching is smart:
- "Adam" matches "Adam", "adam", "Adam.", "Adam,", etc.
- Case and punctuation are ignored

## Tips for Choosing Words to Blur

**Good candidates:**
- Key insights or conclusions
- Spoilers or reveals
- Technical terms in educational content
- Secret ingredients or methods
- Important names or places
- Answers to questions
- Exclusive information

**Avoid blurring:**
- Common words like "the", "and", "is"
- Too many words (makes reading frustrating)
- The first few words (let readers get hooked first)

**Sweet spot:** Blur 5-15% of content words for good balance between value and readability.

## Troubleshooting

**Word not blurring?**
- Check spelling in `blurredWords` array
- Remember it's case-insensitive
- Try without punctuation: "word" instead of "word."

**Price not working?**
- Must start with `$` symbol
- Use decimal format: `"$0.010"` not `"$0.01"`
- Minimum: `"$0.001"` (x402 limit)

**Server won't start?**
- Check JSON syntax is valid
- All strings need quotes
- Arrays need brackets `[]`
- Use a JSON validator online if unsure

## Advanced: Multiple Articles (Future)

Currently supports one article. To add multiple articles support, you'll need to:
1. Modify config to have an array of articles
2. Update server to handle article selection
3. Add routing for different article IDs

This is a great next enhancement!

