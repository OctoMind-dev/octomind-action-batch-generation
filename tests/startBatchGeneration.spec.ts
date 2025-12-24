import {startBatchGeneration} from '../src/startBatchGeneration'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {fetchJson} from '../src/fetchJson'
import core from '@actions/core'
import {getEmbeddedImagesFromPullRequest, extractMarkdownLinks, getReadableTextContentFromPullLinks} from '../src/startBatchGeneration'
import * as github from '@actions/github'

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

describe("getReadableTextContentFromPullLinks", () => {
  it("returns an empty string if the pull request body is empty", async () => {
    const pullRequestBody = ''
    const result = await getReadableTextContentFromPullLinks(pullRequestBody)
    expect(result).toEqual('')
  })

  it("returns an empty string if the pull request body does not contain any links", async () => {
    const pullRequestBody = 'Test PR Description'
    const result = await getReadableTextContentFromPullLinks(pullRequestBody)
    expect(result).toEqual('')
  })

  it("returns the content of the links if the pull request body contains links", async () => {
    const pullRequestBody = 'Test PR Description with a link: [Test](https://example.com)'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Test Content'
      } as unknown as Response)
    )
    const result = await getReadableTextContentFromPullLinks(pullRequestBody)
    expect(result).toEqual('Test Content')
  })
})

describe("extractMarkdownLinks", () => {
  it("returns an empty array if the pull request body is empty", () => {
    const pullRequestBody = ''
    const result = extractMarkdownLinks(pullRequestBody)
    expect(result).toEqual([])
  })

  it("returns an empty array if the pull request body does not contain any links", () => {
    const pullRequestBody = 'Test PR Description'
    const result = extractMarkdownLinks(pullRequestBody)
    expect(result).toEqual([])
  })

  it("returns an array of links if the pull request body contains links", () => {
    const pullRequestBody = 'Test PR Description with a link: [Test](https://example.com)'
    const result = extractMarkdownLinks(pullRequestBody)
    expect(result).toEqual(['https://example.com'])
  })
})

describe("getEmbeddedImagesFromPullRequest", () => {
  it("returns an empty array if the pull request body is empty", () => {
    const pullRequestBody = ''
    const result = getEmbeddedImagesFromPullRequest(pullRequestBody)
    expect(result).toEqual([])
  })

  it("returns an empty array if the pull request body does not contain any images", () => {
    const pullRequestBody = 'Test PR Description'
    const result = getEmbeddedImagesFromPullRequest(pullRequestBody)
    expect(result).toEqual([])
  })

  it("returns an array of image URLs if the pull request body contains images", () => {
    const pullRequestBody = 'Test PR Description with an image: <img src="https://example.com/image.png">'
    const result = getEmbeddedImagesFromPullRequest(pullRequestBody)
    expect(result).toEqual(['https://example.com/image.png'])
  })

  it("returns an array of image URLs if the pull request body contains multiple images", () => {
    const pullRequestBody = 'Test PR Description with an image: <img src="https://example.com/image.png"> and another image: <img src="https://example.com/image2.png">'
    const result = getEmbeddedImagesFromPullRequest(pullRequestBody)
    expect(result).toEqual(['https://example.com/image.png', 'https://example.com/image2.png'])
  })

  it("returns an array of image URLs if the pull request body contains images with different attributes", () => {
    const pullRequestBody = 'Test PR Description with an image: <img width="100" height="100" src="https://example.com/image.png" alt="image"> and another image: <img src="https://example.com/image2.png" alt="image2" width="100" height="100">'
    const result = getEmbeddedImagesFromPullRequest(pullRequestBody)
    expect(result).toEqual(['https://example.com/image.png', 'https://example.com/image2.png'])
  })
})

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

  it('includes imageUrls extracted from PR description in the POST body', async () => {
    // Arrange PR body with two images
    (github.context.payload.pull_request as unknown as { body: string }).body =
      'Desc with images: <img src="https://example.com/img1.png" alt="1"> and <img width="100" src="https://example.com/img2.jpg">'

    await startBatchGeneration()

    const sentBody = JSON.parse(
      vi.mocked(fetchJson).mock.calls[0][0].body as string
    )

    expect(sentBody).toEqual(
      expect.objectContaining({
        imageUrls: [
          'https://example.com/img1.png',
          'https://example.com/img2.jpg'
        ]
      })
    )
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

  it('excludes optional parameters when they are empty strings', async () => {
    vi.mocked(core).getInput.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        token: 'test-token',
        octomindBaseUrl: '',
        entrypointUrlPath: '',
        environmentId: '',
        prerequisiteId: '',
        baseUrl: ''
      }
      return values[name] || ''
    })

    await startBatchGeneration()

    const sentBody = JSON.parse(
      vi.mocked(fetchJson).mock.calls[0][0].body as string
    )

    expect(sentBody).not.toHaveProperty('entrypointUrlPath')
    expect(sentBody).not.toHaveProperty('environmentId')
    expect(sentBody).not.toHaveProperty('prerequisiteId')
    expect(sentBody).not.toHaveProperty('baseUrl')

    expect(sentBody).toHaveProperty('prompt')
    expect(sentBody).toHaveProperty('imageUrls')
    expect(sentBody).toHaveProperty('context')
  })
  it('includes guessDependency when true', async () => {
    vi.mocked(core).getBooleanInput.mockImplementation((name: string) => {
      if (name === 'guessDependency') return true
      return false
    })

    await startBatchGeneration()

    const sentBody = JSON.parse(
      vi.mocked(fetchJson).mock.calls[0][0].body as string
    )

    expect(sentBody).toHaveProperty('guessDependency', true)
  })
})
