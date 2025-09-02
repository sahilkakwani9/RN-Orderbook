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
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private pingInterval: number | null = null;
    private callbacks: Map<string, (data: any) => void> = new Map();

    constructor() {
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
    }

    connect(symbol: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth@100ms`;
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
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('WebSocket closed:', event.code, event.reason);
                    this.stopPing();
                    this.handleReconnect(symbol);
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
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

    private handleReconnect(symbol: string) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

            setTimeout(() => {
                this.connect(symbol);
            }, delay);
        }
    }

    private startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
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
    }

    unsubscribe(id: string) {
        this.callbacks.delete(id);
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.callbacks.clear();
    }

    getConnectionState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }
}


export const binanceWsService = new BinanceWebSocketService();