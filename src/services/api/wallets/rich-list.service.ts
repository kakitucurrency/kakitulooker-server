import { AppCache } from '@app/config';
import { LOG_ERR, LOG_INFO } from '@app/services';
import { AccountBalanceDto } from '@app/types';

const MAX_RECORDS_PER_PAGE = 25;
const DEFAULT_RECORDS_PER_PAGE = 25;

/** Kakitu has no external rich-list snapshot yet — uses empty list. */
export const cacheRichList = async (): Promise<void> => {
    LOG_INFO('Rich list: no external registry, using empty list');
    AppCache.richList = [] as AccountBalanceDto[];
    AppCache.lastUpdated.richList = Date.now();
};

/** Uses the AppCache to return a section of all known accounts. */
export const getRichList = async (req, res) => {
    const offset = Number(req.query.offset || 0);
    const size = Math.min(MAX_RECORDS_PER_PAGE, req.query.size || DEFAULT_RECORDS_PER_PAGE);
    const end = Number(offset + size);
    if (AppCache.richList.length > 0) {
        const addresses = AppCache.richList.slice(offset, end);
        res.send(addresses);
    } else {
        res.send([]);
    }
};
