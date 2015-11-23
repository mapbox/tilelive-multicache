[![Build Status](https://travis-ci.org/mapbox/tilelive-cache.png?branch=master)](https://travis-ci.org/mapbox/tilelive-cache)

tilelive-cache
--------------
Module for adding a caching layer in front a [node-tilejson](https://github.com/mapbox/node-tilejson) tilelive source.

It wraps `node-tilejson`, providing a new source constructor with cached superpowers:

    var options = {
        client: client, // Required, instantiated client
        ttl: 300,       // optional, object cache ttl in seconds
        stale: 300      // optional, max number of seconds to allow a stale object to be served
    };
    var TileJSON = require('tilelive-redis')(options, require('tilejson'));

    new TileJSON( ... )


The `client` option must be and object with the following methods;

- `set(key, ttl, value, callback)`
- `get(key, callback)`
- `error(err)`
