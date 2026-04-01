import { AppCache } from '@app/config';
import { LOG_INFO } from '@app/services';

const EMPTY_DISTRIBUTION = {
    number0_001: 0,
    number0_01: 0,
    number0_1: 0,
    number1: 0,
    number10: 0,
    number100: 0,
    number1_000: 0,
    number10_000: 0,
    number100_000: 0,
    number1_000_000: 0,
    number10_000_000: 0,
    number100_000_000: 0,
    totalAccounts: 0,
};

/** Kakitu has no external distribution data yet — sets empty distribution so the wallets page loads. */
export const cacheAccountDistribution = async (): Promise<void> => {
    LOG_INFO('Account distribution: no external registry, using empty distribution');
    AppCache.accountDistributionStats = EMPTY_DISTRIBUTION;
    AppCache.lastUpdated.accountDistributionStats = Date.now();
};
