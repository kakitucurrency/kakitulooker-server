import { RepresentativesResponseDto } from '@app/types';
import { AppCache, NANO_CLIENT } from '@app/config';
import { LOG_ERR, LOG_INFO } from '@app/services';

// KSHS uses 10^30 raw per 1 KSHS (Nano-standard, not Banano's 10^29)
const rawToKshs = (raw: string): number => Number(BigInt(raw) / BigInt('1000000000000000000000000000000'));

/** Gets the representative list directly from the Kakitu node RPC. */
const getRepresentativesPromise = async (): Promise<RepresentativesResponseDto> => {
    const [onlineData, repsData] = await Promise.all([
        NANO_CLIENT.representatives_online(false),
        NANO_CLIENT.representatives(150, true),
    ]);

    const onlineReps: string[] = Array.isArray((onlineData as any).representatives)
        ? (onlineData as any).representatives
        : Object.keys((onlineData as any).representatives || {});

    // On a single-node network the node is online if RPC responds (no peers to exchange votes with)
    const nodeIsReachable = onlineReps.length > 0 || (repsData as any).representatives !== undefined;
    const onlineSet = new Set(onlineReps);
    const quorum = AppCache.networkStats.spyglassQuorum;
    const onlineWeight = quorum ? Math.round(quorum.onlineWeight) : 0;
    const offlineWeight = quorum ? Math.round(quorum.offlineWeight) : 0;
    const principalMin = quorum ? quorum.onlineWeight * 0.001 : 0;

    const thresholdReps = [];
    for (const address in (repsData as any).representatives) {
        const raw = (repsData as any).representatives[address];
        const weight = rawToKshs(raw);
        if (weight >= 1) {
            thresholdReps.push({
                address,
                weight,
                online: onlineSet.has(address) || nodeIsReachable,
                delegatorsCount: 0,
                principal: weight >= principalMin,
                uptimePercentDay: 100,
                uptimePercentWeek: 100,
                uptimePercentMonth: 100,
                uptimePercentSemiAnnual: 100,
                uptimePercentYear: 100,
                lastOutage: undefined,
                creationDate: undefined,
                creationUnixTimestamp: undefined,
            });
        }
    }

    return {
        thresholdReps,
        monitoredReps: [],
        onlineWeight,
        microReps: [],
        onlineReps,
        offlineWeight,
    };
};

/** This is called to update the representatives list in the AppCache. */
export const cacheRepresentativesV2 = async (): Promise<void> => {
    return new Promise((resolve) => {
        const start = LOG_INFO('Refreshing Representatives V2');
        getRepresentativesPromise()
            .then((data: RepresentativesResponseDto) => {
                AppCache.representativesV2 = data;
                AppCache.lastUpdated.representativesV2 = Date.now();
                resolve(LOG_INFO('Representatives V2 Updated', start));
            })
            .catch((err) => {
                resolve(LOG_ERR('cacheRepresentativesV2', err));
            });
    });
};
