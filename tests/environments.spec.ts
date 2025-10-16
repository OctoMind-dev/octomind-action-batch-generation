import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
  createEnvironmentFromEnvironment,
  getDefaultEnvironment,
  getEnvironmentByName
} from '../src/environments'

const API_KEY = 'test-api-key'
const TEST_TARGET_ID = 'test-target-id'
const BASE_URL = 'https://app.octomind.dev/api/apiKey/v3'

const sampleEnv = {
  id: 'env-1',
  name: 'DEFAULT',
  testTargetId: TEST_TARGET_ID,
  type: 'DEFAULT' as const,
  discoveryUrl: 'https://example.com',
  additionalHeaderFields: { Authorization: 'Bearer token' },
  testAccount: { username: 'u', password: 'p', otpInitializerKey: 'otp' },
  basicAuth: { username: 'bu', password: 'bp' },
  enableCrossOriginIframes: true,
  privateLocation: { id: 'pl-1', name: 'pl', status: 'active', type: 'edge' }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe(getEnvironmentByName.name, () => {
  it('returns undefined when fetch is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false } as unknown as Response)
    )

    const res = await getEnvironmentByName(API_KEY, TEST_TARGET_ID, 'ANY')
    expect(res).toBeUndefined()
  })

  it('returns the environment matching the provided name', async () => {
    const envs = [
      { ...sampleEnv, name: 'OTHER' },
      { ...sampleEnv, id: 'env-2', name: 'MATCH', type: 'CUSTOM' as const }
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => envs
      } as unknown as Response)
    )

    const res = await getEnvironmentByName(API_KEY, TEST_TARGET_ID, 'MATCH')
    expect(res).toEqual(envs[1])

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `${BASE_URL}/test-targets/${TEST_TARGET_ID}/environments`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-api-key': API_KEY })
      })
    )
  })

  it('returns undefined when no environment matches the name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ ...sampleEnv, name: 'OTHER' }]
      } as unknown as Response)
    )

    const res = await getEnvironmentByName(API_KEY, TEST_TARGET_ID, 'MISSING')
    expect(res).toBeUndefined()
  })
})

describe(getDefaultEnvironment.name, () => {
  it('returns undefined when fetch is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false } as unknown as Response)
    )

    const res = await getDefaultEnvironment(API_KEY, TEST_TARGET_ID)
    expect(res).toBeUndefined()
  })

  it("returns the environment with type 'DEFAULT'", async () => {
    const envs = [
      { ...sampleEnv, id: 'env-2', name: 'OTHER', type: 'CUSTOM' as const },
      { ...sampleEnv, id: 'env-3', name: 'DEFAULT', type: 'DEFAULT' as const }
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => envs
      } as unknown as Response)
    )

    const res = await getDefaultEnvironment(API_KEY, TEST_TARGET_ID)
    expect(res).toEqual(envs[1])
  })
})

describe(createEnvironmentFromEnvironment.name, () => {
  it('returns undefined when POST is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false } as unknown as Response)
    )

    const res = await createEnvironmentFromEnvironment(
      API_KEY,
      TEST_TARGET_ID,
      { ...sampleEnv, type: 'CUSTOM' }
    )
    expect(res).toBeUndefined()
  })

  it('sends POST with correct URL, headers and body and returns parsed data', async () => {
    const returned = { ...sampleEnv, id: 'new-id', name: 'NEW' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => returned
      } as unknown as Response)
    )

    const res = await createEnvironmentFromEnvironment(
      API_KEY,
      TEST_TARGET_ID,
      { ...sampleEnv, name: 'NEW', type: 'CUSTOM' }
    )

    expect(res).toEqual(returned)

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `${BASE_URL}/test-targets/${TEST_TARGET_ID}/environments`,
      expect.objectContaining({ method: 'POST' })
    )

    const call = vi.mocked(fetch).mock.calls[0]
    const options = call[1] as RequestInit
    expect(options.headers).toEqual(
      expect.objectContaining({ 'x-api-key': API_KEY, 'Content-Type': 'application/json' })
    )

    const body = JSON.parse(options.body as string)
    expect(body).toEqual(
      expect.objectContaining({
        name: 'NEW',
        testTargetId: TEST_TARGET_ID,
        type: 'CUSTOM',
        discoveryUrl: sampleEnv.discoveryUrl,
        additionalHeaderFields: sampleEnv.additionalHeaderFields,
        testAccount: sampleEnv.testAccount,
        basicAuth: sampleEnv.basicAuth,
        enableCrossOriginIframes: sampleEnv.enableCrossOriginIframes,
        privateLocation: sampleEnv.privateLocation
      })
    )
  })
})

