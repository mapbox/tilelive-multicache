[![Build Status](https://travis-ci.org/mapbox/tilelive-multicache.png?branch=master)](https://travis-ci.org/mapbox/tilelive-multicache)

tilelive-multicache
--------------
Module for adding a caching layer in front a tilelive source. It wraps a tilelive backend providing a new source constructor with cached superpowers!

    var options = {
        client: client, // Required, instantiated client
        ttl: 300,       // optional, object cache ttl in seconds
        stale: 300      // optional, max number of seconds to allow a stale object to be served
    };
    var TileJSON = require('tilelive-multicache')(options, require('tilejson'));

    new TileJSON( ... )


The `client` option must be an object with the following methods;

- `set(key, ttl, value, callback)`
- `get(key, callback)`
- `error(err)`
