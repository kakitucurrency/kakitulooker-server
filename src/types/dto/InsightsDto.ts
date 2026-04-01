export type InsightsDto = {
    data: Array<{
        balance: number;
        height: number;
    }>;
    maxAmountReceivedHash: string;
    maxAmountReceivedKshs: number;
    maxAmountSentHash: string;
    maxAmountSentKshs: number;
    maxBalanceHash: string;
    maxBalanceKshs: number;
    mostCommonSenderAddress: string;
    mostCommonSenderTxCount: number;
    mostCommonRecipientAddress: string;
    mostCommonRecipientTxCount: number;
    totalAmountReceivedKshs: number;
    totalAmountSentKshs: number;
    totalTxSent: number;
    totalTxReceived: number;
    firstInTxUnixTimestamp: number;
    firstInTxHash: string;
    firstOutTxUnixTimestamp: number;
    firstOutTxHash: string;
    lastInTxUnixTimestamp: number;
    lastInTxHash: string;
    lastOutTxUnixTimestamp: number;
    lastOutTxHash: string;
};
