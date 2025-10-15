// this import MUST be a namespace import, otherwise ncc doesn't think it needs to bundle this :)
// eslint-disable-next-line import/no-namespace
import * as core from '@actions/core'
// this import MUST be a namespace import, otherwise ncc doesn't think it needs to bundle this :)
// eslint-disable-next-line import/no-namespace
import * as github from '@actions/github'
import {fetchJson} from './fetchJson'
import {BatchGenerationResponse} from './types'

const DEFAULT_URL = 'https://app.octomind.dev'

const getBatchGenerationsApiUrl = (octomindUrl: string, testTargetId: string) =>
  `${octomindUrl}/api/apiKey/v3/test-targets/${testTargetId}/batch-generations`

export const getEmbeddedImagesFromPullRequest = (
  pullRequestBody: string
): string[] => {
  const imageUrls: string[] = []
  const imageRegex = /<img[^>]*src\s*=\s*["'](https?:\/\/[^\s'"]+)["'][^>]*>/g
  let match: RegExpExecArray | null = imageRegex.exec(pullRequestBody)

  while (match !== null) {
    imageUrls.push(match[1])
    match = imageRegex.exec(pullRequestBody)
  }

  return imageUrls
}

export const extractMarkdownLinks = (requestBody: string): string[] => {
  const links: string[] = []
  const linkRegex = /\[.*?\]\((https?:\/\/[^\s'"<>]+)\)/g
  let match: RegExpExecArray | null = linkRegex.exec(requestBody)

  while (match !== null) {
    links.push(match[1])
    match = linkRegex.exec(requestBody)
  }

  return links
}

export const getReadableTextContentFromPullLinks = async (
  pullRequestBody: string,
  timeoutMs = 5000,
  maxBytes = 4 * 1024
): Promise<string> => {
  const links = extractMarkdownLinks(pullRequestBody)
  const textContentPromises = links.map(async link => {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await globalThis.fetch(link, {signal: controller.signal})
      if (!response.ok) return ''

      // Prefer streaming read to enforce byte limit
      const body = response.body as ReadableStream<Uint8Array> | null
      if (body) {
        const reader = body.getReader()
        const decoder = new TextDecoder()
        let received = 0
        let result = ''
        let doneReading = false
        while (!doneReading) {
          const {value, done} = await reader.read()
          if (done) {
            doneReading = true
            break
          }
          if (!value) continue
          const remaining = maxBytes - received
          const chunk: Uint8Array =
            value instanceof Uint8Array ? value : new Uint8Array(value)
          const slice =
            remaining < chunk.byteLength ? chunk.subarray(0, remaining) : chunk
          result += decoder.decode(slice, {stream: true})
          received += slice.byteLength
          if (received >= maxBytes) {
            try {
              await reader.cancel()
            } catch (_e) {
              core.error('Failed to cancel reader')
            }
            break
          }
        }
        result += new TextDecoder().decode()
        return result
      }

      // Fallback: read all text and slice
      const text = await response.text()
      return text.slice(0, maxBytes)
    } catch {
      return ''
    } finally {
      globalThis.clearTimeout(timeout)
    }
  })

  return (await Promise.all(textContentPromises)).join('\n')
}

export const startBatchGeneration = async (): Promise<void> => {
  const urlOverride = core.getInput('octomindBaseUrl')
  const octomindUrl = urlOverride.length === 0 ? DEFAULT_URL : urlOverride

  const issueNumber = github.context.issue.number
  if (!issueNumber || issueNumber < 1) {
    core.warning(
      'issue.number variable (Pull Request ID) not available. ' +
        'Make sure you run this action in a workflow triggered by pull request ' +
        'if you expect a comment with the batch generation results on your PR'
    )
  }

  const context = {
    issueNumber,
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    ref: github.context.ref,
    sha: github.context.sha
  }

  const readableTextContentFromPRLinks =
    await getReadableTextContentFromPullLinks(
      github.context.payload.pull_request?.body || ''
    )

  const prompt = `The following title and description belong to a code change by the user. Create tests that ensure the described functionality works.
    
# TITLE 
${github.context.payload.pull_request?.title || 'No title provided'}

# DESCRIPTION
${github.context.payload.pull_request?.body || 'No description provided'}
${readableTextContentFromPRLinks.length > 0 ? `\n\n Additional information: ${readableTextContentFromPRLinks}` : ''}
`
  const embeddedImagesFromPullRequest = getEmbeddedImagesFromPullRequest(
    github.context.payload.pull_request?.body || ''
  )

  const token = core.getInput('token')
  if (token.length === 0) {
    core.setFailed('token is set to an empty string')
  }

  const testTargetId = core.getInput('testTargetId')
  if (testTargetId.length === 0) {
    core.setFailed('testTargetId is set to an empty string')
  }

  const entrypointUrlPath = core.getInput('entrypointUrlPath')
  const environmentId = core.getInput('environmentId')
  const prerequisiteId = core.getInput('prerequisiteId')
  const baseUrl = core.getInput('baseUrl')

  core.debug(
    JSON.stringify(
      {
        batchGenerationsApiUrl: getBatchGenerationsApiUrl(
          octomindUrl,
          testTargetId
        ),
        context
      },
      null,
      2
    )
  )

  const body = JSON.stringify({
    prompt,
    imageUrls: embeddedImagesFromPullRequest,
    ...(entrypointUrlPath.length > 0 && {entrypointUrlPath}),
    ...(environmentId.length > 0 && {environmentId}),
    ...(prerequisiteId.length > 0 && {prerequisiteId}),
    ...(baseUrl.length > 0 && {baseUrl}),
    context: {
      source: 'github',
      ...context
    }
  })

  core.debug(body)

  try {
    const batchGenerationResponse = await fetchJson<BatchGenerationResponse>({
      url: getBatchGenerationsApiUrl(octomindUrl, testTargetId),
      method: 'POST',
      token,
      body
    })

    const batchGenerationUrl = `${octomindUrl}/testtargets/${testTargetId}/batchgenerations/${batchGenerationResponse.batchGenerationId}`

    core.setOutput('batchGenerationUrl', batchGenerationUrl)
    await core.summary
      .addHeading('🐙 Octomind')
      .addLink('View your batch generation results', batchGenerationUrl)
      .write()
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(
        `unable to start batch generation:  ${
          typeof error.message === 'object'
            ? JSON.stringify({
                error: error.message
              })
            : error.message
        }`
      )
    } else {
      core.setFailed('unknown Error')
    }
  }
}
