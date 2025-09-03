import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useOrderBook, useTicker24hr } from '../hooks/useOrderBook';
import { ProcessedOrderBookEntry } from '../store/orderbookStore';

interface OrderBookProps {
    symbol: string;
}

interface OrderBookRowProps {
    entry: ProcessedOrderBookEntry;
    type: 'bid' | 'ask';
    maxTotal: number;
}

const OrderBookRow: React.FC<OrderBookRowProps> = ({ entry, type, maxTotal }) => {
    const fillPercentage = (entry.total / maxTotal) * 100;

    return (
        <View style={styles.row}>
            <View
                style={[
                    styles.fillBar,
                    {
                        width: `${fillPercentage}%`,
                        backgroundColor: type === 'bid' ? '#0ecb8126' : '#f6465d26'
                    }
                ]}
            />
            <Text style={[styles.price, { color: type === 'bid' ? '#0ecb81' : '#f6465d' }]}>
                {entry.price.toFixed(2)}
            </Text>
            <Text style={styles.quantity}>{entry.quantity.toFixed(6)}</Text>
            <Text style={styles.total}>{entry.total.toFixed(6)}</Text>
        </View>
    );
};

export const OrderBook: React.FC<OrderBookProps> = ({ symbol }) => {
    const { orderBook, isLoading, isConnected, error } = useOrderBook(symbol);
    const { data: ticker } = useTicker24hr(symbol);

    const { maxBidTotal, maxAskTotal } = useMemo(() => {
        if (!orderBook) return { maxBidTotal: 0, maxAskTotal: 0 };

        return {
            maxBidTotal: Math.max(...orderBook.bids.map(b => b.total), 0),
            maxAskTotal: Math.max(...orderBook.asks.map(a => a.total), 0),
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
                <Text style={styles.headerText}>Price</Text>
                <Text style={styles.headerText}>Quantity</Text>
                <Text style={styles.headerText}>Total</Text>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Asks (Sell Orders) - Highest first */}
                <View style={styles.asksSection}>
                    {orderBook.asks.slice().reverse().map((ask, index) => (
                        <OrderBookRow
                            key={`ask-${ask.price}`}
                            entry={ask}
                            type="ask"
                            maxTotal={maxAskTotal}
                        />
                    ))}
                </View>

                {/* Spread */}
                <View style={styles.spreadContainer}>
                    <Text style={styles.spreadText}>
                        Spread: ${(orderBook.asks[0]?.price - orderBook.bids[0]?.price).toFixed(2)}
                    </Text>
                </View>

                {/* Bids (Buy Orders) */}
                <View style={styles.bidsSection}>
                    {orderBook.bids.map((bid, index) => (
                        <OrderBookRow
                            key={`bid-${bid.price}`}
                            entry={bid}
                            type="bid"
                            maxTotal={maxBidTotal}
                        />
                    ))}
                </View>
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
        justifyContent: 'space-around',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2b3139',
    },
    headerText: {
        color: '#b7bdc6',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    scrollContainer: {
        flex: 1,
    },
    asksSection: {
        paddingTop: 8,
    },
    bidsSection: {
        paddingBottom: 8,
    },
    spreadContainer: {
        paddingVertical: 16,
        alignItems: 'center',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#2b3139',
        marginVertical: 8,
    },
    spreadText: {
        color: '#b7bdc6',
        fontSize: 14,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 16,
        position: 'relative',
        minHeight: 32,
    },
    fillBar: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 0,
    },
    price: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        zIndex: 1,
    },
    quantity: {
        color: '#ffffff',
        fontSize: 14,
        flex: 1,
        textAlign: 'center',
        zIndex: 1,
    },
    total: {
        color: '#b7bdc6',
        fontSize: 14,
        flex: 1,
        textAlign: 'center',
        zIndex: 1,
    },
});