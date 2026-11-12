// Двійник @microsoft/signalr для компонентних тестів: тест сам «надсилає» подію хаба, обриває й відновлює зв'язок.

type Handler = (...args: unknown[]) => void;

class FakeConnection {
  readonly handlers = new Map<string, Handler>();
  reconnecting: Handler = () => {};
  reconnected: Handler = () => {};
  closed: Handler = () => {};
  stopped = false;

  constructor(
    readonly url: string,
    readonly options: { accessTokenFactory?: () => string },
  ) {}

  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  }

  onreconnecting(handler: Handler) {
    this.reconnecting = handler;
  }

  onreconnected(handler: Handler) {
    this.reconnected = handler;
  }

  onclose(handler: Handler) {
    this.closed = handler;
  }

  start(): Promise<void> {
    return hub.failStart ? Promise.reject(new Error('hub unavailable')) : Promise.resolve();
  }

  stop(): Promise<void> {
    this.stopped = true;
    return Promise.resolve();
  }
}

export const hub = {
  connections: [] as FakeConnection[],
  /** Хаб недоступний: клієнт має перейти на резервне опитування. */
  failStart: false,
  get current(): FakeConnection {
    return this.connections.filter((connection) => !connection.stopped).at(-1)!;
  },
  /** Сервер надіслав подію підключеному клієнту. */
  emit(event: string, payload?: unknown) {
    this.current.handlers.get(event)?.(payload);
  },
  reset() {
    this.connections = [];
    this.failStart = false;
  },
};

export class HubConnectionBuilder {
  private url = '';
  private options: { accessTokenFactory?: () => string } = {};

  withUrl(url: string, options: { accessTokenFactory?: () => string } = {}) {
    this.url = url;
    this.options = options;
    return this;
  }

  withAutomaticReconnect() {
    return this;
  }

  configureLogging() {
    return this;
  }

  build() {
    const connection = new FakeConnection(this.url, this.options);
    hub.connections.push(connection);
    return connection;
  }
}

export const LogLevel = { None: 6 };
