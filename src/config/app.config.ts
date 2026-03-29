import { NanoClient } from '@dev-ptera/nano-node-rpc';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** API served from this root, example: https://api.kakitu.org/kakitulooker/representatives */
export const PATH_ROOT = 'kakitulooker';

/** Domains allowed to use this API */
export const URL_WHITE_LIST = [
    'https://kakitu.org',
    'https://www.kakitu.org',
    'https://explorer.kakitu.org',
    'https://aware-upliftment-production.up.railway.app',
    'http://localhost:4200',
    'http://localhost:4202',
];

/** Used to read data from the Kakitu node RPC */
export const NANO_CLIENT = new NanoClient({
    url: process.env.RPC_URL || 'https://rpc.kakitu.org',
    requestHeaders: {
        Authorization: process.env.RPC_AUTH || '',
    },
});

const calcMinutes = (mins: number) => 60000 * mins;
export const REPRESENTATIVES_REFRESH_INTERVAL_MS = calcMinutes(5);
export const WALLETS_REFRESH_INTERVAL_MS = calcMinutes(60 * 12);
export const KNOWN_ACCOUNTS_REFRESH_INTERVAL_MS = calcMinutes(60);
export const PRICE_DATA_REFRESH_INTERVAL_MS = calcMinutes(IS_PRODUCTION ? 15 : 120);
export const NETWORK_STATS_REFRESH_INTERVAL_MS = calcMinutes(5);

/** Kakitu genesis node — only peer for now */
export const MANUAL_PEER_MONITOR_URLS: string[] = [];

/** Ledger location on the Railway volume */
export const LEDGER_LOCATION = '/home/kakitu/Kakitu/data.ldb';

/** Name of the Kakitu genesis node */
export const HOST_NODE_NAME = 'kakitu-genesis';

/** Backup nodes — none yet */
export const BACKUP_NODES: string[] = [];
