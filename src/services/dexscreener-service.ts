import axios from 'axios'
import {
  DexScreenerData,
  DexScreenerPair,
  Group,
  TokenData,
  TokenLink
} from './interfaces/dexscreener-interfaces'

export class DexScreenerService {
  private client

  constructor(baseURL: string = 'https://api.dexscreener.com') {
    this.client = axios.create({
      baseURL,
      timeout: 5000
    })
  }

  async searchTokens(query: string): Promise<DexScreenerData> {
    try {
      const response = await this.client.get(`/latest/dex/search?q=${encodeURIComponent(query)}`)
      return response.data
    } catch (error: any) {
      console.error(`Failed to search for tokens with query ${query}:`, error.message)
      throw error
    }
  }

  async findTokenBySymbol(symbol: string): Promise<TokenData | null> {
    try {
      const data = await this.searchTokens(symbol)

      if (data.pairs.length === 0) {
        return null
      }

      // Filter pairs by symbol and liquidity
      const filteredBySymbols = data.pairs.filter(
        pair =>
          pair.baseToken?.symbol === symbol.toUpperCase() &&
          pair.liquidity?.usd > 10000 &&
          pair.volume?.h24 &&
          pair.volume.h24 > 10000
      )

      // Retrieve main group
      const mainGroup = this.findLargerGroupByNormalizedName(filteredBySymbols)

      if (!mainGroup || !mainGroup.pairs || mainGroup.pairs.length === 0) {
        throw new Error(`No valid groups found for symbol: ${symbol}`)
      }

      // Retrieve the pair with the maximum liquidity WITH info property
      let mainPair = this.getMaxMarketCapPairWithInfo(mainGroup.pairs)

      if (!mainPair) {
        // Fallback - retrieve the pair with the maximum liquidity without info property
        mainPair = this.getMaxMarketCapPairWithInfo(mainGroup.pairs, false)

        if (!mainPair) {
          throw new Error(`No valid pairs found for symbol: ${symbol}`)
        }
      }

      return {
        name: mainGroup.name,
        symbol: mainGroup.symbol,
        logo: mainPair.info?.imageUrl || null,
        header: mainPair.info?.header || null,
        openGraph: mainPair.info?.openGraph || null,
        links: this.links(mainPair),
        pairAddress: mainPair.pairAddress,
        priceUsd: mainPair.priceUsd,
        marketCapUsd: mainPair.marketCap,
        pairs: this.mainPairs(mainGroup.pairs),
        volumes: mainPair.volume,
        priceChanges: mainPair.priceChange
      }
    } catch (error: any) {
      console.error(`Failed to find token by symbol ${symbol}:`, error.message)
      throw error
    }
  }

  // Utility function to normalize the baseToken name (remove parentheses)
  private normalizeName(name: string): string {
    return name.replace(/\s*\(.*?\)\s*/g, '').trim() // Remove parentheses and trim spaces
  }

  private findLargerGroupByNormalizedName(pairs: DexScreenerPair[]): Group | null {
    // Group by normalized name
    const groupsMap = pairs.reduce<Record<string, Group>>((acc, pair) => {
      const normalizedName = this.normalizeName(pair.baseToken?.name || '')

      if (!acc[normalizedName]) {
        acc[normalizedName] = {
          name: normalizedName,
          symbol: pair.baseToken?.symbol,
          pairs: [],
          total_market_cap: 0,
          total_volume_24h: 0
        }
      }

      // Ajouter la paire au groupe
      acc[normalizedName].pairs.push(pair)

      // Additionner les valeurs de marketCap et volume 24h
      acc[normalizedName].total_market_cap += pair.marketCap || 0
      acc[normalizedName].total_volume_24h += pair.volume?.h24 || 0

      return acc
    }, {})

    const groupsArray = Object.values(groupsMap)
    if (groupsArray.length === 0) {
      return null
    }

    // Étape 2 : return entry with larger total_market_cap
    return Object.values(groupsMap).reduce((maxGroup, currentGroup) => {
      return currentGroup.total_market_cap > maxGroup.total_market_cap ? currentGroup : maxGroup
    })
  }

  // Utility function to get the pair with the highest liquidity that has "info"
  private getMaxLiquidityPairWithInfo(pairs: DexScreenerPair[]): DexScreenerPair | null {
    return pairs
      .filter(pair => pair.info) // Filter pairs with "info" property
      .reduce<DexScreenerPair | null>(
        (max, pair) => (pair.liquidity?.usd > (max?.liquidity?.usd || 0) ? pair : max),
        null
      )
  }

  private getMaxMarketCapPairWithInfo(
    pairs: DexScreenerPair[],
    filterByInfo: boolean = true // Default to true to keep the original behavior
  ): DexScreenerPair | null {
    return pairs
      .filter(pair => !filterByInfo || pair.info) // Apply the filter conditionally
      .reduce<DexScreenerPair | null>(
        (max, pair) => (pair.marketCap > (max?.marketCap || 0) ? pair : max),
        null
      )
  }

  private mainPairs(collection: DexScreenerPair[]) {
    return collection
      .map(pair => ({
        // Map each pair to a simplified object
        label: `${pair.baseToken.name}/${pair.quoteToken.name}`,
        symbol: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
        chainId: pair.chainId,
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        priceUsd: pair.priceUsd,
        url: pair.url,
        liquidityUsd: pair.liquidity?.usd || 0, // Default to 0 if liquidity is undefined
        transactions: pair.txns,
        volumes: pair.volume,
        priceChanges: pair.priceChange,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        pairCreatedAt: pair.pairCreatedAt
      }))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd) // Sort by descending liquidity
      .filter(
        (pair, index, self) => self.findIndex(p => p.symbol === pair.symbol) === index // Remove duplicates, keep the first occurrence
      )
  }

  private links(mainPair: DexScreenerPair) {
    let links: TokenLink[] = []

    if (mainPair?.info?.websites) {
      links = links.concat(
        mainPair.info.websites.map(site => ({
          label: site.label,
          url: site.url
        }))
      )
    }

    if (mainPair?.info?.socials) {
      links = links.concat(
        mainPair.info.socials.map(social => ({
          label: social.type,
          url: social.url
        }))
      )
    }

    if (links.length > 0) {
      links.push({
        label: 'DexScreener',
        url: mainPair.url
      })
    }

    return links
  }
}
