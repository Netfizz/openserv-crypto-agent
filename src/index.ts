import { z } from 'zod'
import { Agent } from '@openserv-labs/sdk'
import 'dotenv/config'
import {
  debugLogger,
  isDoTaskAction,
  normalizeToken,
  checkIntegrationErrors,
  cleanQueryParams
} from './helpers'
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
  name: 'twitterPostMessage',
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
  name: 'twitterGetUserTweetsWithTickerMentions',
  description:
    'Retrieve tweets mentioning ticker(s) from a specific Twitter user, with detailed cryptocurrency informations related to the tickers attached to the tweets. If none of the tweets mention a ticker, the output will return empty.',
  schema: z.object({
    user_id: z.string().optional().describe('Twitter user ID to fetch tweets'),
    username: z.string().optional().describe('Twitter username ID to fetch tweets'),
    max_results: z
      .number()
      .min(5, 'The minimum value for max_results is 5')
      .max(100, 'The maximum value for max_results is 100')
      .default(100)
      .describe('The maximum number of results (between 5 and 100)'),
    // The `start_time` query parameter value must be before the `end_time` query parameter value
    start_time: z
      .string()
      .datetime()
      .optional()
      .describe(
        'YYYY-MM-DDTHH:mm:ssZ. The oldest UTC timestamp from which the Posts will be provided.'
      ),
    end_time: z
      .string()
      .datetime()
      .optional()
      .describe(
        'YYYY-MM-DDTHH:mm:ssZ. The newest, most recent UTC timestamp to which the Posts will be provided.'
      ),

    // The `since_id` query parameter value must be less than the `until_id` query parameter value.
    since_id: z
      .string()
      .optional()
      .describe(
        'Returns results with a Post ID greater than (that is, more recent than) the specified ID.'
      ),
    until_id: z
      .string()
      .optional()
      .describe('Returns results with a Post ID less than (that is, older than) the specified ID.'),
    pagination_token: z
      .string()
      .optional()
      .describe("This parameter is used to get the next 'page' of results.")
  }),
  async run({ args, action }) {
    if (isDoTaskAction(action)) {
      try {
        // Init Twitter service
        const twitterAnalyserService = new TwitterAnalyserService(agent, action)

        let user_id = args.user_id

        debugLogger('args', args)

        if (args.user_id == null && args.username == null) {
          await this.requestHumanAssistance({
            workspaceId: action.workspace.id,
            taskId: action.task.id,
            type: 'text',
            question: 'Please provide a valid Twitter username or user id.'
          })
          return ''
        }

        // Twitter user lookup by username
        if (user_id == null && args.username) {
          user_id = await twitterAnalyserService.fetchUserIdByUsername(args.username)
        }

        const max_results = args.max_results

        // All Twitter Query params available
        const availableQueryParams = {
          max_results: args.max_results,
          pagination_token: args.pagination_token,
          start_time: args.start_time,
          end_time: args.end_time,
          since_id: args.since_id,
          until_id: args.until_id,
          expansions: [
            'article.cover_media',
            'article.media_entities',
            'attachments.media_keys',
            'attachments.media_source_tweet',
            'attachments.poll_ids',
            'author_id',
            'edit_history_tweet_ids',
            'entities.mentions.username',
            'geo.place_id',
            'in_reply_to_user_id',
            'entities.note.mentions.username',
            'referenced_tweets.id',
            'referenced_tweets.id.author_id'
          ].join(','), // Convertit l'array en string avec des virgules
          'tweet.fields': [
            'article',
            'attachments',
            'author_id',
            'card_uri',
            'community_id',
            //'context_annotations',
            'conversation_id',
            'created_at',
            //'display_text_range',
            //'edit_controls',
            //'edit_history_tweet_ids',
            'entities',
            'geo',
            'id',
            'in_reply_to_user_id',
            'lang',
            'media_metadata',
            'note_tweet',
            //'possibly_sensitive',
            'public_metrics',
            'referenced_tweets',
            'reply_settings',
            'scopes',
            'source',
            'text',
            'withheld'
          ].join(','),
          'media.fields': [
            'alt_text',
            'duration_ms',
            'height',
            'media_key',
            'non_public_metrics',
            'organic_metrics',
            'preview_image_url',
            'promoted_metrics',
            'public_metrics',
            'type',
            'url',
            'variants',
            'width'
          ].join(','),
          'poll.fields': [
            'duration_minutes',
            'end_datetime',
            'id',
            'options',
            'voting_status'
          ].join(','),
          'user.fields': [
            'affiliation',
            'connection_status',
            'created_at',
            'description',
            'entities',
            'id',
            'is_identity_verified',
            'location',
            'most_recent_tweet_id',
            'name',
            'parody',
            'pinned_tweet_id',
            'profile_banner_url',
            'profile_image_url',
            'protected',
            'public_metrics',
            'receives_your_dm',
            'subscription',
            'subscription_type',
            'url',
            'username',
            'verified',
            'verified_followers_count',
            'verified_type',
            'withheld'
          ].join(','),
          'place.fields': [
            'contained_within',
            'country',
            'country_code',
            'full_name',
            'geo',
            'id',
            'name',
            'place_type'
          ].join(',')
        }

        const queryParams = cleanQueryParams(availableQueryParams)

        // User Posts timeline by User ID
        // Returns a list of Posts authored by the provided User ID
        const endpointUrl = `2/users/${user_id}/tweets`

        debugLogger('endpointUrl', endpointUrl)
        debugLogger('queryParams', queryParams)

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
            params: queryParams
          }
        })

        // Check if integration calling has errors
        checkIntegrationErrors(response, 'Twitter-v2')

        // Twitter response
        debugLogger('twitter-v2 response', response.output)

        // Tweets collection
        const collection = response.output.data
        if (!collection) {
          return `Warning: No tweets were found from Twitter user ID : "${user_id}"`
        }

        // Get all files already created in workspace
        const currentFiles = await agent.getFiles({
          workspaceId: action.workspace.id
        })

        // Filters tweets
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
