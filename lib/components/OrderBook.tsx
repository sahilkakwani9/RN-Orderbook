import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useOrderBook, useTicker24hr } from '../hooks/useOrderBook';
import { ProcessedOrderBookEntry } from '../store/orderbookStore';

// Popular trading pairs
const TRADING_PAIRS = [
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'SOLUSDT',
    'XRPUSDT',
    'DOGEUSDT',
    'AVAXUSDT',
    'LINKUSDT',
];

interface OrderBookProps {
    initialSymbol?: string;
}

interface OrderBookRowProps {
    entry: ProcessedOrderBookEntry;
    type: 'bid' | 'ask';
    maxTotal: number;
}

interface PairDropdownProps {
    selectedPair: string;
    onPairSelect: (pair: string) => void;
}

const PairDropdown: React.FC<PairDropdownProps> = ({ selectedPair, onPairSelect }) => {
    const [isVisible, setIsVisible] = useState(false);

    const renderPairItem = ({ item }: { item: string }) => (
        <TouchableOpacity
            style={[
                styles.dropdownItem,
                item === selectedPair && styles.selectedDropdownItem
            ]}
            onPress={() => {
                onPairSelect(item);
                setIsVisible(false);
            }}
        >
            <Text style={[
                styles.dropdownItemText,
                item === selectedPair && styles.selectedDropdownItemText
            ]}>
                {item}
            </Text>
        </TouchableOpacity>
    );

    return (
        <>
            <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setIsVisible(true)}
            >
                <Text style={styles.dropdownText}>{selectedPair}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={isVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsVisible(false)}
                >
                    <View style={styles.dropdownModal}>
                        <Text style={styles.dropdownTitle}>Select Trading Pair</Text>
                        <FlatList
                            data={TRADING_PAIRS}
                            renderItem={renderPairItem}
                            keyExtractor={(item) => item}
                            style={styles.dropdownList}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const OrderBookRow: React.FC<OrderBookRowProps> = ({ entry, type, maxTotal }) => {
    const fillWidth = useSharedValue(0);

    useEffect(() => {
        const percentage = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
        fillWidth.value = withTiming(percentage, { duration: 300 });
    }, [entry.total, maxTotal]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            width: `${fillWidth.value}%`,
            backgroundColor:
                type === 'bid'
                    ? interpolateColor(
                        fillWidth.value,
                        [0, 100],
                        ['rgba(14,203,129,0)', 'rgba(14,203,129,0.15)']
                    )
                    : interpolateColor(
                        fillWidth.value,
                        [0, 100],
                        ['rgba(246,70,93,0)', 'rgba(246,70,93,0.15)']
                    ),
        };
    });

    return (
        <View style={styles.row}>
            <Animated.View style={[styles.fillBar, animatedStyle]} />
            <Text style={[styles.price, { color: type === 'bid' ? '#0ecb81' : '#f6465d' }]}>
                {entry.price.toFixed(2)}
            </Text>
            <Text style={styles.quantity}>{entry.quantity.toFixed(6)}</Text>
            <Text style={styles.total}>{entry.total.toFixed(6)}</Text>
        </View>
    );
};

export default OrderBookRow;

export const OrderBook: React.FC<OrderBookProps> = ({ initialSymbol = 'ETHUSDT' }) => {
    const [selectedPair, setSelectedPair] = useState(initialSymbol);
    const { orderBook, isLoading, isConnected, error } = useOrderBook(selectedPair);
    const { data: ticker } = useTicker24hr(selectedPair);

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
            {/* Pair Selection Dropdown */}
            <View style={styles.pairSelectorContainer}>
                <PairDropdown
                    selectedPair={selectedPair}
                    onPairSelect={setSelectedPair}
                />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.symbolText}>{selectedPair}</Text>
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
    pairSelectorContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2b3139',
    },
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#2b3139',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3e4149',
    },
    dropdownText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    dropdownArrow: {
        color: '#b7bdc6',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownModal: {
        backgroundColor: '#2b3139',
        borderRadius: 12,
        margin: 20,
        maxHeight: '70%',
        width: '80%',
        maxWidth: 300,
    },
    dropdownTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#3e4149',
    },
    dropdownList: {
        maxHeight: 400,
    },
    dropdownItem: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#3e414950',
    },
    selectedDropdownItem: {
        backgroundColor: '#f0b90b20',
    },
    dropdownItemText: {
        color: '#ffffff',
        fontSize: 16,
        textAlign: 'center',
    },
    selectedDropdownItemText: {
        color: '#f0b90b',
        fontWeight: '600',
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