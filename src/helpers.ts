import { TypeOf } from 'zod'
import { actionSchema } from '@openserv-labs/sdk/dist/types'
type DoTaskAction = TypeOf<typeof actionSchema> & { type: 'do-task' }

export const debugLogger = (message: any, ...optionalParams: any[]) => {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(message, ...optionalParams)
  }
}

/**
 * Validates and checks integration response for errors.
 * @param response - The API response to check.
 * @param integrationName - The name of the integration (e.g., "Twitter-v2").
 * @throws Error if the response contains errors.
 */
export const checkIntegrationErrors = (response: any, integrationName: string): void => {
  // Parse the response output message if present
  let integrationCallingResponseMessage: any = null
  try {
    integrationCallingResponseMessage = response.output?.message
      ? JSON.parse(JSON.parse(response.output.message))
      : null
  } catch (error) {
    /* empty */
  }

  const statusCode = response?.statusCode
  let errorMessage = ''

  // Check if the status code indicates an error
  if (statusCode && statusCode >= 400 && statusCode < 600) {
    errorMessage += `${integrationName} responded with an error status code: ${statusCode}`

    if (integrationCallingResponseMessage?.detail) {
      errorMessage += `\n\nDetails:\n${integrationCallingResponseMessage?.detail}\n`
    }
  }

  // Check if the integration response contains specific errors
  if (integrationCallingResponseMessage?.errors) {
    const integrationCallingErrors = JSON.stringify(
      integrationCallingResponseMessage.errors,
      null,
      2
    )
    errorMessage += `\n\nDetails:\n${integrationCallingErrors}\n`
  }

  // Log and throw the error if any
  if (errorMessage) {
    debugLogger('errorMessage', errorMessage)
    debugLogger('response', response)

    throw new Error(errorMessage)
  }
}

/**
 * Check if OpenServ action param returned by SDK is a `do-task` type action
 * @param action
 */
export function isDoTaskAction(action: unknown): action is DoTaskAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    (action as { type?: string }).type === 'do-task'
  )
}

/**
 * Normalizes a token by transforming it to uppercase if it starts with '$'.
 * @param token - The token to normalize.
 * @returns The normalized token.
 */
export function normalizeToken(token: string): string {
  if (token.startsWith('$')) {
    return token.substring(1).toUpperCase()
  }
  return token
}
