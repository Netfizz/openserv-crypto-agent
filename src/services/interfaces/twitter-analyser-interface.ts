import { TokenData } from './dexscreener-interfaces'

// Types
export type Post = {
  text: string
  id: string
}

export type File = {
  path: string
}

export type CryptoData = {
  ticker: string
  name: string
  website: string | undefined | null
  summary: string | undefined | null
  data: TokenData
}

export type PostWithTickers = {
  post: Post
  tickers: string[]
}

export interface TickerSummaryEntry {
  ticker: string
  name: string
  website?: string
  detail_file: string
}

export interface TweetSummary {
  tweet: {
    id: string
    text: string
  }
  tickers: TickerSummaryEntry[]
}
