# DeFAI Assistant Agent

**DeFAI Assistant** is an intelligent agent designed to provide in-depth insights into the cryptocurrency ecosystem by seamlessly retrieving and analyzing real-time data. Built with OpenServ SDK and leveraging DexScreener API.
Stay ahead with **DeFAI Assistant**—your AI-powered assistant for smarter crypto tracking and analysis. 🚀

## 🔍 Comprehensive Token Analysis
Instantly access key information about any token using its ticker or name, including:
- Official links, logos, and social media profiles
- Live price updates
- Percentage changes
- Liquidity metrics
- Trading volume

## 🐦 Advanced Twitter Monitoring
Retrieve tweets from **any Twitter user**, extract mentioned ticker(s), and apply powerful filtering options:
- Fetch up to the **100 most recent tweets**
- Retrieve tweets within a specific date range
- Fetch tweets between two tweet IDs

---

## How to Use the DeFAI Assistant Agent

### Prompt examples
1. **Request a Token information**  
   Ask the Project Manager to assign a task to the **DeFAI Assistant** by providing a specific ticker. Example:
      ```
      Find information about $SERV
      ```

2. **Retrieve tweets from a specific Twitter user**
- Retrieve the most recent tweets from a specific Twitter username, with detailed information related to the ticker(s) attached to each tweet.
  ```
  Retrieve lastest tweets from @aixbt_agent
  ```
- Retrieve the 50 most recent tweets from a specific Twitter user ID, with detailed information related to the ticker(s) attached to each tweet.
  ```
  Retrieve 50 lastest tweets from user_id 1852674305517342720
  ```

- Retrieve the most recent tweets from a specific Twitter user ID within a given UTC date range, or specify only a start date or an end date.
  ```
  Retrieve tweets from AIXBT (Twitter ID: 1852674305517342720) between 2025-02-01 15:56 and 2025-02-01 16:26
  ```

  Retrieve the most recent tweets from a specific Twitter username between two tweet IDs, or specify only a starting or ending tweet ID, with detailed information related to the ticker(s) attached to each tweet.
  ```
  Retrieve tweets from @aixbt_agent since tweet id 1885677278312767934 until 1885707460771754311
  ```

---

### 🗂️ JSON Response Examples
Examples of JSON responses can be found in the `/examples` folder.

### Prerequisites

- Node.js >= 18.0.0
- OpenServ API Key
- OpenAI API Key

### Environment Variables

Create a `.env` file in the root directory:


### Development

Run the development server with hot reload:

```bash
npm run dev
```
