import { MonitoredRepDto, PeerMonitorStats, RepresentativeDto } from '@app/types';
import { isRepOnline, LOG_ERR } from '@app/services';
import { AppCache, NANO_CLIENT } from '@app/config';
import * as RPC from '@dev-ptera/nano-node-rpc';

/** This file contains just random helpers to help clean up the logic from various rep-based services. */

export const sortRepByWeight = (reps: RepresentativeDto[]): RepresentativeDto[] =>
    reps.sort(function (a, b) {
        const weightA = a.weight;
        const weightB = b.weight;
        return weightA < weightB ? 1 : weightA > weightB ? -1 : 0;
    });

export const sortMonitoredRepsByName = (onlineReps: MonitoredRepDto[]): MonitoredRepDto[] =>
    onlineReps.sort(function (a, b) {
        if (a.name === undefined) {
            a.name = '';
        }
        if (b.name === undefined) {
            b.name = '';
        }
        const textA = a.name.toUpperCase();
        const textB = b.name.toUpperCase();
        return textA < textB ? -1 : textA > textB ? 1 : 0;
    });

export const sortMonitoredRepsByStatus = (onlineReps: PeerMonitorStats[]): PeerMonitorStats[] =>
    onlineReps.sort((a, b) => {
        if (isRepOnline(a.nanoNodeAccount) && !isRepOnline(b.nanoNodeAccount)) {
            return -1;
        }
        if (isRepOnline(b.nanoNodeAccount) && !isRepOnline(a.nanoNodeAccount)) {
            return 1;
        }
        return 0;
    });

/** Given a weight (non-raw), returns if it's enough to be a considered a Principal Representative. */
export const isRepPrincipal = (weight: number): boolean => weight > AppCache.networkStats.principalRepMinBan;

const RPC_TIMEOUT_MS = 5000;
const CONCURRENCY_LIMIT = 5;

/** Given a map of representatives, populates delegators count with concurrency limiting. */
export const populateDelegatorsCount = async (
    reps: Map<string, Partial<{ delegatorsCount: number }>>
): Promise<void> => {
    const addresses = Array.from(reps.keys());

    const fetchCount = (address: string): Promise<{ address: string; delegatorsCount: number }> => {
        const rpcPromise = NANO_CLIENT.delegators_count(address)
            .then((data: RPC.DelegatorsCountResponse) => ({
                address,
                delegatorsCount: Number(data.count),
            }));

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`delegators_count timeout for ${address}`)), RPC_TIMEOUT_MS)
        );

        return Promise.race([rpcPromise, timeoutPromise])
            .catch((err) => {
                LOG_ERR('cacheRepresentatives.delegators_count', err, { address });
                return { address, delegatorsCount: 0 };
            });
    };

    // Process in batches of CONCURRENCY_LIMIT
    for (let i = 0; i < addresses.length; i += CONCURRENCY_LIMIT) {
        const batch = addresses.slice(i, i + CONCURRENCY_LIMIT);
        const results = await Promise.all(batch.map(fetchCount));
        for (const pair of results) {
            reps.get(pair.address).delegatorsCount = pair.delegatorsCount;
        }
    }
};
