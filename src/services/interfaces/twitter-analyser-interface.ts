import { TokenData } from './dexscreener-interfaces'

// Types
export type Post = {
  text: string
  id: number
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
  path: string | null
  tickers: string[]
  crypto: CryptoData | null
}
