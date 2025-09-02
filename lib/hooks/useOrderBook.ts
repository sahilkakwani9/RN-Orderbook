import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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

    // Get initial snapshot
    const { data: snapshot, isLoading, error: snapshotError } = useOrderBookSnapshot(symbol);

    useEffect(() => {
        if (!snapshot) return;

        const initializeOrderBook = async () => {
            try {
                // Initialize store with snapshot
                const initialOrderBook = storeRef.current.initializeFromSnapshot(snapshot, symbol);
                setOrderBook(initialOrderBook);

                // Connect WebSocket
                await binanceWsService.connect(symbol);
                setIsConnected(true);
                setError(null);

                // Subscribe to updates
                binanceWsService.subscribe(subscriptionIdRef.current, (update: OrderBookUpdate) => {
                    const updatedOrderBook = storeRef.current.updateFromWebSocket(update);
                    
                    if (updatedOrderBook) {
                        console.log("Updated order book");
                        
                        setOrderBook(updatedOrderBook);

                        // Update React Query cache
                        queryClient.setQueryData(['orderbook-live', symbol], updatedOrderBook);
                    }
                });

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to connect');
                setIsConnected(false);
            }
        };

        initializeOrderBook();

        return () => {
            binanceWsService.unsubscribe(subscriptionIdRef.current);
            binanceWsService.disconnect();
            setIsConnected(false);
        };
    }, [snapshot, symbol, queryClient]);

    // Handle snapshot errors
    useEffect(() => {
        if (snapshotError) {
            setError(snapshotError instanceof Error ? snapshotError.message : 'Failed to fetch snapshot');
        }
    }, [snapshotError]);

    return {
        orderBook,
        isLoading,
        isConnected,
        error,
        refetch: () => queryClient.invalidateQueries({ queryKey: ['orderbook-snapshot', symbol] }),
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