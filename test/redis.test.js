var assert = require('assert');
var tap = require('tap');
var TileliveCache = require('../index');
var redis = require('redis');
var Testsource = require('./testsource');

var tiles = Testsource.tiles;
var grids = Testsource.grids;
var now = Testsource.now;

var test = tap.test;

function client(cacheClient) {
    var cache = cacheClient || redis.createClient({return_buffers: true});
    return {
        get: function(k, cb) {
            if (cache.command_queue.length >= cache.command_queue_high_water) {
                return cb(new Error('Redis command queue at high water mark'));
            }
            cache.get(k, cb);
        },
        set: function(k, t, v, cb) {
            cache.setex(k, t, v, cb);
        },
        error: function(err) {
            console.error(err); // eslint-disable-line no-console
        },
        redis: cache
    };
}

function deadClient() {
    var deadclient = redis.createClient(6380, '127.0.0.1', {
        retry_max_delay: 500
    });

    deadclient.on('error', function(/* err */) {
        // No op.  Otherwise errors out the tests.
    });
    return client(deadclient);
}

var tile = function(expected, cached, done) {
    return function(err, data, headers) {
        assert.ifError(err);
        assert.ok(data instanceof Buffer);
        assert.ok(cached ? headers['x-tl-cache'] : !headers['x-tl-cache']);
        assert[cached ? 'deepEqual' : 'strictEqual'](data, expected);
        assert.equal(data.length, expected.length);
        assert.equal(headers['content-type'], 'image/png');
        assert.equal(headers['last-modified'], now.toUTCString());
        done();
    };
};
var grid = function(expected, cached, done) {
    return function(err, data, headers) {
        assert.ifError(err);
        assert.ok(cached ? headers['x-tl-cache'] : !headers['x-tl-cache']);
        assert.deepEqual(data, expected);
        assert.equal(headers['content-type'], 'application/json');
        assert.equal(headers['last-modified'], now.toUTCString());
        done();
    };
};
var error = function(message, cached, done) {
    return function(err /*, data, headers */) {
        assert.ok(cached ? err.tlcache: !err.tlcache);
        assert.equal(err.message, message);
        done();
    };
};

test('Redis client', function(t) {
    var CachedSource = TileliveCache({
        client: client(),
        ttl: 1,
        stale: 1
    }, Testsource);
    var source;
    t.test('create source', function(t) {
        source = new CachedSource({}, function(err) {
            assert.ifError(err);
            CachedSource.options.client.redis.flushdb(function() {
                t.end();
            });
        });
    });

    t.test('tile 200 a miss', function(t) {
        source.getTile(0, 0, 0, tile(tiles.a, false, t.end));
    });
    t.test('tile 200 a hit', function(t) {
        source.getTile(0, 0, 0, tile(tiles.a, true, t.end));
    });
    t.test('tile 200 b miss', function(t) {
        source.getTile(1, 0, 0, tile(tiles.b, false, t.end));
    });
    t.test('tile 200 b hit', function(t) {
        source.getTile(1, 0, 0, tile(tiles.b, true, t.end));
    });
    t.test('tile 40x miss', function(t) {
        source.getTile(4, 0, 0, error('Tile does not exist', false, t.end));
    });
    t.test('tile 40x hit', function(t) {
        source.getTile(4, 0, 0, error('Tile does not exist', true, t.end));
    });
    t.test('tile 500 miss', function(t) {
        source.getTile(2, 0, 0, error('Unexpected error', false, t.end));
    });
    t.test('tile 500 miss', function(t) {
        source.getTile(2, 0, 0, error('Unexpected error', false, t.end));
    });
    t.test('grid 200 a miss', function(t) {
        source.getGrid(0, 0, 0, grid(grids.a, false, t.end));
    });
    t.test('grid 200 a hit', function(t) {
        source.getGrid(0, 0, 0, grid(grids.a, true, t.end));
    });
    t.test('grid 200 b miss', function(t) {
        source.getGrid(1, 0, 0, grid(grids.b, false, t.end));
    });
    t.test('grid 200 b hit', function(t) {
        source.getGrid(1, 0, 0, grid(grids.b, true, t.end));
    });
    t.test('grid 40x miss', function(t) {
        source.getGrid(4, 0, 0, error('Grid does not exist', false, t.end));
    });
    t.test('grid 40x hit', function(t) {
        source.getGrid(4, 0, 0, error('Grid does not exist', true, t.end));
    });

    t.test('expire', function(t) {
        setTimeout(function() {
            t.test('tile 200 a expires', function(t) {
                source.getTile(0, 0, 0, tile(tiles.a, false, t.end));
            });
            t.test('tile 200 b expires', function(t) {
                source.getTile(1, 0, 0, tile(tiles.b, false, t.end));
            });
            t.test('tile 40x expires', function(t) {
                source.getTile(4, 0, 0, error('Tile does not exist', false, t.end));
            });
            t.test('grid 200 a expires', function(t) {
                source.getGrid(0, 0, 0, grid(grids.a, false, t.end));
            });
            t.test('grid 200 b expires', function(t) {
                source.getGrid(1, 0, 0, grid(grids.b, false, t.end));
            });
            t.test('grid 40x expires', function(t) {
                source.getGrid(4, 0, 0, error('Grid does not exist', false, t.end));
            });
            t.end();
        }, 2000);
    });

    t.test('quit', function(t) {
        CachedSource.options.client.redis.end();
        t.end();
    });

    t.end();
});


test('Dead Redis client', function(t) {
    var CachedSource = TileliveCache({
        client: deadClient(),
        ttl: 1,
        stale: 1
    }, Testsource);
    var source;
    t.test('create source', function(t) {
        source = new CachedSource({}, function(err) {
            assert.ifError(err);
            CachedSource.options.client.redis.flushdb(function() {
                t.end();
            });
        });
    });
    t.test('dead tile 200 a miss', function(t) {
        source.getTile(0, 0, 0, tile(tiles.a, false, t.end));
    });
    t.test('dead tile 200 b miss', function(t) {
        source.getTile(1, 0, 0, tile(tiles.b, false, t.end));
    });
    t.test('dead grid 200 a miss', function(t) {
        source.getGrid(0, 0, 0, grid(grids.a, false, t.end));
    });
    t.test('dead grid 200 b miss', function(t) {
        source.getGrid(1, 0, 0, grid(grids.b, false, t.end));
    });

    t.test('quit', function(t) {
        CachedSource.options.client.redis.end();
        t.end();
    });

    t.end();
});

test('Redis high water mark', function(t) {

    var cacheClient = client();
    var hwmHit;
    cacheClient.error = function(err) {
        hwmHit = true;
        assert.equal(err.message, 'Redis command queue at high water mark');
    };

    var CachedSource = TileliveCache({
        client: cacheClient,
        ttl: 1,
        stale: 1
    }, Testsource);
    var source;
    t.test('create source', function(t) {
        source = new CachedSource({ delay: 50 }, function(err) {
            assert.ifError(err);
            CachedSource.options.client.redis.command_queue_high_water = 0;
            CachedSource.options.client.redis.flushdb(function() {
                t.end();
            });
        });
    });
    t.test('error on high water mark', function(t) {
        source.getTile(0, 0, 0, function(err /*, res */) {
            assert.ifError(err);
            assert.equal(hwmHit, true);
            t.end();
        });
    });

    t.test('quit', function(t) {
        CachedSource.options.client.redis.end();
        t.end();
    });
    t.end();
});
