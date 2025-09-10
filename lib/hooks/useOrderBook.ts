import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { binanceApi } from '../services/api';
import { binanceWsManager, OrderBookUpdate } from '../services/websocket';
import { OrderBookStore, ProcessedOrderBook } from '../store/orderbookStore';

export const useOrderBookSnapshot = (symbol: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['orderbook-snapshot', symbol],
        queryFn: () => binanceApi.getOrderBookSnapshot(symbol, 100),
        enabled,
        staleTime: 5000,
        refetchInterval: false,
    });
};

export const useTicker24hr = (symbol: string) => {
    return useQuery({
        queryKey: ['ticker-24hr', symbol],
        queryFn: () => binanceApi.getTicker24hr(symbol),
        refetchInterval: 5000,
        staleTime: 3000,
    });
};

export const useOrderBook = (symbol: string) => {
    const queryClient = useQueryClient();
    const [orderBook, setOrderBook] = useState<ProcessedOrderBook | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const storeRef = useRef<OrderBookStore>(new OrderBookStore());
    const subscriptionIdRef = useRef<string>(`orderbook-${symbol}-${Date.now()}`);
    const currentSymbolRef = useRef<string>(symbol);
    const isInitializingRef = useRef<boolean>(false);

    // Update refs when symbol changes
    useEffect(() => {
        if (currentSymbolRef.current !== symbol) {
            console.log(`🔄 Symbol changed from ${currentSymbolRef.current} to ${symbol}`);
            currentSymbolRef.current = symbol;
            subscriptionIdRef.current = `orderbook-${symbol}-${Date.now()}`;
            storeRef.current = new OrderBookStore();
            setOrderBook(null);
            setError(null);
        }
    }, [symbol]);

    const { data: snapshot, isLoading, error: snapshotError } = useOrderBookSnapshot(symbol);

    const handleWebSocketUpdate = useCallback((update: OrderBookUpdate) => {
        if (update.s?.toUpperCase() !== currentSymbolRef.current.toUpperCase()) {
            console.warn(`❌ Received update for ${update.s}, but current symbol is ${currentSymbolRef.current}`);
            return;
        }

        const updatedOrderBook = storeRef.current.updateFromWebSocket(update);

        if (updatedOrderBook) {
            setOrderBook(updatedOrderBook);
            queryClient.setQueryData(['orderbook-live', currentSymbolRef.current], updatedOrderBook);
        }
    }, [queryClient]);

    const initializeOrderBook = useCallback(async (snapshotData: any) => {
        if (isInitializingRef.current || !snapshotData) {
            return;
        }

        isInitializingRef.current = true;

        try {
            console.log(`🚀 Initializing order book for ${symbol}`);

            // Initialize store with snapshot
            const initialOrderBook = storeRef.current.initializeFromSnapshot(snapshotData, symbol);
            setOrderBook(initialOrderBook);

            // Get WebSocket connection for this symbol
            const connection = await binanceWsManager.getConnection(symbol);
            setIsConnected(true);
            setError(null);

            // Subscribe to updates
            connection.subscribe(subscriptionIdRef.current, handleWebSocketUpdate);

            console.log(`✅ Successfully initialized order book for ${symbol}`);
        } catch (err) {
            console.error(`❌ Failed to initialize order book for ${symbol}:`, err);
            setError(err instanceof Error ? err.message : 'Failed to connect');
            setIsConnected(false);
        } finally {
            isInitializingRef.current = false;
        }
    }, [symbol, handleWebSocketUpdate]);

    // Initialize order book when snapshot is available
    useEffect(() => {
        if (snapshot && symbol === currentSymbolRef.current) {
            initializeOrderBook(snapshot);
        }
    }, [snapshot, symbol, initializeOrderBook]);

    // Cleanup function - this is crucial for preventing ghost connections
    useEffect(() => {
        const currentSubscriptionId = subscriptionIdRef.current;
        const currentSymbol = symbol;

        return () => {
            console.log(`🧹 Cleaning up order book for ${currentSymbol}`);

            // Clean up previous symbol connection when symbol changes
            const cleanup = async () => {
                try {
                    // Disconnect the old symbol's connection completely
                    await binanceWsManager.disconnectSymbol(currentSymbol);
                    console.log(`✅ Disconnected WebSocket for ${currentSymbol}`);
                } catch (error) {
                    console.error(`❌ Error disconnecting ${currentSymbol}:`, error);
                }
            };

            cleanup();
            setIsConnected(false);
        };
    }, [symbol]);

    // Handle snapshot errors
    useEffect(() => {
        if (snapshotError) {
            setError(snapshotError instanceof Error ? snapshotError.message : 'Failed to fetch snapshot');
        }
    }, [snapshotError]);

    // Reset states when symbol changes
    useEffect(() => {
        setIsConnected(false);
        setError(null);
    }, [symbol]);

    return {
        orderBook,
        isLoading,
        isConnected,
        error,
        refetch: () => {
            console.log(`🔄 Refetching snapshot for ${symbol}`);
            return queryClient.invalidateQueries({ queryKey: ['orderbook-snapshot', symbol] });
        },
    };
};