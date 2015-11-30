--1 key size count

redis.call('SETNX', KEYS[1], ARGV[1])

--coalesce to bucket size.
local current = tonumber(redis.call('GET', KEYS[1])) or tonumber(ARGV[1])

local new_value = math.min(current - ARGV[2], ARGV[1])

if new_value < 0 then
	return false
else
	redis.call('SET', KEYS[1], new_value)
	return new_value
end