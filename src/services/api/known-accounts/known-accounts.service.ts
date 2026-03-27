import { AppCache } from '@app/config';
import { KnownAccountDto } from '@app/types';
import { LOG_INFO } from '@app/services';

/** Kakitu has no external known-accounts registry yet — return empty list. */
export const cacheKnownAccounts = async (): Promise<void> => {
    LOG_INFO('Known accounts: no external registry, using empty list');
    AppCache.knownAccounts = [] as KnownAccountDto[];
};
