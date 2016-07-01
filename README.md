Copyright (c) 2015 Kazuyuki Tanimura. All rights reserved.

* enable socket client
* turn off API precaution
* turn off the readonly mode

### TODO
- Passive execution
-- Limit order at bid price for long and ask price for short
-- If the tick moves against the order
--- Fallback to aggressive execution
--- Modify the limit order at bsk price for long and bid price for short
- Passive roll over
-- For long
--- If cumulative position is positive
---- Long *new* month and limit new month
--- If cumulative position is negative
---- Long *old* month and limit new month
-- For short
--- If cumulative position is positive
---- Short *old* month and limit new month
--- If cumulative position is negative
---- Short *new* month and limit new month
- More accurate execution timing
-- Use process.hrtime()
- Test with futures contracts
