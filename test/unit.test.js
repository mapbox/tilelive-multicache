var assert = require('assert');
var tap = require('tap');
var TileliveCache = require('../index');
var bufferEqual = require('buffer-equal');

var test = tap.test;

test(' encode', function(t) {
    var errstatCode404 = new Error(); errstatCode404.statusCode = 404;
    var errstatCode403 = new Error(); errstatCode403.statusCode = 403;
    var errstatCode500 = new Error(); errstatCode500.statusCode = 500;
    assert.equal(TileliveCache.encode(errstatCode404), '404');
    assert.equal(TileliveCache.encode(errstatCode403), '403');
    assert.equal(TileliveCache.encode(errstatCode500), null);

    assert.ok(bufferEqual(TileliveCache.encode(null, {id:'foo'}), new Buffer(
        '{"x-tl-json":true}' +
        new Array(1025 - '{"x-tl-json":true}'.length).join(' ') +
        '{"id":"foo"}'
    )), 'encodes object');

    assert.ok(bufferEqual(TileliveCache.encode(null, 'hello world'), new Buffer(
        '{}' +
        new Array(1025 - '{}'.length).join(' ') +
        'hello world'
    ), 'encodes string'));

    assert.ok(bufferEqual(TileliveCache.encode(null, new Buffer(0)), new Buffer(
        '{}' +
        new Array(1025 - '{}'.length).join(' ') +
        ''
    ), 'encodes empty buffer'));

    assert.ok(bufferEqual(TileliveCache.encode(null, new Buffer(0), { 'content-type': 'image/png' }), new Buffer(
        '{"content-type":"image/png"}' +
        new Array(1025 - '{"content-type":"image/png"}'.length).join(' ') +
        ''
    ), 'encodes headers'));

    assert.throws(function() {
        TileliveCache.encode(null, new Buffer(0), { data: new Array(1024).join(' ') });
    }, Error, 'throws when headers exceed 1024 bytes');

    t.end();
});

test('decode', function(t) {
    assert.deepEqual(TileliveCache.decode('404'), {err:{statusCode:404,tlcache:true}});
    assert.deepEqual(TileliveCache.decode('403'), {err:{statusCode:403,tlcache:true}});

    var headers = JSON.stringify({'x-tl-json':true,'x-tl-cache':'hit'});
    var encoded = new Buffer(
        headers +
        new Array(1025 - headers.length).join(' ') +
        JSON.stringify({'id':'foo'})
    );
    assert.deepEqual(TileliveCache.decode(encoded), {
        headers:{'x-tl-json':true,'x-tl-cache':'hit'},
        buffer:{'id':'foo'}
    }, 'decodes object');

    headers = JSON.stringify({'x-tl-cache':'hit'});
    encoded = new Buffer(
        headers +
        new Array(1025 - headers.length).join(' ') +
        'hello world'
    );
    assert.deepEqual(TileliveCache.decode(encoded), {
        headers:{'x-tl-cache':'hit'},
        buffer: new Buffer('hello world')
    }, 'decodes string (as buffer)');

    headers = JSON.stringify({'x-tl-cache':'hit'});
    encoded = new Buffer(
        headers +
        new Array(1025 - headers.length).join(' ') +
        ''
    );
    assert.deepEqual(TileliveCache.decode(encoded), {
        headers:{'x-tl-cache':'hit'},
        buffer: new Buffer(0)
    }, 'decodes empty buffer');

    encoded = new Buffer('bogus');
    assert.throws(function() {
        TileliveCache.decode(encoded);
    }, Error, 'throws when encoded buffer does not include headers');

    t.end();
});
