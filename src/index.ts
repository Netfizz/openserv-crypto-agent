import { z } from 'zod'
import { Agent } from '@openserv-labs/sdk'
import 'dotenv/config'
import { debugLogger, isDoTaskAction, normalizeToken, checkIntegrationErrors } from './helpers'
import { DexScreenerService } from './services/dexscreener-service'
import { TwitterAnalyserService } from './services/twitter-analyser-service'

// Create the agent
const agent = new Agent({
  systemPrompt: `You are deFAI, an intelligent agent designed to provide deep insights into the crypto ecosystem by seamlessly retrieving and analyzing data. Your primary capabilities include fetching comprehensive token information using either a ticker symbol or the token's name. This data includes real-time price updates, percentage changes, liquidity metrics, trading volumes, official logos, associated links, social media profiles, decentralized exchange (DEX) details, and trading pairs.
    In addition, you specialize in retrieving the most recent tweets mentioning ticker(s) from a specific Twitter user ID, with detailed cryptocurrency information related to the ticker(s) attached to the tweets.
    You can post a tweet message on Twitter`
})

const dexScreenerService = new DexScreenerService()

agent.addCapability({
  name: 'findTokenInformations',
  description:
    'Retrieve token informations (price, change, liquidity, volume, logo, links, socials, DEX and pairs) by is ticker symbol or name and save data as a JSON file.',
  schema: z.object({
    token: z.string()
  }),
  async run({ args, action }) {
    if (isDoTaskAction(action)) {
      try {
        const token = normalizeToken(args.token)

        await agent.addLogToTask({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          severity: 'info',
          type: 'text',
          body: `Retrieve ${token} informations`
        })

        const data = await dexScreenerService.findTokenBySymbol(token)

        if (!data) {
          return `No data was found for the cryptocurrency token "${token}" on 3rnd service API. Please verify that the token is correct and try again.`
        }

        // Upload file to workspace
        const path = `crypto_${token}.json`
        await agent.uploadFile({
          workspaceId: action.workspace.id,
          path: path,
          file: JSON.stringify(data, null, 2),
          skipSummarizer: true
          //taskIds: [action.task.id]
        })

        const website = data?.links[0]?.url || 'No website url found'
        const informations = JSON.stringify(data, null, 2)

        return `Comprehensive data about the crypto ticker ${data.name} (${data.symbol}) has been fetched and saved as a JSON file. 
You can find the details in the file named: ${path}.
Crypto ticker website is: ${website}.
Informations found : ${informations}`
      } catch (error) {
        await agent.markTaskAsErrored({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    debugLogger('action not implemented', action)

    return `Warning : use case not implemented yet.`
  }
})

agent.addCapability({
  name: 'postTwitterMessage',
  description: 'Post a tweet message on Twitter and retrieve the Tweet ID if successful.',
  schema: z.object({
    message: z.string()
  }),
  async run({ args, action }) {
    if (isDoTaskAction(action)) {
      try {
        const message = args.message
        await agent.addLogToTask({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          severity: 'info',
          type: 'text',
          body: `Posting message : ${message}`
        })

        const response = await agent.callIntegration({
          workspaceId: action.workspace.id,
          integrationId: 'twitter-v2',
          details: {
            endpoint: '/2/tweets',
            method: 'POST',
            data: {
              text: message
            }
          }
        })

        // Check if integration calling has errors
        checkIntegrationErrors(response, 'Twitter-v2')

        // Twitter response
        debugLogger('twitter-v2 response', response)

        const tweetId = response.output?.data?.id
        const tweetText = response.output?.data?.text

        if (tweetId && tweetText) {
          const tweet = {
            text: tweetText,
            id: tweetId
          }

          return `Message successfully posted on Twitter :
          Tweet: ${JSON.stringify(tweet, null, 2)}`
        }
      } catch (error) {
        await agent.markTaskAsErrored({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    debugLogger('action not implemented', action)

    return `Warning : use case not implemented yet.`
  }
})

agent.addCapability({
  name: 'twitterSearchPostsByUserId',
  description:
    'Retrieve the most recent tweets mentioning ticker(s) from a specific Twitter user ID, with detailed cryptocurrency informations related to the tickers attached to the tweets. If none of the tweets mention a ticker, the output will return empty.',
  schema: z.object({
    user_id: z.string().describe('Twitter User ID to fetch tweets'),
    max_results: z
      .number()
      .min(5, 'The minimum value for max_results is 5')
      .max(100, 'The maximum value for max_results is 100')
      .default(100)
      .describe('The maximum number of results (between 5 and 100)')
  }),
  async run({ args, action }) {
    if (isDoTaskAction(action)) {
      try {
        const user_id = args.user_id
        const max_results = args.max_results
        const endpointUrl = `2/users/${user_id}/tweets`

        const infoMessage = `Retrieving the ${max_results} latest tweets from the Twitter user with ID: ${user_id}`
        await agent.addLogToTask({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          severity: 'info',
          type: 'text',
          body: infoMessage
        })

        const response = await agent.callIntegration({
          workspaceId: action.workspace.id,
          integrationId: 'twitter-v2',
          details: {
            endpoint: endpointUrl,
            method: 'GET',
            params: {
              max_results: max_results
            }
          }
        })

        // Check if integration calling has errors
        checkIntegrationErrors(response, 'Twitter-v2')

        // Twitter response
        debugLogger('twitter-v2 response', response)

        // Tweets collection
        const collection = response.output.data
        if (!collection) {
          return `Warning: No tweets were found from Twitter user ID : "${user_id}"`
        }

        // Get all files already created in workspace
        const currentFiles = await agent.getFiles({
          workspaceId: action.workspace.id
        })

        // Initialiser le service
        const twitterAnalyserService = new TwitterAnalyserService()
        const tweetsWithTickerMentionCollection =
          twitterAnalyserService.filterTweetsWithTickerMention(collection)

        const createdFiles = []

        // Create a JSON file for each post and each ticker
        for (const tweet of tweetsWithTickerMentionCollection) {
          for (const ticker of tweet.tickers) {
            const token = normalizeToken(ticker)

            // Ignore posts that already have a corresponding file
            const path = `tweet_${tweet.post.id}_${token}.json`
            if (currentFiles.some((file: { path: string }) => file.path === path)) {
              continue
            }

            try {
              await agent.addLogToTask({
                workspaceId: action.workspace.id,
                taskId: action.task.id,
                severity: 'info',
                type: 'text',
                body: `Retrieve ${token} informations`
              })
              const data = await dexScreenerService.findTokenBySymbol(token)

              if (!data) {
                continue
              }

              tweet.path = `tweet_${tweet.post.id}_${token}.json`
              tweet.crypto = {
                ticker: token,
                name: data.name,
                website: data.links?.[0]?.url,
                summary: undefined,
                data
              }

              await agent.uploadFile({
                workspaceId: action.workspace.id,
                path: tweet.path,
                file: JSON.stringify(tweet, null, 2),
                skipSummarizer: true
                //taskIds: [action.task.id]
              })

              createdFiles.push(path)
            } catch (error) {
              debugLogger('Ticker info retrieving error', error)

              await agent.addLogToTask({
                workspaceId: action.workspace.id,
                taskId: action.task.id,
                severity: 'warning',
                type: 'text',
                body: `Retrieve ${token} informations error`
              })
            }
          }
        }

        debugLogger('tweetsWithTickerMentionCollection', tweetsWithTickerMentionCollection)

        // Extract and deduplicate tickers
        const allTickers = [
          ...new Set(
            tweetsWithTickerMentionCollection.flatMap((item: { tickers: string[] }) => item.tickers)
          )
        ]

        debugLogger('Ticker(s) found', allTickers)

        if (createdFiles.length > 0) {
          const files = JSON.stringify(createdFiles, null, 2)
          return `Tweets mentioning ticker(s) successfully retrieve from Twitter user ID : "${user_id}".
          Here is the list of files, one per tweet, each containing detailed cryptocurrency information (price, change, liquidity, volume, logo, links, socials, DEX and pairs) related to the mentioned ticker(s):
          ${files}`
        } else {
          return `Tweets successfully retrieve from Twitter user ID : "${user_id}" but no ticker(s) found.`
        }
      } catch (error) {
        debugLogger('Run() error', error)

        const ErrorMessage = error instanceof Error ? error.message : 'Unknown error'
        await agent.markTaskAsErrored({
          workspaceId: action.workspace.id,
          taskId: action.task.id,
          error: ErrorMessage
        })

        return `Tweets could not be retrieve from Twitter user ID ${args.user_id}.
        Errors : ${ErrorMessage}`
      }
    }

    debugLogger('action not implemented', action)

    return `Warning : use case not implemented yet.`
  }
})

agent.start()
