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

  const prompt = `The following title and description belong to a code change by the user. Create tests that ensure the described functionality works.
    
# TITLE 
${github.context.payload.pull_request?.title || 'No title provided'}

# DESCRIPTION
${github.context.payload.pull_request?.body || 'No description provided'}
`

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
    imageUrls: [],
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
