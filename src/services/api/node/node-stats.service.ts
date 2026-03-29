import { NANO_CLIENT } from '@app/config';
import { HostNodeStatsDto } from '@app/types';

const GENESIS_ADDRESS = 'kshs_1mqj8myiphp7uzzoopegxogwdqosrd4n9ybckp5kh3f8o1yuo974dywt7k7h';

/** Returns statistics of the Kakitu genesis node via direct RPC calls. */
export const getNodeStats = async (req, res): Promise<void> => {
    try {
        const [blockCount, versionInfo, peers, uptime] = await Promise.all([
            NANO_CLIENT.block_count().catch(() => ({ count: '0', unchecked: '0', cemented: '0' })),
            NANO_CLIENT.version().catch(() => ({ node_vendor: 'Kakitu', protocol_version: '19' })),
            NANO_CLIENT.peers().catch(() => ({ peers: {} })),
            NANO_CLIENT.uptime().catch(() => ({ seconds: '0' })),
        ]);

        const peerCount = Object.keys((peers as any).peers || {}).length;

        const stats: HostNodeStatsDto = {
            address: GENESIS_ADDRESS,
            weight: 0,
            online: true,
            delegatorsCount: 0,
            name: 'kakitu-genesis',
            version: (versionInfo as any).node_vendor || 'Kakitu',
            protocolVersion: String((versionInfo as any).protocol_version || '19'),
            currentBlock: Number((blockCount as any).count || 0),
            cementedBlocks: Number((blockCount as any).cemented || 0),
            uncheckedBlocks: Number((blockCount as any).unchecked || 0),
            peers: peerCount,
            nodeUptimeStartup: Number((uptime as any).seconds || 0),
            location: 'Railway Cloud',
            usedMem: 0,
            totalMem: 0,
            ledgerSizeMb: 0,
            availableDiskSpaceGb: 0,
        };

        return res.send(stats);
    } catch (err) {
        return res.status(500).send({ error: String(err) });
    }
};
