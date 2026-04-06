import * as https from 'https';

const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

export const KSHS_CONTRACT = (process.env.KSHS_CONTRACT_ADDRESS || '0xe5E6b4b1054678DdCa4623E6Ce7214b1276A1946').toLowerCase();

// ABI-encoded function selectors
const SIG_TOTAL_SUPPLY = '0x18160ddd';
const SIG_NAME        = '0x06fdde03';
const SIG_SYMBOL      = '0x95d89b41';
const SIG_DECIMALS    = '0x313ce567';
const SIG_BALANCE_OF  = '0x70a08231'; // balanceOf(address)

// Event topic hashes
export const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const TOPIC_MINT     = '0x30385c845b448a36257a6a1716e6ad2e1bc2cbe333cde1e69fe849ad6511adfe';
export const TOPIC_BURN     = '0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5';

function rpcPost(body: object): Promise<any> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const url = new URL(BASE_RPC);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };
        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', (chunk) => (raw += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function padAddress(address: string): string {
    return '0x' + address.replace('0x', '').padStart(64, '0');
}

function decodeUint256(hex: string): bigint {
    return BigInt(hex || '0x0');
}

function decodeString(hex: string): string {
    if (!hex || hex === '0x') return '';
    // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
    const noPrefix = hex.slice(2);
    if (noPrefix.length < 128) return '';
    const length = parseInt(noPrefix.slice(64, 128), 16);
    const strHex = noPrefix.slice(128, 128 + length * 2);
    return Buffer.from(strHex, 'hex').toString('utf8');
}

function weiToKshs(wei: bigint): string {
    const whole = wei / BigInt(1e18);
    return whole.toString();
}

export async function getTokenStats() {
    const [nameRes, symbolRes, decimalsRes, supplyRes] = await Promise.all([
        rpcPost({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: KSHS_CONTRACT, data: SIG_NAME }, 'latest'] }),
        rpcPost({ jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: KSHS_CONTRACT, data: SIG_SYMBOL }, 'latest'] }),
        rpcPost({ jsonrpc: '2.0', id: 3, method: 'eth_call', params: [{ to: KSHS_CONTRACT, data: SIG_DECIMALS }, 'latest'] }),
        rpcPost({ jsonrpc: '2.0', id: 4, method: 'eth_call', params: [{ to: KSHS_CONTRACT, data: SIG_TOTAL_SUPPLY }, 'latest'] }),
    ]);

    const totalSupplyWei = decodeUint256(supplyRes.result);
    return {
        contract: KSHS_CONTRACT,
        network: 'Base Mainnet',
        chainId: 8453,
        name: decodeString(nameRes.result),
        symbol: decodeString(symbolRes.result),
        decimals: Number(decodeUint256(decimalsRes.result)),
        totalSupply: weiToKshs(totalSupplyWei),
        totalSupplyRaw: totalSupplyWei.toString(),
    };
}

export async function getAccountBalance(address: string): Promise<string> {
    const data = SIG_BALANCE_OF + padAddress(address).slice(2);
    const res = await rpcPost({
        jsonrpc: '2.0', id: 1,
        method: 'eth_call',
        params: [{ to: KSHS_CONTRACT, data }, 'latest'],
    });
    return weiToKshs(decodeUint256(res.result));
}

export async function getRecentTransfers(pageKey?: string) {
    const body: any = {
        jsonrpc: '2.0', id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            contractAddresses: [KSHS_CONTRACT],
            category: ['erc20'],
            withMetadata: true,
            excludeZeroValue: false,
            maxCount: '0x19', // 25
            order: 'desc',
        }],
    };
    if (pageKey) body.params[0].pageKey = pageKey;
    const res = await rpcPost(body);
    return res.result || { transfers: [], pageKey: null };
}

export async function getAccountTransfers(address: string, pageKey?: string) {
    const fromBody: any = {
        jsonrpc: '2.0', id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            fromAddress: address,
            contractAddresses: [KSHS_CONTRACT],
            category: ['erc20'],
            withMetadata: true,
            excludeZeroValue: false,
            maxCount: '0x19',
            order: 'desc',
        }],
    };
    const toBody: any = {
        jsonrpc: '2.0', id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            toAddress: address,
            contractAddresses: [KSHS_CONTRACT],
            category: ['erc20'],
            withMetadata: true,
            excludeZeroValue: false,
            maxCount: '0x19',
            order: 'desc',
        }],
    };
    if (pageKey) {
        fromBody.params[0].pageKey = pageKey;
        toBody.params[0].pageKey = pageKey;
    }
    const [fromRes, toRes] = await Promise.all([rpcPost(fromBody), rpcPost(toBody)]);
    const sent = (fromRes.result?.transfers || []);
    const received = (toRes.result?.transfers || []);
    // Merge, dedupe by hash, sort by blockNum desc
    const all = [...sent, ...received];
    const seen = new Set<string>();
    const deduped = all.filter((t: any) => {
        if (seen.has(t.hash)) return false;
        seen.add(t.hash);
        return true;
    });
    deduped.sort((a: any, b: any) => Number(BigInt(b.blockNum) - BigInt(a.blockNum)));
    return { transfers: deduped.slice(0, 25) };
}

export async function getTransaction(hash: string) {
    const [txRes, receiptRes] = await Promise.all([
        rpcPost({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [hash] }),
        rpcPost({ jsonrpc: '2.0', id: 2, method: 'eth_getTransactionReceipt', params: [hash] }),
    ]);
    const tx = txRes.result;
    const receipt = receiptRes.result;
    if (!tx) return null;

    // Decode Transfer log from receipt
    let type = 'transfer';
    let from = tx.from;
    let to = tx.to;
    let amount = '0';

    const transferLog = (receipt?.logs || []).find(
        (l: any) => l.address?.toLowerCase() === KSHS_CONTRACT && l.topics?.[0] === TOPIC_TRANSFER
    );
    if (transferLog) {
        const fromAddr = '0x' + transferLog.topics[1].slice(26);
        const toAddr   = '0x' + transferLog.topics[2].slice(26);
        const amtWei   = decodeUint256(transferLog.data);
        from = fromAddr;
        to   = toAddr;
        amount = weiToKshs(amtWei);
        // Mint: from is zero address
        if (fromAddr === '0x0000000000000000000000000000000000000000') type = 'mint';
        // Burn: to is zero address
        else if (toAddr === '0x0000000000000000000000000000000000000000') type = 'burn';
    }

    return {
        hash,
        type,
        from,
        to,
        amount,
        blockNumber: parseInt(tx.blockNumber, 16),
        status: receipt?.status === '0x1' ? 'success' : 'failed',
        gasUsed: receipt ? parseInt(receipt.gasUsed, 16).toString() : null,
    };
}
