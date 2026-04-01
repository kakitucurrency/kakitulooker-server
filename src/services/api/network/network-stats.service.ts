import { AppCache, NANO_CLIENT } from '@app/config';
import { LOG_ERR, LOG_INFO } from '@app/services';
import { SpyglassAPIQuorumDto, SupplyDto } from '@app/types';
import { ConfirmationQuorumResponse } from '@dev-ptera/nano-node-rpc';
// 10^30 raw per 1 KSHS
const rawToKshs = (raw: string): number => Number(BigInt(raw) / BigInt('1000000000000000000000000000000'));

/** Gets quorum data directly from the Kakitu node RPC. */
const getQuorumFromNode = (): Promise<SpyglassAPIQuorumDto> =>
    NANO_CLIENT.confirmation_quorum()
        .then((data: ConfirmationQuorumResponse) => {
            const onlineWeight = Number(rawToKshs(data.online_stake_total));
            const quorumDelta = Number(rawToKshs(data.quorum_delta));
            return Promise.resolve({
                noRepPercent: 0,
                noRepWeight: 0,
                nonBurnedWeight: onlineWeight,
                offlinePercent: 0,
                offlineWeight: 0,
                onlinePercent: 100,
                onlineWeight,
                onlineWeightMinimum: Number(rawToKshs(data.online_weight_minimum)),
                onlineWeightQuorumPercent: Number(data.online_weight_quorum_percent),
                peersStakeWeight: Number(rawToKshs(data.peers_stake_total)),
                quorumDelta,
            });
        })
        .catch((err) =>
            Promise.resolve({
                noRepPercent: 0,
                noRepWeight: 0,
                nonBurnedWeight: 0,
                offlinePercent: 0,
                offlineWeight: 0,
                onlinePercent: 100,
                onlineWeight: 0,
                onlineWeightMinimum: 1,
                onlineWeightQuorumPercent: 67,
                peersStakeWeight: 0,
                quorumDelta: 0,
            })
        );

/** Gets supply info from the Kakitu node RPC. */
const getSupplyFromNode = (): Promise<SupplyDto> =>
    new Promise<SupplyDto>((resolve) => {
        NANO_CLIENT.available_supply()
            .then((supplyResponse: any) => {
                const available = Number(rawToKshs(supplyResponse.available));
                resolve({
                    totalAmount: available,
                    circulatingAmount: available,
                    circulatingPercent: 100,
                    burnedAmount: 0,
                    devFundAmount: 0,
                    devFundPercent: 0,
                });
            })
            .catch(() => {
                resolve({
                    totalAmount: 0,
                    circulatingAmount: 0,
                    circulatingPercent: 0,
                    burnedAmount: 0,
                    devFundAmount: 0,
                    devFundPercent: 0,
                });
            });
    });

/** This is called to update the Network Stats in the AppCache. */
export const cacheNetworkStats = async (): Promise<void> => {
    const start = LOG_INFO('Refreshing Network Stats');
    return new Promise((resolve) => {
        Promise.all([getSupplyFromNode(), getQuorumFromNode()])
            .then(([supply, spyglassQuorum]) => {
                AppCache.networkStats = {
                    supply,
                    nakamotoCoefficient: 1, // Single node network
                    spyglassQuorum,
                    peerVersions: [],
                    principalRepMinKshs: Math.round(spyglassQuorum.onlineWeight * 0.001),
                    openedAccounts: AppCache.networkStats.openedAccounts,
                };
                AppCache.lastUpdated.networkStats = Date.now();
                resolve(LOG_INFO('Network Stats Updated', start));
            })
            .catch((err) => {
                resolve(LOG_ERR('cacheNetworkStats', err));
            });
    });
};
