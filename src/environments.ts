type TestAccount = {
  username: string
  password: string
  otpInitializerKey: string
}

type BasicAuth = {
  username: string
  password: string
}

type PrivateLocation = {
  id: string
  name: string
  status: string
  type: string
}

type Environment = {
  id: string
  name: string
  testTargetId: string
  type: 'DEFAULT' | 'CUSTOM'
  discoveryUrl: string
  additionalHeaderFields: Record<string, string>
  testAccount: TestAccount
  basicAuth: BasicAuth
  enableCrossOriginIframes: boolean
  privateLocation: PrivateLocation
}

export const getEnvironmentByName = async (
  apiKey: string,
  testTargetId: string,
  name: string
): Promise<Environment | undefined> => {
  const baseUrl = 'https://app.octomind.dev/api/apiKey/v3'
  const response = await fetch(
    `${baseUrl}/test-targets/${testTargetId}/environments`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    }
  )
  if (!response.ok) {
    return undefined
  }
  const environments = await response.json()
  const defaultEnvironment = environments.find(
    (environment: Environment) => environment.name === name
  )
  return defaultEnvironment
}

export const getDefaultEnvironment = async (
  apiKey: string,
  testTargetId: string
): Promise<Environment | undefined> => {
  const baseUrl = 'https://app.octomind.dev/api/apiKey/v3'
  const response = await fetch(
    `${baseUrl}/test-targets/${testTargetId}/environments`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    }
  )
  if (!response.ok) {
    return undefined
  }
  const environments = await response.json()
  const defaultEnvironment = environments.find(
    (environment: Environment) => environment.type === 'DEFAULT'
  )
  return defaultEnvironment
}

export const createEnvironmentFromEnvironment = async (
  apiKey: string,
  testTargetId: string,
  environment: Environment
): Promise<Environment | undefined> => {
  const body = JSON.stringify({
    name: environment.name,
    testTargetId,
    type: 'CUSTOM',
    discoveryUrl: environment.discoveryUrl,
    additionalHeaderFields: environment.additionalHeaderFields,
    testAccount: environment.testAccount,
    basicAuth: environment.basicAuth,
    enableCrossOriginIframes: environment.enableCrossOriginIframes,
    privateLocation: environment.privateLocation
  })
  const baseUrl = 'https://app.octomind.dev/api/apiKey/v3'
  const response = await fetch(
    `${baseUrl}/test-targets/${testTargetId}/environments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body
    }
  )
  if (!response.ok) {
    return undefined
  }
  const data = await response.json()
  return data
}
