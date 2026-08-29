/**
 * Page-world transport: subclass AbstractApiClient so unary + SSE downlinks
 * both ride doFetch. The custom protocol handles same-origin fetch.
 */
import { AbstractApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'

function doFetch(input: URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}

class ProtocolApiClient extends AbstractApiClient {
  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    return doFetch(input, init)
  }
}

function installTransport(): void {
  globalThis.__DSH_TRANSPORT__ = {
    createApiClient: () => new ProtocolApiClient(),
    fetch: doFetch,
  }
}

installTransport()

declare global {
  var __DSH_TRANSPORT__:
    | {
        createApiClient: () => ProtocolApiClient
        fetch: typeof doFetch
      }
    | undefined
}
