import {
  parseGarminConnectionStatusResult,
  parseGarminDisconnectResult,
  parseGarminStartResult,
  type GarminConnectionStatusResult,
  type GarminDisconnectResult,
  type GarminStartResult,
} from '../domain/garminConnection/contract'

export interface GarminConnectionTransport {
  start(): Promise<unknown>
  getStatus(): Promise<unknown>
  disconnect(): Promise<unknown>
}

export interface GarminConnectionClient {
  start(): Promise<GarminStartResult>
  getStatus(): Promise<GarminConnectionStatusResult>
  disconnect(): Promise<GarminDisconnectResult>
}

export function createGarminConnectionClient(
  transport: GarminConnectionTransport,
): GarminConnectionClient {
  return {
    async start() {
      return parseGarminStartResult(await transport.start())
    },
    async getStatus() {
      return parseGarminConnectionStatusResult(await transport.getStatus())
    },
    async disconnect() {
      return parseGarminDisconnectResult(await transport.disconnect())
    },
  }
}
