import {
    AccountDistributionStatsDto,
    AccountBalanceDto,
    PriceDataDto,
    RepresentativesResponseDto,
    KnownAccountDto,
    RepPingMap,
    RepPingMapData,
} from '@app/types';
import { NetworkStatsDto } from '../types/dto/NetworkStatsDto';

/** Tracks the last successful update time for each cacheable key. */
export type CacheTimestamps = {
    accountDistributionStats: number;
    knownAccounts: number;
    networkStats: number;
    priceData: number;
    richList: number;
    representatives: number;
    representativesV2: number;
};

export type AppCache = {
    /** Graph data for KSHS distribution. */
    accountDistributionStats: AccountDistributionStatsDto;

    /** This object matches the json collection for representative pings. */
    dbRepPings: RepPingMap;

    /** Populated by a csv of hash -> timestamp pairs. */
    historicHash: Map<string, string>;

    /** KSHS accounts with an alias. */
    knownAccounts: KnownAccountDto[];

    networkStats: NetworkStatsDto;

    /** Populated by CoinMarketCap API. */
    priceData: PriceDataDto;

    /** An object used to keep track of whether a representative has fallen offline.
     *  Since the `representatives_online` nano RPC call is unreliable (sometimes it returns far fewer reps than expected),
     *  this object tracks representatives and the last time they were successfully pinged.
     *  If a rep is unreachable for a certain amount of pings, it will be marked as offline.
     *  This object includes all representatives regardless of delegated weight; small reps included. */
    repPings: {
        currPing: number;
        map: Map<string, number>;
    };

    /** Top KSHS holders, sorted by balance. */
    richList: AccountBalanceDto[];

    /** Representative Cache which updates every 5 minutes.
     *  Stores online weight, monitored, large, and micro representatives.
     *  Legacy cache. DEPRECATED
     *  */
    representatives: RepresentativesResponseDto;

    /** Representative Cache which updates every 5 minutes.
     *  Stores online weight, monitored, large, and micro representatives.
     *  Used by KakituLooker. */
    representativesV2: RepresentativesResponseDto;

    /** Unix-ms timestamps of the last successful cache update per key. */
    lastUpdated: CacheTimestamps;
};

export const AppCache: AppCache = {
    accountDistributionStats: undefined,
    dbRepPings: new Map<string, RepPingMapData>(),
    historicHash: new Map<string, string>(),
    knownAccounts: [],
    networkStats: {
        supply: undefined,
        spyglassQuorum: undefined,
        nakamotoCoefficient: undefined,
        peerVersions: undefined,
        principalRepMinBan: undefined,
        openedAccounts: 0,
    },
    priceData: undefined,
    repPings: {
        currPing: 0,
        map: new Map<string, number>(),
    },
    richList: [],
    representatives: {
        thresholdReps: [],
        monitoredReps: [],
        microReps: [],
        onlineWeight: 0,
        offlineWeight: 0,
        onlineReps: [],
    },
    representativesV2: {
        thresholdReps: [],
        monitoredReps: [],
        microReps: [],
        onlineWeight: 0,
        offlineWeight: 0,
        onlineReps: [],
    },
    lastUpdated: {
        accountDistributionStats: 0,
        knownAccounts: 0,
        networkStats: 0,
        priceData: 0,
        richList: 0,
        representatives: 0,
        representativesV2: 0,
    },
};
