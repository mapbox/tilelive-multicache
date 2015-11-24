var assert = require('assert');
var tap = require('tap');
var LRU = require('lru-cache');
var TileliveCache = require('../index');

var Testsource = require('./testsource');

var tiles = Testsource.tiles;
var grids = Testsource.grids;
var now = Testsource.now;

var test = tap.test;

function lruClient() {
    var cache = LRU();

    return {
        get: function(k, cb) {
            var v = cache.get(k);
            cb(null, v);
        },
        set: function(k, t, v, cb) {
            cache.set(k, v, t * 100);
            cb(null);
        },
        error: function(err) {
            console.error(err); // eslint-disable-line no-console
        }
    };
}

test('load', function(t) {

    //t.test('fails without source', function(done) {
    //    assert.throws(function() { Source({}); });
    //    assert.throws(function() { Source({}, {}); });
    //    done();
    //});
    t.test('loads + sets default values', function(t) {
        var Source = TileliveCache({ client: lruClient() }, Testsource);
        assert.ok(Source.options);
        assert.ok(Source.options.ttl, 300);
        new Source('fakeuri', function(err, source) {
            assert.ifError(err);
            assert.ok(source instanceof Testsource);
            assert.equal(source._uri, 'fakeuri');
            t.end();
        });
    });
    t.test('sets config from opts', function(t) {
        var Source = TileliveCache({
            client: lruClient(),
            ttl: 10,
            stale: 5
        }, Testsource);
        assert.ok(Source.options);
        assert.equal(Source.options.ttl, 10);
        assert.equal(Source.options.stale, 5);
        t.end();
    });

    t.end();
});

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
    var source;
    t.test('create source', function(t) {
        var CachedSource = TileliveCache({
            client: lruClient(),
            ttl: 1,
            stale: 1
        }, Testsource);
        source = new CachedSource({}, function(err) {
            assert.ifError(err);
            t.end();
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
    t.end();
});

test('refresh', function(t) {
    var source;
    t.test('create source', function(t) {
        var CachedSource = TileliveCache({
            client: lruClient(),
            ttl: 1,
            stale: 300
        }, Testsource);
        source = new CachedSource({}, function(err) {
            assert.ifError(err);
            t.end();
        });
    });

    var origExpires;
    t.test('tile 200 a miss', function(t) {
        source.getTile(0, 0, 0, function(err, data, headers) {
            origExpires = headers['x-tl-expires'];
            tile(tiles.a, false, function() {
                t.end();
            })(err, data, headers);
        });
    });
    t.test('tile 200 a hit (stale)', function(t) {
        setTimeout(function() {
            source.getTile(0, 0, 0, function(err, data, headers) {
                assert.equal(origExpires, headers['x-tl-expires']);
                tile(tiles.a, true, function(){
                    t.end();
                })(err, data, headers);
            });
        }, 1000);
    });
    t.test('tile 200 a hit (fresh)', function(t) {
        setTimeout(function() {
            source.getTile(0, 0, 0, function(err, data, headers) {
                assert.notEqual(origExpires, headers['x-tl-expires']);
                tile(tiles.a, true, function(){
                    t.end();
                })(err, data, headers);
                
            });
        }, 1000);
    });
    t.end();
});
    
test('upstream expires', function(t) {
    var customExpires;
    var stats = {};
    var getter = function(id, callback) {
        stats[id] = stats[id] || 0;
        stats[id]++;

        var err;
        if (id === 'missing') {
            err = new Error('Not found');
            err.statusCode = 404;
            return callback(err);
        }
        if (id === 'fatal') {
            err = new Error('Fatal');
            err.statusCode = 500;
            return callback(err);
        }
        if (id === 'nocode') {
            err = new Error('Unexpected');
            return callback(err);
        }

        return callback(null, {id:id}, { Expires: customExpires });
    };
    var wrapped = TileliveCache.cachingGet('test', {
        client: lruClient()
    }, getter);
    customExpires = (new Date(+new Date() + 1000)).toUTCString();
    
    t.test('getter 200 miss', function(t) {
        wrapped('asdf', function(err, data, headers) {
            assert.ifError(err);
            assert.deepEqual(data, {id:'asdf'}, 'returns data');
            assert.deepEqual(headers.expires, customExpires, 'passes customExpires through');
            assert.deepEqual(headers['x-tl-expires'], customExpires, 'sets x-tl-expires based on customExpires');
            assert.deepEqual(headers['x-tl-cache'], undefined, 'cache miss');
            assert.equal(stats.asdf, 1, 'asdf IO x1');
            t.end();
        });
    });
    t.test('getter 200 hit', function(t) {
        wrapped('asdf', function(err, data, headers) {
            assert.ifError(err);
            assert.deepEqual(data, {id:'asdf'}, 'returns data');
            assert.deepEqual(headers.expires, customExpires, 'passes customExpires through');
            assert.deepEqual(headers['x-tl-expires'], customExpires, 'sets x-tl-expires based on customExpires');
            assert.deepEqual(headers['x-tl-cache'], 'hit');
            assert.deepEqual(headers['x-tl-json'], true);
            assert.equal(stats.asdf, 1, 'asdf IO x1');
            t.end();
        });
    });
    t.test('getter 200 miss', function(t) {
        setTimeout(function() {
            wrapped('asdf', function(err, data, headers) {
                assert.ifError(err);
                assert.deepEqual(data, {id:'asdf'}, 'returns data');
                assert.deepEqual(headers.expires, customExpires, 'passes customExpires through');
                assert.deepEqual(headers['x-tl-expires'], customExpires, 'sets x-tl-expires based on customExpires');
                assert.deepEqual(headers['x-tl-cache'], undefined, 'cache miss');
                assert.equal(stats.asdf, 2, 'asdf IO x2');
                t.end();
            });
        }, 3000);
    });
    t.end();
});

test('cachingGet', function(t) {
    var stats = {};
    var getter = function(id, callback) {
        stats[id] = stats[id] || 0;
        stats[id]++;

        var err;
        if (id === 'missing') {
            err = new Error('Not found');
            err.statusCode = 404;
            return callback(err);
        }
        if (id === 'fatal') {
            err = new Error('Fatal');
            err.statusCode = 500;
            return callback(err);
        }
        if (id === 'nocode') {
            err = new Error('Unexpected');
            return callback(err);
        }

        return callback(null, {id:id});
    };
    var wrapped = TileliveCache.cachingGet('test', {
        client: lruClient()
    }, getter);
    t.test('getter 200 miss', function(t) {
        wrapped('asdf', function(err, data, headers) {
            assert.ifError(err);
            assert.deepEqual(data, {id:'asdf'}, 'returns data');
            assert.deepEqual(Object.keys(headers), ['x-tl-expires', 'x-tl-json'], 'sets x-tl-expires header');
            assert.equal(stats.asdf, 1, 'asdf IO x1');
            t.end();
        });
    });
    t.test('getter 200 hit', function(t) {
        wrapped('asdf', function(err, data, headers) {
            assert.ifError(err);
            assert.deepEqual(data, {id:'asdf'}, 'returns data');
            assert.deepEqual(Object.keys(headers), ['x-tl-expires', 'x-tl-json', 'x-tl-cache'], 'sets x-tl-expires header');
            assert.deepEqual(headers['x-tl-cache'], 'hit');
            assert.deepEqual(headers['x-tl-json'], true);
            assert.equal(stats.asdf, 1, 'asdf IO x1');
            t.end();
        });
    });
    t.test('getter 404 miss', function(t) {
        wrapped('missing', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Not found', 'not found err');
            assert.equal(err.statusCode, 404, 'err statusCode 404');
            assert.deepEqual(Object.keys(headers), ['x-tl-expires'], 'sets x-tl-expires header');
            assert.equal(stats.missing, 1, 'missing IO x1');
            t.end();
        });
    });
    t.test('getter 404 hit', function(t) {
        wrapped('missing', function(err, data, headers) {
            assert.equal(err.toString(), 'Error', 'not found err');
            assert.equal(err.statusCode, 404, 'err statusCode 404');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.missing, 1, 'missing IO x1');
            t.end();
        });
    });
    t.test('getter 500 miss', function(t) {
        wrapped('fatal', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Fatal', 'fatal err');
            assert.equal(err.statusCode, 500, 'err statusCode 500');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.fatal, 1, 'fatal IO x1');
            t.end();
        });
    });
    t.test('getter 500 miss', function(t) {
        wrapped('fatal', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Fatal', 'fatal err');
            assert.equal(err.statusCode, 500, 'err statusCode 500');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.fatal, 2, 'fatal IO x1');
            t.end();
        });
    });
    t.test('getter nocode', function(t) {
        wrapped('nocode', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Unexpected', 'unexpected err');
            assert.equal(err.statusCode, undefined, 'no err statusCode');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.nocode, 1, 'nocode IO x1');
            t.end();
        });
    });
    t.test('getter nocode', function(t) {
        wrapped('nocode', function(err, data, headers) {
            assert.equal(err.toString(), 'Error: Unexpected', 'unexpected err');
            assert.equal(err.statusCode, undefined, 'no err statusCode');
            assert.ok(!headers, 'no headers');
            assert.equal(stats.nocode, 2, 'nocode IO x1');
            t.end();
        });
    });
    t.end();
});


test('perf', function(t) {
    var buffer = require('fs').readFileSync(__dirname + '/encode-buster.pbf');
    t.test('encodes buster PBF in < 10ms', function(t) {
        var time = + new Date();
        for (var i = 0; i < 10; i++) TileliveCache.encode(null, buffer);
        time = + new Date() - time;
        assert.equal(time < 10, true, 'encodes buster PBF 10x in ' + time + 'ms');
        t.end();
    });
    t.end();
});


test('perf-source', function(t) {
    var source;
    t.test('create source', function(t) {
        var CachedSource = TileliveCache({
            client: lruClient()
        }, Testsource);
        source = new CachedSource({hostname: 'perf'}, function(err) {
            assert.ifError(err);
            t.end();
        });
    });
    t.test('gets buster tile 10x in < 20ms', function(t) {
        var remaining = 10;
        var time = + new Date();
        for (var i = 0; i < 10; i++) source.getTile(0,0,0, function(err, data /*, headers */) {
            assert.ifError(err);
            assert.equal(data.length, 783167);
            if (!--remaining) {
                time = + new Date() - time;
                assert.equal(time < 40, true, 'getTile buster PBF 10x in ' + time + 'ms');
                t.end();
            }
        });
    });
    t.end();
});
