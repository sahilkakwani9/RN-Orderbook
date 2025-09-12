import { OrderBookData, OrderBookUpdate } from '../services/websocket';

export interface ProcessedOrderBookEntry {
    price: number;
    quantity: number;
    total: number;
}

export interface ProcessedOrderBook {
    bids: ProcessedOrderBookEntry[];
    asks: ProcessedOrderBookEntry[];
    lastUpdateId: number;
    symbol: string;
}

export class OrderBookStore {
    private orderBook: Map<string, number> = new Map(); // price -> quantity
    private lastUpdateId = 0;
    private symbol = '';

    initializeFromSnapshot(snapshot: OrderBookData, symbol: string): ProcessedOrderBook {
        this.symbol = symbol;
        this.lastUpdateId = snapshot.lastUpdateId;
        this.orderBook.clear();

        // Initialize with snapshot data
        [...snapshot.bids, ...snapshot.asks].forEach(([price, quantity]) => {
            if (parseFloat(quantity) > 0) {
                this.orderBook.set(price, parseFloat(quantity));
            }
        });

        return this.getProcessedOrderBook();
    }

    updateFromWebSocket(update: OrderBookUpdate): ProcessedOrderBook | null {
        // Validate update sequence
        if (update.U <= this.lastUpdateId || update.u <= this.lastUpdateId) {
            return null; // Skip outdated update
        }

        // Apply bid updates
        update.b.forEach(([price, quantity]) => {
            const qty = parseFloat(quantity);
            if (qty === 0) {
                this.orderBook.delete(price);
            } else {
                this.orderBook.set(price, qty);
            }
        });

        // Apply ask updates
        update.a.forEach(([price, quantity]) => {
            const qty = parseFloat(quantity);
            if (qty === 0) {
                this.orderBook.delete(price);
            } else {
                this.orderBook.set(price, qty);
            }
        });

        this.lastUpdateId = update.u;
        return this.getProcessedOrderBook();
    }

    private getProcessedOrderBook(): ProcessedOrderBook {
        const entries = Array.from(this.orderBook.entries())
            .map(([price, quantity]) => ({
                price: parseFloat(price),
                quantity,
                total: 0, // Will be calculated below
            }));

        // Separate bids and asks based on current market
        const midPrice = this.calculateMidPrice(entries);

        const bids = entries
            .filter(entry => entry.price < midPrice)
            .sort((a, b) => b.price - a.price)
            .slice(0, 100); // Highest first

        const asks = entries
            .filter(entry => entry.price > midPrice)
            .sort((a, b) => a.price - b.price) // Lowest first
            .slice(0, 100);
        // Calculate cumulative totals
        let bidTotal = 0;
        bids.forEach(bid => {
            bidTotal += bid.quantity;
            bid.total = bidTotal;
        });

        let askTotal = 0;
        asks.forEach(ask => {
            askTotal += ask.quantity;
            ask.total = askTotal;
        });

        return {
            bids,
            asks,
            lastUpdateId: this.lastUpdateId,
            symbol: this.symbol,
        };
    }

    private calculateMidPrice(entries: { price: number; quantity: number }[]): number {
        if (entries.length === 0) return 0;

        const prices = entries.map(e => e.price).sort((a, b) => a - b);
        return prices[Math.floor(prices.length / 2)];
    }

    reset() {
        this.orderBook.clear();
        this.lastUpdateId = 0;
    }
}