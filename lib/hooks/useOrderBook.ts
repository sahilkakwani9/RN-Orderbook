import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { binanceApi } from '../services/api';
import { binanceWsService, OrderBookUpdate } from '../services/websocket';
import { OrderBookStore, ProcessedOrderBook } from '../store/orderbookStore';

export const useOrderBookSnapshot = (symbol: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['orderbook-snapshot', symbol],
        queryFn: () => binanceApi.getOrderBookSnapshot(symbol, 100),
        enabled,
        staleTime: 5000, // Consider fresh for 5 seconds
        refetchInterval: false, // We'll use WebSocket for updates
    });
};

export const useTicker24hr = (symbol: string) => {
    return useQuery({
        queryKey: ['ticker-24hr', symbol],
        queryFn: () => binanceApi.getTicker24hr(symbol),
        refetchInterval: 5000, // Update every 5 seconds
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
            currentSymbolRef.current = symbol;
            subscriptionIdRef.current = `orderbook-${symbol}-${Date.now()}`;
            storeRef.current = new OrderBookStore(); // Create new store for new symbol
            setOrderBook(null); // Clear existing order book data
            setError(null);
        }
    }, [symbol]);

    // Get initial snapshot
    const { data: snapshot, isLoading, error: snapshotError, refetch } = useOrderBookSnapshot(symbol);

    const handleWebSocketUpdate = useCallback((update: OrderBookUpdate) => {
        // Ensure we only process updates for the current symbol
        if (update.s?.toUpperCase() !== currentSymbolRef.current.toUpperCase()) {
            console.warn(`Received update for ${update.s}, but current symbol is ${currentSymbolRef.current}`);
            return;
        }

        const updatedOrderBook = storeRef.current.updateFromWebSocket(update);

        if (updatedOrderBook) {
            console.log(`Updated order book for ${currentSymbolRef.current}`);
            setOrderBook(updatedOrderBook);

            // Update React Query cache
            queryClient.setQueryData(['orderbook-live', currentSymbolRef.current], updatedOrderBook);
        }
    }, [queryClient]);

    const initializeOrderBook = useCallback(async (snapshotData: any) => {
        if (isInitializingRef.current || !snapshotData) {
            return;
        }

        isInitializingRef.current = true;

        try {
            console.log(`Initializing order book for ${symbol}`);

            // Initialize store with snapshot
            const initialOrderBook = storeRef.current.initializeFromSnapshot(snapshotData, symbol);
            setOrderBook(initialOrderBook);

            // Connect WebSocket (this will disconnect any existing connection)
            await binanceWsService.connect(symbol);
            setIsConnected(true);
            setError(null);

            // Subscribe to updates
            binanceWsService.subscribe(subscriptionIdRef.current, handleWebSocketUpdate);

            console.log(`Successfully initialized order book for ${symbol}`);
        } catch (err) {
            console.error(`Failed to initialize order book for ${symbol}:`, err);
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

    // Cleanup function
    useEffect(() => {
        const currentSubscriptionId = subscriptionIdRef.current;

        return () => {
            console.log(`Cleaning up order book subscription for ${currentSymbolRef.current}`);
            binanceWsService.unsubscribe(currentSubscriptionId);

            // Only disconnect if this is the last subscription or if we're changing symbols
            if (binanceWsService.getCurrentSymbol() === currentSymbolRef.current) {
                binanceWsService.disconnect();
                setIsConnected(false);
            }
        };
    }, [symbol]); // Depend on symbol to cleanup when it changes

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
            console.log(`Refetching snapshot for ${symbol}`);
            return queryClient.invalidateQueries({ queryKey: ['orderbook-snapshot', symbol] });
        },
    };
};

export const useOrderBookLive = (symbol: string) => {
    return useQuery({
        queryKey: ['orderbook-live', symbol],
        queryFn: () => null, // Data comes from WebSocket
        enabled: false, // Never fetch, only updated by WebSocket
        staleTime: Infinity, // Never stale
    });
};