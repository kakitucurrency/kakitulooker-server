import { RepresentativesResponseDto } from '@app/types';
import { AppCache, NANO_CLIENT } from '@app/config';
import { LOG_ERR, LOG_INFO } from '@app/services';
import { rawToBan } from 'banano-unit-converter';

/** Gets the representative list directly from the Kakitu node RPC. */
const getRepresentativesPromise = async (): Promise<RepresentativesResponseDto> => {
    const [onlineData, repsData] = await Promise.all([
        NANO_CLIENT.representatives_online(false),
        NANO_CLIENT.representatives(150, true),
    ]);

    const onlineReps: string[] = Array.isArray((onlineData as any).representatives)
        ? (onlineData as any).representatives
        : Object.keys((onlineData as any).representatives || {});

    const onlineSet = new Set(onlineReps);
    const quorum = AppCache.networkStats.spyglassQuorum;
    const onlineWeight = quorum ? Math.round(quorum.onlineWeight) : 0;
    const offlineWeight = quorum ? Math.round(quorum.offlineWeight) : 0;
    const principalMin = quorum ? quorum.onlineWeight * 0.001 : 0;

    const thresholdReps = [];
    for (const address in (repsData as any).representatives) {
        const raw = (repsData as any).representatives[address];
        const weight = Math.round(Number(rawToBan(raw)));
        if (weight >= 100000) {
            thresholdReps.push({
                address,
                weight,
                online: onlineSet.has(address),
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
                resolve(LOG_INFO('Representatives V2 Updated', start));
            })
            .catch((err) => {
                resolve(LOG_ERR('cacheRepresentativesV2', err));
            });
    });
};
