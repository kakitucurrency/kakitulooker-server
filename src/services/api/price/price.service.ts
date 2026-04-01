import { LOG_ERR, LOG_INFO } from '@app/services';
import { PriceDataDto } from '@app/types';
import { AppCache } from '@app/config';
import axios, { AxiosError, AxiosResponse } from 'axios';

const method = 'GET';
const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
const headers = {
    'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
};

const getBitcoinPrice = (): Promise<any> =>
    new Promise<any>((resolve, reject) => {
        axios
            .request({
                method,
                url,
                headers,
                params: {
                    symbol: 'BTC',
                },
            })
            .then((response: AxiosResponse<any>) => resolve(response.data))
            .catch((err: AxiosError) => {
                reject(LOG_ERR('getBitcoinPrice', err));
            });
    });

const getPrice = (): Promise<PriceDataDto> => {
    return getBitcoinPrice()
        .then((btcData) => {
            const dto: PriceDataDto = {
                kakituPriceUsd: 0, // KSHS not yet listed on CMC
                bitcoinPriceUsd: btcData.data.BTC.quote.USD.price,
            };
            return Promise.resolve(dto);
        })
        .catch((err) => {
            return Promise.reject(err);
        });
};

/** This is called to update the Price Data in the AppCache. */
export const cachePriceData = async (): Promise<void> => {
    return new Promise((resolve) => {
        const start = LOG_INFO('Refreshing Price Data');
        getPrice()
            .then((data) => {
                AppCache.priceData = data;
                AppCache.lastUpdated.priceData = Date.now();
                resolve(LOG_INFO('Price Data Updated', start));
            })
            .catch((err) => {
                // Fall back to stub data if CMC is unavailable
                AppCache.priceData = { kakituPriceUsd: 0, bitcoinPriceUsd: 0 };
                resolve(LOG_ERR('cachePriceData', err));
            });
    });
};
