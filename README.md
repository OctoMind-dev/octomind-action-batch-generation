# octomind-action-batchgeneration

This is a GitHub Action to automatically generate Octomind end-to-end tests right from your CI.
To use this action a token is required, which you can generate in our [octomind app](https://app.octomind.dev).

See the [docs](https://octomind.dev/docs/run-tests/execution-curl#create-an-api-key) for more details.

> drop us a note: <contact@octomind.dev> 🐙

## Setup

1. Add the `OCTOMIND_API_KEY` to your repository secrets
2. Add the following yml snippet to your steps and insert a value for `baseUrl` pointing to a publicly accessible deployment of your branch.

```yml
- uses: OctoMind-dev/octomind-action-batchgeneration
  with:
    token: ${{ secrets.OCTOMIND_API_KEY }}
    testTargetId: <your testTargetId that you also get from us>
    baseUrl: <optional, publicly accessible url to your deployment, defaults to default environment's URL otherwise>,
    entrypointUrlPath: <optional, URL path to be used after your URL, e.g. /some/path>
    environmentId: <optional, id of the environment that should be discovered against>,
    prerequisiteId: <optional, id of the test case that should be run before batch generation>,
```
