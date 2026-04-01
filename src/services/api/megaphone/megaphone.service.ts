import { sendRpc } from '@app/rpc';
import { LOG_ERR, LOG_INFO, sleep } from '@app/services';
import { megaphoneAccounts } from '../../../config/megaphone-accounts';

const sendFunds = (wallet: string, source: string, destination: string, amount: string): Promise<any> =>
    new Promise((resolve) => {
        const start = LOG_INFO(`Sending KSHS to account ${destination}`);
        sendRpc(wallet, source, destination, amount)
            .then(() => {
                LOG_INFO('Sent funds successfully', start);
                resolve();
            })
            .catch((err) => {
                LOG_ERR('useMegaphone', err);
                resolve();
            });
    });

/** Validates the megaphone API key from header or body. Returns true if authorized. */
export const megaphoneAuth = (req, res): boolean => {
    const configuredKey = process.env.MEGAPHONE_API_KEY;
    if (!configuredKey) {
        res.status(403).send(JSON.stringify({ error: 'Megaphone API key not configured on server' }));
        return false;
    }
    const providedKey = req.headers['x-api-key'] || req.body.api_key;
    if (!providedKey || providedKey !== configuredKey) {
        res.status(403).send(JSON.stringify({ error: 'Forbidden: invalid or missing API key' }));
        return false;
    }
    return true;
};

/** Sends messages to selected accounts. */
export const useMegaphone = async (req, res) => {
    if (!megaphoneAuth(req, res)) return;

    const hasLargeRep: string[] = req.body.hasLargeRep || [];
    const hasOfflineRep: string[] = req.body.hasOfflineRep || [];

    console.log(hasLargeRep);
    console.log(hasOfflineRep);

    const readme = megaphoneAccounts.readme;
    const pick = megaphoneAccounts.pickkk;
    const small = megaphoneAccounts.smalll;
    const rep = megaphoneAccounts.repppp;

    for (const address of hasLargeRep) {
        await sendFunds(readme.wallet, readme.address, address, '19000000000000000000000000000');
        await sleep(500);
        await sendFunds(pick.wallet, pick.address, address, '3000000000000000000000000000');
        await sleep(500);
        await sendFunds(small.wallet, small.address, address, '2000000000000000000000000000');
        await sleep(500);
        await sendFunds(rep.wallet, rep.address, address, '1000000000000000000000000000');
    }

    for (const address of hasOfflineRep) {
        // ha.
    }

    res.status(200).send(JSON.stringify({ success: true }));
};
