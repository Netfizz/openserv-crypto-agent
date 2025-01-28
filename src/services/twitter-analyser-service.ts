import { Post, PostWithTickers } from './interfaces/twitter-analyser-interface'

export class TwitterAnalyserService {
  public filterTweetsWithTickerMention(
    collection: Post[]
    // currentFiles: File[]
  ): PostWithTickers[] {
    // Find posts with ticker(s) mention
    return (
      collection
        .map((post: Post): PostWithTickers | null => {
          // Match tickers in the post text
          const tickers = post.text.match(/\$\b[A-Za-z]{2,}\b/g)
          // Return the enriched object if tickers are found, otherwise null
          return tickers ? { post, path: null, tickers, crypto: null } : null
        })
        // Filter out null values
        .filter((item: PostWithTickers | null): item is PostWithTickers => item !== null)
    )
  }
}
