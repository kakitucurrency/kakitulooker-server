import { AppCache } from '@app/config';
import { LOG_INFO } from '@app/services';

/** Kakitu has no external distribution data yet — no-op. */
export const cacheAccountDistribution = async (): Promise<void> => {
    LOG_INFO('Account distribution: no external registry, skipping');
};
