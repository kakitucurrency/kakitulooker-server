import { DelegatorsResponse } from '@dev-ptera/nano-node-rpc';
import { NANO_CLIENT } from '@app/config';

const RPC_TIMEOUT_MS = 5000;

export const delegatorsRpc = async (address: string): Promise<DelegatorsResponse> => {
    const rpcPromise = NANO_CLIENT.delegators(address)
        .then((delegators: DelegatorsResponse) => Promise.resolve(delegators));

    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`delegatorsRpc timeout after ${RPC_TIMEOUT_MS}ms for ${address}`)), RPC_TIMEOUT_MS)
    );

    return Promise.race([rpcPromise, timeoutPromise]);
};
