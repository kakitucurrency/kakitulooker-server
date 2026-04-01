import { blocksInfoRpc } from '@app/rpc';
import { LOG_ERR } from '@app/services';
import { BlockDto } from '@app/types';
import { AppCache } from '@app/config';
import { BlocksInfoResponse, BlocksInfoResponseContents } from '@dev-ptera/nano-node-rpc';

export const blocksInfoPromise = (blocks: string[]): Promise<BlocksInfoResponse> =>
    blocksInfoRpc(blocks)
        .then((blocks: BlocksInfoResponse) => {
            return Promise.resolve(blocks);
        })
        .catch((err) => {
            return Promise.reject(LOG_ERR('blocksInfoPromise', err, { blocks }));
        });

/** Validates a block hash: must be exactly 64 hex characters. */
const isValidBlockHash = (hash: string): boolean =>
    typeof hash === 'string' && /^[0-9a-fA-F]{64}$/.test(hash);

/** Returns block information for a given hash.  */
export const getBlockInfo = (req, res): void => {
    const parts = req.url.split('/');
    const hash = parts[parts.length - 1];

    if (!isValidBlockHash(hash)) {
        res.status(400).send({ error: 'Invalid block hash. Expected a 64-character hex string.' });
        return;
    }

    blocksInfoPromise([hash])
        .then((blockInfo: BlocksInfoResponse) => {
            const block = blockInfo.blocks[hash];
            const contents = block.contents as BlocksInfoResponseContents;
            res.send({
                blockAccount: block.block_account,
                amount: block.amount,
                balance: block.balance,
                height: Number(block.height),
                timestamp: Number(AppCache.historicHash.get(hash) || block.local_timestamp),
                confirmed: block.confirmed,
                subtype: block.subtype,
                sourceAccount: block.source_account,
                contents: {
                    type: contents.type,
                    account: contents.account,
                    previous: contents.previous,
                    representative: contents.representative,
                    balance: contents.balance,
                    link: contents.link,
                    linkAsAccount: contents.link_as_account,
                    signature: contents.signature,
                    work: contents.work,
                },
            } as BlockDto);
        })
        .catch((err) => {
            const errStr = typeof err === 'string' ? err : JSON.stringify(err);
            if (errStr.includes('Block not found')) {
                res.status(404).send({ error: 'Block not found' });
            } else {
                res.status(500).send(err);
            }
        });
};
