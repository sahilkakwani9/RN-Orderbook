import { OrderBookData } from './websocket';

const BINANCE_BASE_URL = 'https://api.binance.com';

export interface TickerData {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    askPrice: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

export class BinanceApiService {
    private async request<T>(endpoint: string): Promise<T> {
        try {
            const response = await fetch(`${BINANCE_BASE_URL}${endpoint}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async getOrderBookSnapshot(symbol: string, limit: number = 100): Promise<OrderBookData> {
        return this.request<OrderBookData>(`/api/v3/depth?symbol=${symbol}&limit=${limit}`);
    }

    async getTicker24hr(symbol: string): Promise<TickerData> {
        return this.request<TickerData>(`/api/v3/ticker/24hr?symbol=${symbol}`);
    }

    async getCurrentPrice(symbol: string): Promise<{ symbol: string; price: string }> {
        return this.request<{ symbol: string; price: string }>(`/api/v3/ticker/price?symbol=${symbol}`);
    }

    async getExchangeInfo() {
        return this.request(`/api/v3/exchangeInfo`);
    }
}

export const binanceApi = new BinanceApiService();