import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useOrderBook, useTicker24hr } from '../hooks/useOrderBook';
import { ProcessedOrderBookEntry } from '../store/orderbookStore';

interface OrderBookProps {
    symbol: string;
}

interface OrderBookRowProps {
    bidEntry?: ProcessedOrderBookEntry;
    askEntry?: ProcessedOrderBookEntry;
    maxBidQuantity: number;
    maxAskQuantity: number;
}

const OrderBookRow: React.FC<OrderBookRowProps> = ({
    bidEntry,
    askEntry,
    maxBidQuantity,
    maxAskQuantity
}) => {
    const bidFillPercentage = bidEntry ? (bidEntry.quantity / maxBidQuantity) * 100 : 0;
    const askFillPercentage = askEntry ? (askEntry.quantity / maxAskQuantity) * 100 : 0;

    return (
        <View style={styles.row}>
            {/* Bid (Purchase) Side */}
            <View style={styles.sideContainer}>
                {bidEntry && (
                    <>
                        <Text style={styles.bidPrice}>
                            {bidEntry.price.toFixed(2)}
                        </Text>
                        <View style={styles.fillContainer}>
                            <View
                                style={[
                                    styles.bidFillBar,
                                    {
                                        width: `${bidFillPercentage}%`,
                                    }
                                ]}
                            />
                            <Text style={styles.bidQuantity}>
                                {bidEntry.quantity}
                            </Text>
                        </View>
                    </>
                )}
            </View>

            {/* Ask (Sale) Side */}
            <View style={styles.sideContainer}>
                {askEntry && (
                    <>
                        <View style={styles.fillContainer}>
                            <View
                                style={[
                                    styles.askFillBar,
                                    {
                                        width: `${askFillPercentage}%`,
                                    }
                                ]}
                            />
                            <Text style={styles.askQuantity}>
                                {askEntry.quantity}
                            </Text>
                        </View>
                        <Text style={styles.askPrice}>
                            {askEntry.price.toFixed(2)}
                        </Text>
                    </>
                )}
            </View>
        </View>
    );
};

export const OrderBookSideBySide: React.FC<OrderBookProps> = ({ symbol }) => {
    const { orderBook, isLoading, isConnected, error } = useOrderBook(symbol);
    const { data: ticker } = useTicker24hr(symbol);

    const { maxBidQuantity, maxAskQuantity, combinedEntries } = useMemo(() => {
        if (!orderBook) return { maxBidQuantity: 0, maxAskQuantity: 0, combinedEntries: [] };

        const maxBidQty = Math.max(...orderBook.bids.map(b => b.quantity), 0);
        const maxAskQty = Math.max(...orderBook.asks.map(a => a.quantity), 0);

        // Create combined entries for side-by-side display
        const maxLength = Math.max(orderBook.bids.length, orderBook.asks.length);
        const combined = [];

        for (let i = 0; i < maxLength; i++) {
            combined.push({
                bid: orderBook.bids[i] || null,
                ask: orderBook.asks[i] || null,
            });
        }

        return {
            maxBidQuantity: maxBidQty,
            maxAskQuantity: maxAskQty,
            combinedEntries: combined,
        };
    }, [orderBook]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f0b90b" />
                <Text style={styles.loadingText}>Loading Order Book...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Error: {error}</Text>
            </View>
        );
    }

    if (!orderBook) {
        return null;
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.symbolText}>{symbol}</Text>
                <View style={styles.connectionStatus}>
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? '#0ecb81' : '#f6465d' }]} />
                    <Text style={styles.statusText}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </Text>
                </View>
            </View>

            {/* Price Info */}
            {ticker && (
                <View style={styles.priceInfo}>
                    <Text style={styles.currentPrice}>${parseFloat(ticker.lastPrice).toLocaleString()}</Text>
                    <Text style={[
                        styles.priceChange,
                        { color: parseFloat(ticker.priceChangePercent) >= 0 ? '#0ecb81' : '#f6465d' }
                    ]}>
                        {parseFloat(ticker.priceChangePercent) >= 0 ? '+' : ''}
                        {parseFloat(ticker.priceChangePercent).toFixed(2)}%
                    </Text>
                </View>
            )}

            {/* Column Headers */}
            <View style={styles.columnHeaders}>
                <Text style={styles.purchaseHeader}>Purchase</Text>
                <Text style={styles.saleHeader}>Sale</Text>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {combinedEntries.map((entry, index) => (
                    <OrderBookRow
                        key={index}
                        bidEntry={entry.bid}
                        askEntry={entry.ask}
                        maxBidQuantity={maxBidQuantity}
                        maxAskQuantity={maxAskQuantity}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1e2329',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e2329',
    },
    loadingText: {
        color: '#ffffff',
        marginTop: 16,
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e2329',
        padding: 20,
    },
    errorText: {
        color: '#f6465d',
        fontSize: 16,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2b3139',
    },
    symbolText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        color: '#b7bdc6',
        fontSize: 12,
    },
    priceInfo: {
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#2b3139',
    },
    currentPrice: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    priceChange: {
        fontSize: 16,
        marginTop: 4,
        fontWeight: '600',
    },
    columnHeaders: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2b3139',
    },
    purchaseHeader: {
        color: '#0ecb81',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        textAlign: 'left',
    },
    saleHeader: {
        color: '#f6465d',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    scrollContainer: {
        flex: 1,
        paddingTop: 8,
    },
    row: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 2,
        minHeight: 36,
    },
    sideContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    fillContainer: {
        flex: 1,
        height: 32,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    bidFillBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#4ade80', // Green color matching the image
        borderRadius: 4,
    },
    askFillBar: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#ef4444', // Red color matching the image
        borderRadius: 4,
    },
    bidPrice: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '500',
        minWidth: 60,
        textAlign: 'left',
    },
    askPrice: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '500',
        minWidth: 60,
        textAlign: 'right',
    },
    bidQuantity: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        zIndex: 1,
    },
    askQuantity: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        zIndex: 1,
    },
});