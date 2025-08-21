import {startBatchGeneration} from '../src/startBatchGeneration'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {fetchJson} from '../src/fetchJson'
import core from '@actions/core'

vi.mock('../src/fetchJson')
vi.mock('@actions/core')
vi.mock('@actions/github', () => ({
  default: vi.fn(),
  context: {
    issue: {
      number: 10
    },
    repo: {
      repo: 'some repo',
      owner: 'some owner'
    },
    ref: 'refs/pull/10/head',
    sha: 'abc123',
    payload: {
      pull_request: {
        title: 'Test PR Title',
        body: 'Test PR Description'
      }
    }
  }
}))

describe(startBatchGeneration.name, () => {
  beforeEach(() => {
    // Mock all required inputs with default values
    vi.mocked(core).getInput.mockImplementation((name: string) => {
      const defaults: Record<string, string> = {
        token: 'mock-token',
        testTargetId: 'mock-test-target-id',
        octomindBaseUrl: '',
        entrypointUrlPath: '',
        environmentId: '',
        prerequisiteId: '',
        baseUrl: ''
      }
      return defaults[name] || ''
    })

    vi.mocked(core).getBooleanInput.mockReturnValue(false)

    vi.mocked(core.summary.addHeading).mockReturnThis()
    vi.mocked(core.summary.addLink).mockReturnThis()
    vi.mocked(core.summary.write).mockResolvedValue(core.summary)

    vi.mocked(core.getMultilineInput).mockReturnValue([])
  })

  it('includes environment id if defined', async () => {
    const environmentId = 'mock-id'
    vi.mocked(core).getInput.mockReturnValue(environmentId)

    await startBatchGeneration()

    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST'
      })
    )

    const sentBody = JSON.parse(
      vi.mocked(fetchJson).mock.calls[0][0].body as string
    )

    expect(sentBody).toEqual(
      expect.objectContaining({
        environmentId
      })
    )
    expect(core.getInput).toHaveBeenCalledWith('environmentId')
  })

  it('sends a post request', async () => {
    await startBatchGeneration()

    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST'
      })
    )
    expect(fetchJson).toHaveBeenCalledTimes(1)
  })

  it('includes all core.getInput values in the POST request body', async () => {
    // Set specific values for all inputs
    vi.mocked(core).getInput.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        token: 'test-token-123',
        testTargetId: 'test-target-456',
        octomindBaseUrl: 'https://custom.octomind.dev',
        entrypointUrlPath: '/test-entrypoint',
        environmentId: 'env-789',
        prerequisiteId: 'prereq-101',
        baseUrl: 'https://example.com'
      }
      return values[name] || ''
    })

    await startBatchGeneration()

    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        token: 'test-token-123',
        url: expect.stringContaining('test-target-456')
      })
    )

    const sentBody = JSON.parse(
      vi.mocked(fetchJson).mock.calls[0][0].body as string
    )

    expect(sentBody).toEqual(
      expect.objectContaining({
        entrypointUrlPath: '/test-entrypoint',
        environmentId: 'env-789',
        prerequisiteId: 'prereq-101',
        baseUrl: 'https://example.com'
      })
    )
  })

  it('constructs prompt with PR title and description from github context', async () => {
    await startBatchGeneration()

    const sentBody = JSON.parse(
      vi.mocked(fetchJson).mock.calls[0][0].body as string
    )

    expect(sentBody.prompt).toContain('Test PR Title')
    expect(sentBody.prompt).toContain('Test PR Description')
  })

  it('uses default octomind URL when octomindBaseUrl is empty', async () => {
    vi.mocked(core).getInput.mockImplementation((name: string) => {
      if (name === 'octomindBaseUrl') return ''
      if (name === 'testTargetId') return 'test-id'
      if (name === 'token') return 'test-token'
      return ''
    })

    await startBatchGeneration()

    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('https://app.octomind.dev')
      })
    )
  })

  it('uses custom octomind URL when octomindBaseUrl is provided', async () => {
    const customUrl = 'https://custom.octomind.dev'
    vi.mocked(core).getInput.mockImplementation((name: string) => {
      if (name === 'octomindBaseUrl') return customUrl
      if (name === 'testTargetId') return 'test-id'
      if (name === 'token') return 'test-token'
      return ''
    })

    await startBatchGeneration()

    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(customUrl)
      })
    )
  })
})
