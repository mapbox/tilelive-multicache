var assert = require('assert');
var tap = require('tap');
var TileliveCache = require('../index');
var memjs = require('memjs');
var Testsource = require('./testsource');

var tiles = Testsource.tiles;
var grids = Testsource.grids;
var now = Testsource.now;

var test = tap.test;

function client() {
    var cache = memjs.Client.create(null, {'keepAlive': true});

    return {
        get: function(k, cb) {
            cache.get(k, cb);
        },
        set: function(k, t, v, cb) {
            cache.set(k, v, cb, t);
        },
        error: function(err) {
            console.error(err); // eslint-disable-line no-console
        },
        memcached: cache
    };
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

test('source', function(t) {
    var CachedSource = TileliveCache({
        client: client(),
        ttl: 1,
        stale: 1
    }, Testsource);
    var source;
    t.test('create source', function(t) {
        source = new CachedSource({}, function(err) {
            assert.ifError(err);
            CachedSource.options.client.memcached.flush(function() {
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
        CachedSource.options.client.memcached.quit();
        t.end();
    });

    t.end();
});
