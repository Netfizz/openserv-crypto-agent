import { Post, PostWithTickers } from './interfaces/twitter-analyser-interface'
import { debugLogger, isDoTaskAction } from '../helpers'
import { Agent } from '@openserv-labs/sdk'
import type { z } from 'zod'
import { actionSchema } from '@openserv-labs/sdk/dist/types'

export class TwitterAnalyserService {
  constructor(
    private agent: Agent,
    private action: z.infer<typeof actionSchema>
  ) {}

  /**
   * Twitter Id Finder lookup
   * @param username
   */
  public async fetchUserIdByUsername(username: string) {
    if (!isDoTaskAction(this.action)) return

    await this.agent.addLogToTask({
      workspaceId: this.action.workspace.id,
      taskId: this.action.task.id,
      severity: 'info',
      type: 'text',
      body: `Twitter user lookup by username : ${username}`
    })

    const response = await this.agent.callIntegration({
      workspaceId: this.action.workspace.id,
      integrationId: 'twitter-v2',
      details: {
        endpoint: `/2/users/by/username/${username}`,
        method: 'GET'
      }
    })

    if (response?.output?.data?.id) {
      debugLogger('User lookup by username', response)

      const user_id = response.output.data.id

      await this.agent.addLogToTask({
        workspaceId: this.action.workspace.id,
        taskId: this.action.task.id,
        severity: 'info',
        type: 'text',
        body: `${username} user id is : ${user_id}`
      })

      return user_id
    }

    throw new Error(`${username} user id not found`)
  }

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
