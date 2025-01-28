export interface Token {
  address: string
  name: string
  symbol: string
}

export interface Transactions {
  m5?: {
    buys: number
    sells: number
  }
  h1?: {
    buys: number
    sells: number
  }
  h6?: {
    buys: number
    sells: number
  }
  h24?: {
    buys: number
    sells: number
  }
}

export interface Volume {
  h24?: number
  h6?: number
  h1?: number
  m5?: number
}

export interface PriceChange {
  m5?: number
  h1?: number
  h6?: number
  h24?: number
}

export interface Liquidity {
  usd: number
  base: number
  quote: number
}

export interface Website {
  label: string
  url: string
}

export interface Social {
  type: string
  url: string
}

export interface Info {
  imageUrl: string
  header: string
  openGraph: string
  websites: Website[]
  socials: Social[]
}

export interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  labels?: string[]
  baseToken: Token
  quoteToken: Token
  priceNative: string
  priceUsd: string
  txns: Transactions
  volume: Volume
  priceChange: PriceChange
  liquidity: Liquidity
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: Info
}

export interface DexScreenerData {
  schemaVersion: string
  pairs: DexScreenerPair[]
}

export interface TokenData {
  name: string // Base token name
  symbol: string // Base token symbol
  logo: string | null // URL for the token's logo image
  header: string | null // URL for the token's header image
  openGraph: string | null // URL for the token's Open Graph image
  links: TokenLink[] // List of external links related to the token
  pairAddress: string // Address of the trading pair
  priceUsd: string // Current price in USD
  marketCapUsd: number // Current market cap in USD
  pairs: SimplifiedPair[] // List of simplified trading pairs
  volumes: Volume
  priceChanges: PriceChange
}

export interface TokenLink {
  label: string // Description or type of the link (e.g., "Website", "Twitter")
  url: string // URL of the link
}

export interface SimplifiedPair {
  label: string // Pair name in the format "BaseToken/QuoteToken"
  symbol: string // Pair symbol in the format "BaseSymbol/QuoteSymbol"
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  priceUsd: string
  liquidityUsd: number
  transactions: Transactions
  volumes: Volume
  priceChanges: PriceChange
  //liquidity: Liquidity
  fdv: number
  marketCap: number
  pairCreatedAt: number
}

export interface Group {
  name: string
  symbol: string
  pairs: DexScreenerPair[]
  total_market_cap: number
  total_volume_24h: number
}
