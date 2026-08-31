import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Container } from '../container.js';
import type { CompiledRoute } from '../router.js';

export class ExecutionContext {
  constructor(
    readonly req: IncomingMessage,
    readonly res: ServerResponse,
    readonly url: URL,
    readonly container: Container,
    public match?: { route: CompiledRoute; pathParams: Record<string, string> },
    public body?: unknown,
  ) {}

  getRequest(): IncomingMessage {
    return this.req;
  }

  getClass(): unknown {
    return this.match?.route.controller;
  }

  getHandler(): string | undefined {
    return this.match?.route.handlerName;
  }
}
