--[[
This is a Lua implementation of the Tocken Bucket algorhitm for Redis.

This function is supposed to be EVALed on redis.

It receives the bucket key and the following arguments:

1. The current timestamp in ms as sent by the client.
2. The tokens per interval added to the token. The interval is always a millisecond.
3. The size of the bucket. The max amount of tokens that the bucket can hold.
4. The amount of tokens to take from the bucket.

The bucket is stored in redis as a HASH map with two keys:

1. `last_drip` the timestamp of the last drip.
2. `content` the content of the bucket

On every drip_and_take opereation we drip in the bucket the amount of tokens missing
from the last drip before doing the attempt to remove tokens.

The result of this function is an array with three values:

1. timestamp
2. current content
4. success

Some inspirations come from here:
https://github.com/jhurliman/node-rate-limiter
--]]

local current_timestamp_ms = tonumber(ARGV[1])
local tokens_per_ms        = tonumber(ARGV[2])
local bucket_size          = tonumber(ARGV[3])
local new_content          = tonumber(ARGV[3])
local tokens_to_take       = tonumber(ARGV[4])

local current = redis.pcall('HMGET', KEYS[1], 'last_drip', 'content')

if current.err ~= nil then
    redis.call('DEL', KEYS[1])
    current = {}
end

if current[1] then
    --drip on existing bucket
    local last_drip = current[1]
    local content = current[2]

    local delta_ms = math.max(current_timestamp_ms - last_drip, 0)
    local drip_amount = delta_ms * tokens_per_ms

    new_content = math.min(content + drip_amount, ARGV[3])
end

local enough_tokens = new_content >= tokens_to_take

if enough_tokens then
    new_content = math.min(new_content - tokens_to_take, bucket_size)
end

redis.call('HMSET', KEYS[1],
            'last_drip', current_timestamp_ms,
            'content', new_content)

--expire the bucket when it should be full
redis.call('PEXPIRE', KEYS[1], math.ceil(bucket_size / tokens_per_ms))

return { current_timestamp_ms, new_content, enough_tokens }