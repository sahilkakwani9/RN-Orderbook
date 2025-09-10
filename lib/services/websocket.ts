export interface OrderBookData {
    lastUpdateId: number;
    bids: [string, string][]; // [price, quantity]
    asks: [string, string][];
}

export interface OrderBookUpdate {
    e: string; // Event type
    E: number; // Event time
    s: string; // Symbol
    U: number; // First update ID
    u: number; // Final update ID
    b: [string, string][]; // Bids to be updated
    a: [string, string][]; // Asks to be updated
}

export class BinanceWebSocketService {
    private ws: WebSocket | null = null;
    private currentSymbol: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private pingInterval: number | null = null;
    private callbacks: Map<string, (data: any) => void> = new Map();
    private reconnectTimeoutId: number | null = null;

    constructor() {
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
    }

    async connect(symbol: string): Promise<void> {
        // If we're already connected to this symbol, don't reconnect
        if (this.currentSymbol === symbol && this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`Already connected to ${symbol}`);
            return Promise.resolve();
        }

        // Clean up existing connection first
        await this.disconnect();

        this.currentSymbol = symbol;

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth@100ms`;
                console.log(`Connecting to WebSocket for ${symbol}: ${wsUrl}`);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log(`WebSocket connected for ${symbol}`);
                    this.reconnectAttempts = 0;
                    this.startPing();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        // Verify the message is for the current symbol to prevent race conditions
                        if (data.s && data.s.toUpperCase() === this.currentSymbol?.toUpperCase()) {
                            this.handleMessage(data);
                        } else {
                            console.warn(`Received message for different symbol: ${data.s}, expected: ${this.currentSymbol}`);
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log(`WebSocket closed for ${this.currentSymbol}:`, event.code, event.reason);
                    this.stopPing();

                    // Only attempt reconnect if we weren't deliberately disconnecting
                    if (event.code !== 1000 && this.currentSymbol === symbol) {
                        this.handleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error(`WebSocket error for ${symbol}:`, error);
                    reject(error);
                };

                // Set a timeout for connection
                const connectionTimeout = setTimeout(() => {
                    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                        this.ws.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);

                // Clear timeout on successful connection
                const originalOnOpen = this.ws.onopen;
                this.ws.onopen = (event) => {
                    clearTimeout(connectionTimeout);
                    if (originalOnOpen) originalOnOpen.call(this.ws!, event);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    private handleMessage(data: OrderBookUpdate) {
        // Notify all subscribers
        this.callbacks.forEach((callback) => {
            callback(data);
        });
    }

    private handleReconnect() {
        // Clear any existing reconnect timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentSymbol) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

            console.log(`Attempting to reconnect to ${this.currentSymbol} in ${delay}ms (attempt ${this.reconnectAttempts})`);

            this.reconnectTimeoutId = setTimeout(() => {
                if (this.currentSymbol) {
                    this.connect(this.currentSymbol).catch(error => {
                        console.error(`Reconnection failed for ${this.currentSymbol}:`, error);
                    });
                }
            }, delay);
        } else {
            console.error(`Max reconnection attempts reached for ${this.currentSymbol}`);
        }
    }

    private startPing() {
        this.stopPing(); // Clear any existing ping interval

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Use a simple ping frame if available, otherwise send a small message
                try {
                    if (typeof this.ws.ping === 'function') {
                        this.ws.ping();
                    }
                } catch (error) {
                    console.warn('Ping failed:', error);
                }
            }
        }, 30000); // Ping every 30 seconds
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    subscribe(id: string, callback: (data: OrderBookUpdate) => void) {
        this.callbacks.set(id, callback);
        console.log(`Subscribed ${id} to ${this.currentSymbol}`);
    }

    unsubscribe(id: string) {
        this.callbacks.delete(id);
        console.log(`Unsubscribed ${id}`);
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve) => {
            this.stopPing();

            // Clear reconnect timeout
            if (this.reconnectTimeoutId) {
                clearTimeout(this.reconnectTimeoutId);
                this.reconnectTimeoutId = null;
            }

            if (this.ws) {
                const wasOpen = this.ws.readyState === WebSocket.OPEN;

                if (wasOpen) {
                    // Set up a one-time close handler for this disconnect
                    const originalOnClose = this.ws.onclose;
                    this.ws.onclose = (event) => {
                        console.log(`WebSocket disconnected cleanly for ${this.currentSymbol}`);
                        resolve();
                    };

                    this.ws.close(1000, 'Normal closure'); // Use normal closure code
                } else {
                    this.ws = null;
                    resolve();
                }

                // Fallback timeout in case close doesn't fire
                setTimeout(() => {
                    this.ws = null;
                    resolve();
                }, 1000);
            } else {
                resolve();
            }

            this.currentSymbol = null;
            this.reconnectAttempts = 0;
            this.callbacks.clear();
        });
    }

    getCurrentSymbol(): string | null {
        return this.currentSymbol;
    }

    getConnectionState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }
}

export const binanceWsService = new BinanceWebSocketService();