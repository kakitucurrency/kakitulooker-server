const moduleAlias = require('module-alias');
moduleAlias.addAlias('@app/config', __dirname + '/config');
moduleAlias.addAlias('@app/rpc', __dirname + '/rpc');
moduleAlias.addAlias('@app/services', __dirname + '/services');
moduleAlias.addAlias('@app/types', __dirname + '/types');

import * as express from 'express';
import * as cors from 'cors';

const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
process.env.UV_THREADPOOL_SIZE = String(16);

app.use(morgan('dev'));

app.use(bodyParser.json({ limit: '1mb' }));

/* Security headers */
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

/* General rate limiter: 100 requests per minute per IP */
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: JSON.stringify({ error: 'Too many requests, please try again later.' }),
});

/* Strict rate limiter for megaphone: 5 requests per minute */
const megaphoneLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: JSON.stringify({ error: 'Too many megaphone requests, please try again later.' }),
});

app.use(generalLimiter);

import {
    IS_PRODUCTION,
    URL_WHITE_LIST,
    PATH_ROOT,
    AppCache,
    PRICE_DATA_REFRESH_INTERVAL_MS,
    WALLETS_REFRESH_INTERVAL_MS,
    REPRESENTATIVES_REFRESH_INTERVAL_MS,
    KNOWN_ACCOUNTS_REFRESH_INTERVAL_MS,
    NETWORK_STATS_REFRESH_INTERVAL_MS,
} from '@app/config';
import { blocksInfoPromise } from './services/api/explore/block-info.service';
import {
    getAccountOverview,
    getConfirmedTransactions,
    getBlockInfo,
    getPendingTransactions,
    cacheRepresentatives,
    getNodeStats,
    cacheAccountDistribution,
    getAccountInsights,
    cachePriceData,
    cacheKnownAccounts,
    getRichList,
    cacheNetworkStats,
    LOG_INFO,
    useMegaphone,
    getAliases,
    sleep,
    cacheRichList,
    cacheRepresentativesV2,
} from '@app/services';

const corsOptions = {
    origin: function (origin, callback) {
        if (IS_PRODUCTION && origin && URL_WHITE_LIST.indexOf(origin) === -1) {
            callback(new Error(`Origin '${origin}' is not allowed by CORS`));
        } else {
            callback(null, true);
        }
    },
};

const sendCached = (res, cacheKey: keyof AppCache): void => {
    const lastUpdated = AppCache.lastUpdated[cacheKey] || null;
    const data = AppCache[cacheKey];
    res.send(JSON.stringify({ data, lastUpdated }));
};

app.use(cors(corsOptions));

/* Health check — outside auth/CORS so monitoring tools can reach it */
const serverStartTime = Date.now();
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    });
});

/* Set response headers to text-json */
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

/* Request timeout — abort if an RPC call hangs longer than 30 seconds */
const REQUEST_TIMEOUT_MS = 30_000;
app.use((req, res, next) => {
    const timer = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timed out' });
        }
    }, REQUEST_TIMEOUT_MS);
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
});

/* Real time results */
app.get(`/${PATH_ROOT}/account-overview/*`, (req, res) => getAccountOverview(req, res));
app.get(`/${PATH_ROOT}/aliases`, (req, res) => getAliases(req, res));
app.get(`/${PATH_ROOT}/block/*`, (req, res) => getBlockInfo(req, res));
app.get(`/${PATH_ROOT}/confirmed-transactions`, (req, res) => getConfirmedTransactions(req, res));
app.get(`/${PATH_ROOT}/insights/*`, (req, res) => getAccountInsights(req, res));
app.post(`/${PATH_ROOT}/megaphone`, megaphoneLimiter, (req, res) => useMegaphone(req, res));
app.get(`/${PATH_ROOT}/node`, (req, res) => getNodeStats(req, res));
app.get(`/${PATH_ROOT}/pending-transactions`, (req, res) => getPendingTransactions(req, res));

/* v2 API — compatible with yellow-spyglass-client (Creeper explorer) */
app.get(`/${PATH_ROOT}/v2/block/:hash`, (req, res) => {
    const hash = req.params.hash;
    if (typeof hash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hash)) {
        res.status(400).send({ error: 'Invalid block hash. Expected a 64-character hex string.' });
        return;
    }
    blocksInfoPromise([hash])
        .then((blockInfo: any) => {
            res.send(blockInfo);
        })
        .catch((err) => {
            res.status(500).send({ error: String(err) });
        });
});

/* v1 spyglass-compatible API — used by yellow-spyglass-client */

app.get(`/${PATH_ROOT}/v1/representatives/online`, (req, res) => {
    res.send(AppCache.representativesV2.onlineReps || []);
});

app.get(`/${PATH_ROOT}/v1/network/quorum`, (req, res) => {
    const q = AppCache.networkStats.spyglassQuorum;
    if (!q) return res.status(503).json({ error: 'Data not yet available' });
    res.send(q);
});

app.get(`/${PATH_ROOT}/v1/distribution/supply`, (req, res) => {
    const supply = AppCache.networkStats.supply;
    if (!supply) return res.status(503).json({ error: 'Data not yet available' });
    res.send(supply);
});

app.get(`/${PATH_ROOT}/v1/network/peers`, (req, res) => {
    res.send(AppCache.networkStats.peerVersions || []);
});

app.get(`/${PATH_ROOT}/v1/network/nakamoto-coefficient`, (req, res) => {
    const nc = AppCache.networkStats.nakamotoCoefficient || 1;
    res.send({ delta: 0, nakamotoCoefficient: nc, ncRepresentatives: [], ncRepsWeight: 0 });
});

app.get(`/${PATH_ROOT}/v1/network/quorum-coefficient`, (req, res) => {
    const q = AppCache.networkStats.spyglassQuorum;
    if (!q) return res.status(503).json({ error: 'Data not yet available' });
    const coefficient = q.quorumDelta > 0 ? Number((q.onlineWeight / q.quorumDelta).toFixed(2)) : 0;
    res.send({
        delta: q.quorumDelta,
        onlineWeight: q.onlineWeight,
        onlineWeightMinimum: q.onlineWeightMinimum,
        coefficient,
        representatives: [],
        repsWeight: 0,
    });
});

app.post(`/${PATH_ROOT}/v1/representatives`, (req, res) => {
    const { minimumWeight = 0 } = req.body || {};
    const reps = (AppCache.representativesV2.thresholdReps || []).filter((r) => r.weight >= minimumWeight);
    res.send(reps);
});

app.get(`/${PATH_ROOT}/v1/representatives/monitored`, (req, res) => {
    res.send(AppCache.representativesV2.monitoredReps || []);
});

app.get(`/${PATH_ROOT}/v1/representatives/scores`, (req, res) => {
    res.send([]);
});

/* Cached Results */
app.get(`/${PATH_ROOT}/accounts-distribution`, (req, res) => sendCached(res, 'accountDistributionStats'));
app.get(`/${PATH_ROOT}/known-accounts`, (req, res) => sendCached(res, 'knownAccounts'));
app.get(`/${PATH_ROOT}/network-stats`, (req, res) => sendCached(res, 'networkStats'));
app.get(`/${PATH_ROOT}/price`, (req, res) => sendCached(res, 'priceData'));
app.get(`/${PATH_ROOT}/representatives`, (req, res) => sendCached(res, 'representatives'));
app.get(`/${PATH_ROOT}/v2/representatives`, (req, res) => sendCached(res, 'representativesV2'));
app.get(`/${PATH_ROOT}/accounts-balance`, (req, res) => getRichList(req, res));
app.get(`/${PATH_ROOT}/online-reps`, (req, res) => res.send(AppCache.representatives.onlineReps));

/* Global error handler — must be the last middleware */
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
        res.status(500).send({ error: 'Internal server error' });
    }
});

const port: number = Number(process.env.PORT || 3000);
const server = http.createServer(app);

export const staggerServerUpdates = async (cacheFns: Array<{ method: Function; interval: number }>) => {
    for (const fn of cacheFns) {
        await fn.method();
        setInterval(() => fn.method(), fn.interval);
        await sleep(2000);
    }
};

server.listen(port, () => {
    LOG_INFO(`Running kakitulooker-server on port ${port}.`);
    LOG_INFO(`Production mode enabled? : ${IS_PRODUCTION}`);

    const networkStats = {
        method: cacheNetworkStats,
        interval: NETWORK_STATS_REFRESH_INTERVAL_MS,
    };

    const priceData = {
        method: cachePriceData,
        interval: PRICE_DATA_REFRESH_INTERVAL_MS,
    };

    const representatives = {
        method: cacheRepresentatives,
        interval: REPRESENTATIVES_REFRESH_INTERVAL_MS,
    };

    const representativesV2 = {
        method: cacheRepresentativesV2,
        interval: REPRESENTATIVES_REFRESH_INTERVAL_MS,
    };

    const knownAccounts = {
        method: cacheKnownAccounts,
        interval: KNOWN_ACCOUNTS_REFRESH_INTERVAL_MS,
    };

    const accountDistribution = {
        method: cacheAccountDistribution,
        interval: WALLETS_REFRESH_INTERVAL_MS,
    };

    const richList = {
        method: cacheRichList,
        interval: WALLETS_REFRESH_INTERVAL_MS,
    };

    /* Updating the network metrics are now staggered so that each reset interval not all calls are fired at once. */
    void staggerServerUpdates([
        networkStats,
        knownAccounts,
        priceData,
        representativesV2,
        representatives,
        accountDistribution,
        richList,
    ]);
});
