import { LegendList } from "@legendapp/list";
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

// Row count options
const ROW_COUNT_OPTIONS = [5, 10, 20, 50, 100];

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

interface RowCountSelectorProps {
    selectedCount: number;
    onCountSelect: (count: number) => void;
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

const RowCountSelector: React.FC<RowCountSelectorProps> = ({ selectedCount, onCountSelect }) => {
    const [isVisible, setIsVisible] = useState(false);

    const renderCountItem = ({ item }: { item: number }) => (
        <TouchableOpacity
            style={[
                styles.dropdownItem,
                item === selectedCount && styles.selectedDropdownItem
            ]}
            onPress={() => {
                onCountSelect(item);
                setIsVisible(false);
            }}
        >
            <Text style={[
                styles.dropdownItemText,
                item === selectedCount && styles.selectedDropdownItemText
            ]}>
                {item} rows
            </Text>
        </TouchableOpacity>
    );

    return (
        <>
            <TouchableOpacity
                style={[styles.dropdown, styles.rowCountDropdown]}
                onPress={() => setIsVisible(true)}
            >
                <Text style={styles.dropdownText}>{selectedCount}</Text>
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
                        <Text style={styles.dropdownTitle}>Rows per side</Text>
                        <FlatList
                            data={ROW_COUNT_OPTIONS}
                            renderItem={renderCountItem}
                            keyExtractor={(item) => item.toString()}
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
    const [rowCount, setRowCount] = useState(20); // Default to 20 rows per side
    const { orderBook, isLoading, isConnected, error } = useOrderBook(selectedPair);
    const { data: ticker } = useTicker24hr(selectedPair);

    const { maxBidTotal, maxAskTotal, displayBids, displayAsks } = useMemo(() => {
        if (!orderBook) return { maxBidTotal: 0, maxAskTotal: 0, displayBids: [], displayAsks: [] };

        // Limit the number of rows displayed
        const displayBids = orderBook.bids.slice(0, rowCount);
        const displayAsks = orderBook.asks.slice(0, rowCount);

        return {
            maxBidTotal: Math.max(...displayBids.map(b => b.total), 0),
            maxAskTotal: Math.max(...displayAsks.map(a => a.total), 0),
            displayBids,
            displayAsks,
        };
    }, [orderBook, rowCount]);

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
            {/* Controls Row */}
            <View style={styles.controlsContainer}>
                <View style={styles.pairSelectorContainer}>
                    <PairDropdown
                        selectedPair={selectedPair}
                        onPairSelect={setSelectedPair}
                    />
                </View>
                <View style={styles.rowCountContainer}>
                    <Text style={styles.rowCountLabel}>Rows:</Text>
                    <RowCountSelector
                        selectedCount={rowCount}
                        onCountSelect={setRowCount}
                    />
                </View>
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
                    <LegendList
                        data={displayAsks.slice().reverse()}
                        renderItem={({ item }) => (
                            <OrderBookRow
                                entry={item}
                                type="ask"
                                maxTotal={maxAskTotal}
                            />
                        )}
                        keyExtractor={(item) => `ask-${item.price}`}
                        showsVerticalScrollIndicator={false}
                        maintainVisibleContentPosition
                    />

                </View>

                {/* Spread */}
                <View style={styles.spreadContainer}>
                    <Text style={styles.spreadText}>
                        Spread: ${(orderBook.asks[0]?.price - orderBook.bids[0]?.price).toFixed(2)}
                    </Text>
                </View>

                {/* Bids (Buy Orders) */}
                <View style={styles.bidsSection}>
                    <LegendList
                        data={displayBids}
                        renderItem={({ item }) => (
                            <OrderBookRow
                                key={`bid-${item.price}`}
                                entry={item}
                                type="bid"
                                maxTotal={maxBidTotal}
                            />
                        )}
                        keyExtractor={(item) => `bid-${item.price}`}
                        showsVerticalScrollIndicator={false}
                        maintainVisibleContentPosition
                    />
                </View>
            </ScrollView>

            {/* Footer info showing displayed vs total */}
            <View style={styles.footerInfo}>
                <Text style={styles.footerText}>
                    Showing {Math.min(rowCount, orderBook.bids.length)} of {orderBook.bids.length} bids, {Math.min(rowCount, orderBook.asks.length)} of {orderBook.asks.length} asks
                </Text>
            </View>
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
    controlsContainer: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2b3139',
        alignItems: 'flex-end',
        gap: 12,
    },
    pairSelectorContainer: {
        flex: 1,
    },
    rowCountContainer: {
        alignItems: 'center',
        minWidth: 80,
    },
    rowCountLabel: {
        color: '#b7bdc6',
        fontSize: 12,
        marginBottom: 4,
        textAlign: 'center',
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
    rowCountDropdown: {
        minWidth: 70,
        paddingHorizontal: 12,
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
    footerInfo: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#2b3139',
        backgroundColor: '#1e2329',
    },
    footerText: {
        color: '#b7bdc6',
        fontSize: 12,
        textAlign: 'center',
    },
});