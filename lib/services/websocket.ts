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

class SymbolWebSocketConnection {
    private ws: WebSocket | null = null;
    private symbol: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private pingInterval: number | null = null;
    private callbacks: Map<string, (data: any) => void> = new Map();
    private reconnectTimeoutId: number | null = null;
    private isConnecting = false;
    private isDisconnecting = false;

    constructor(symbol: string) {
        this.symbol = symbol;
    }

    async connect(): Promise<void> {
        if (this.isConnecting || this.isDisconnecting) {
            console.log(`Connection already in progress for ${this.symbol}`);
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`Already connected to ${this.symbol}`);
            return;
        }

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `wss://stream.binance.com:9443/ws/${this.symbol.toLowerCase()}@depth@100ms`;
                console.log(`Connecting to WebSocket for ${this.symbol}: ${wsUrl}`);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log(`✅ WebSocket connected for ${this.symbol}`);
                    this.reconnectAttempts = 0;
                    this.isConnecting = false;
                    this.startPing();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        // Double-check symbol match
                        if (data.s && data.s.toUpperCase() === this.symbol.toUpperCase()) {
                            this.handleMessage(data);
                        }
                    } catch (error) {
                        console.error(`Error parsing WebSocket message for ${this.symbol}:`, error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log(`🔌 WebSocket closed for ${this.symbol}:`, event.code, event.reason);
                    this.isConnecting = false;
                    this.stopPing();

                    // Only attempt reconnect if we weren't deliberately disconnecting
                    if (!this.isDisconnecting && event.code !== 1000) {
                        this.handleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error(`❌ WebSocket error for ${this.symbol}:`, error);
                    this.isConnecting = false;
                    reject(error);
                };

                // Connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                        this.ws.close();
                        this.isConnecting = false;
                        reject(new Error(`WebSocket connection timeout for ${this.symbol}`));
                    }
                }, 10000);

                // Clear timeout on successful connection
                const originalOnOpen = this.ws.onopen;
                this.ws.onopen = (event) => {
                    clearTimeout(connectionTimeout);
                    if (originalOnOpen) originalOnOpen.call(this.ws!, event);
                };

            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    private handleMessage(data: OrderBookUpdate) {
        this.callbacks.forEach((callback) => {
            callback(data);
        });
    }

    private handleReconnect() {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isDisconnecting) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

            console.log(`🔄 Attempting to reconnect to ${this.symbol} in ${delay}ms (attempt ${this.reconnectAttempts})`);

            this.reconnectTimeoutId = setTimeout(() => {
                if (!this.isDisconnecting) {
                    this.connect().catch(error => {
                        console.error(`Reconnection failed for ${this.symbol}:`, error);
                    });
                }
            }, delay);
        }
    }

    private startPing() {
        this.stopPing();

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    if (typeof this.ws.ping === 'function') {
                        this.ws.ping();
                    }
                } catch (error) {
                    console.warn(`Ping failed for ${this.symbol}:`, error);
                }
            }
        }, 30000);
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    subscribe(id: string, callback: (data: OrderBookUpdate) => void) {
        this.callbacks.set(id, callback);
        console.log(`📡 Subscribed ${id} to ${this.symbol}`);
    }

    unsubscribe(id: string) {
        this.callbacks.delete(id);
        console.log(`📡 Unsubscribed ${id} from ${this.symbol}`);
    }

    async disconnect(): Promise<void> {
        if (this.isDisconnecting) {
            return;
        }

        this.isDisconnecting = true;
        console.log(`🔌 Disconnecting WebSocket for ${this.symbol}`);

        return new Promise((resolve) => {
            this.stopPing();

            if (this.reconnectTimeoutId) {
                clearTimeout(this.reconnectTimeoutId);
                this.reconnectTimeoutId = null;
            }

            if (this.ws) {
                const currentWs = this.ws;

                // Remove event listeners to prevent interference
                currentWs.onopen = null;
                currentWs.onmessage = null;
                currentWs.onerror = null;
                currentWs.onclose = () => {
                    console.log(`✅ WebSocket successfully disconnected for ${this.symbol}`);
                    this.isDisconnecting = false;
                    resolve();
                };

                if (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING) {
                    currentWs.close(1000, 'Normal closure');
                } else {
                    this.isDisconnecting = false;
                    resolve();
                }

                // Fallback timeout
                setTimeout(() => {
                    this.isDisconnecting = false;
                    resolve();
                }, 1000);
            } else {
                this.isDisconnecting = false;
                resolve();
            }

            this.ws = null;
            this.reconnectAttempts = 0;
            this.callbacks.clear();
        });
    }

    getCallbackCount(): number {
        return this.callbacks.size;
    }

    getConnectionState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }

    getSymbol(): string {
        return this.symbol;
    }
}

export class BinanceWebSocketManager {
    private connections: Map<string, SymbolWebSocketConnection> = new Map();

    async getConnection(symbol: string): Promise<SymbolWebSocketConnection> {
        const upperSymbol = symbol.toUpperCase();

        if (!this.connections.has(upperSymbol)) {
            console.log(`📱 Creating new WebSocket connection for ${upperSymbol}`);
            this.connections.set(upperSymbol, new SymbolWebSocketConnection(upperSymbol));
        }

        const connection = this.connections.get(upperSymbol)!;

        // Ensure connection is established
        if (connection.getConnectionState() !== WebSocket.OPEN) {
            await connection.connect();
        }

        return connection;
    }

    async disconnectSymbol(symbol: string): Promise<void> {
        const upperSymbol = symbol.toUpperCase();
        const connection = this.connections.get(upperSymbol);

        if (connection) {
            console.log(`🗑️ Disconnecting and removing connection for ${upperSymbol}`);
            await connection.disconnect();
            this.connections.delete(upperSymbol);
        }
    }

    async disconnectAll(): Promise<void> {
        console.log(`🗑️ Disconnecting all WebSocket connections`);
        const disconnectPromises = Array.from(this.connections.values()).map(conn => conn.disconnect());
        await Promise.all(disconnectPromises);
        this.connections.clear();
    }

    getActiveConnections(): string[] {
        return Array.from(this.connections.keys());
    }
}

// Singleton instance
export const binanceWsManager = new BinanceWebSocketManager();