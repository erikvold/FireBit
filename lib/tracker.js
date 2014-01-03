/*
 * @desc: This is the tracker module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: tracker.js
 * @date: Thursday, October 24, 2013 (CDT)
 */

// Exports: { readAnnounce }


const { BINARY, CHARS } = require('./literals');
const { bencode } = require('./utils/bencode');
const { inet_ntoa, readUInt32, readUInt16 } = require('./utils/binary');
const { defer } = require('sdk/core/promise');
const { Class } = require('sdk/core/heritage');
const { Packet, UDPServer } = require('./utils/udp');
var requests = {}; pendingRequests = [];
var { Request } = require('sdk/request');

function escapeHash (hash) {
    var hex = hash.match(CHARS.HEX),
        char, string = '',
        valid = CHARS.ASCII;
    for (var i = 0; i < hex.length; i++) {
        char = unescape('%' + hex[i]);
        if (valid.test(char)) {
            string += char;
        } else {
            string += '%' + hex[i];
        }
    }
    return string;
}

function formatStats (tracker) {
    if (tracker.response) {
        try {
            tracker.response = bencode(tracker.response);
        } catch (error) {
            errlog(error); return tracker;
        }
        tracker.stats = '';
        if (tracker.response.hasOwnProperty('complete') && !isNaN(parseInt(tracker.response.complete)))
            tracker.stats = 'Seeds: ' + tracker.response.complete + ',&nbsp;&nbsp;&nbsp;';
        else tracker.stats += 'Seeds: 0,&nbsp;&nbsp;&nbsp;';
        if (tracker.response.hasOwnProperty('incomplete') && !isNaN(parseInt(tracker.response.incomplete)))
            tracker.stats += 'Peers: ' + tracker.response.incomplete + ',&nbsp;&nbsp;&nbsp;';
        else tracker.stats += 'Peers: 0,&nbsp;&nbsp;&nbsp;';
        if (tracker.response.hasOwnProperty('downloaded') && !isNaN(parseInt(tracker.response.downloaded)))
            tracker.stats += 'Complete: ' + tracker.response.downloaded;
        else tracker.stats += 'Complete: 0';
        if (tracker.response.hasOwnProperty('peers')) {
            tracker.peers = tracker.response.peers.split('');
            var segments = [];
            while (tracker.peers.length) {
                segments.push(tracker.peers.slice(0, 6).join(''));
                tracker.peers.splice(0, 6);
            }
            tracker.peers = segments;
            for (var i = 0; i < tracker.peers.length; i++) {
                tracker.peers[i] = inet_ntoa(readUInt32(tracker.peers[i], 0)) + ':' + readUInt16(tracker.peers[i], 4);
            }
        } else tracker.peers = false;
    }
    return tracker;
}

exports.readAnnounce = function(tracker) {
    var deferred = defer(), url = tracker.url;;
    tracker.url = url.protocol + '://' + url.host;
    if (url.port !== '') tracker.url += ':' + url.port;
    if (url.path !== '') tracker.url += url.path;
    else tracker.url += '/announce';
    if (url.query !== '') tracker.url += url.query + '&info_hash=';
    else tracker.url += '?info_hash=';
    tracker.url += escapeHash(tracker.hash)
            + '&peer_id=ABCDEFGHIJKLMNOPQRST' + '&ip=255.255.255.255'
            + '&port=6881' + '&uploaded=0' + '&downloaded=0' + '&left=1'
            + '&event=started' + '&numwant=100' + '&compact=1';
    Request({
        url: tracker.url,
        overrideMimeType: BINARY.IO.MIMETYPE,
        onComplete: function (response) {
            if (response.status === 200 && response.text) {
                tracker.response = response.text;
                tracker.statusText = 'HTTP: 200 OK';
            } else {
                tracker.response = false;
                if (response.statusText) tracker.statusText = 'Error: ' + response.statusText;
                else tracker.statusText = 'Error: Invalid response';
            }
            deferred.resolve(formatStats(tracker));
        }
    }).get();
    return deferred.promise;
};

var TrackerPacket = Class({
    extends: Packet,
    initialize: function initialize(bytes) {
        if (bytes < 16) throw Error('Invalid bytes specified for UDP Tracker Protocol packet construction.')
        Packet.prototype.initialize.call(this, bytes);
        this.trans_id = this.id = parseInt(Math.random() * (0xFFFFFFFF - 1));

    },
    set conn_id(uInt8Arr) this.data.set(uInt8Arr, 0), // Current Limitation: Unable to set/get Uint64 values from ArrayBuffer
    set action(int32) this.view.setUint32(8, int32), /* 1: announce, 2: scrape */
    set trans_id(int32) {
        if (!(+int32)) throw Error('Invalid transaction id specified')  /* Transaction ID */
        this.view.setUint32(12, int32)
    },
    id: -1
})

var ConnectPacket = Class({
    extends: TrackerPacket,
    initialize: function initialize() {
        TrackerPacket.prototype.initialize.call(this, 16); /* 16 Bytes */
        this.conn_id = [0, 0, 0x04, 0x17, 0x27, 0x10, 0x19, 0x80]; /* Initial Connection ID */
    }
});

var AnnouncePacket = Class({
    extends: TrackerPacket,
    initialize: function initialize(conn_id, options) {
        TrackerPacket.prototype.initialize.call(this, 98); /* 98 Bytes */
        this.conn_id = conn_id; /* Connection ID */
        this.action = 1; /* Action: announce */
        if (!options.hash || !options.hash.length) throw Error('Invalid info hash argument.');
        this.info_hash = options.hash;
        this.peer_id = Array.apply(null, Array(20)).map(function () {
            return parseInt(Math.random() * 0xFF); // I'll change this later
        });
        if (options.downloaded) this.downloaded = options.downloaded;
        if (options.left) this.left = options.left;
        if (options.uploaded) this.uploaded = options.uploaded;
        if (options.event) this.event = options.event;
        //if (options.ip) this.ip_addr = options.ip; // Conversion unimplemented
        if (options.key) this.key = options.key;
        if (options.peers) this.num_want = options.peers;
        if (options.port) this.port = options.port;
    },
    set info_hash(hexDigest) {
        if (hexDigest.length !== 40) throw Error('Invalid Info Hash string passed to Announce packet constructor.')
        var uInt8Arr = hexDigest.match(/../g).map(function (hex) {
            return parseInt(hex, 16);
        });
        this.data.set(uInt8Arr, 16);
    },
    set peer_id(uInt8Arr) {
        if (uInt8Arr.length !== 20) throw Error('Invalid Peer ID generated for Announce packet.');
        this.data.set(uInt8Arr, 36);
    },
    set downloaded(uInt32) { // This needs to allow for an unsigned 64 bit integer maybe using a bignum library.
        // For now values will be 32 bit at a plus +4 byte offset to occupy the 64 bit integer (offset + 8 byte) space
        this.view.setUint32(56+4, uInt32);
    },
    set left(uInt32) this.view.setUint32(64+4, uInt32),
    set uploaded(uInt32) this.view.setUint32(72+4, uInt32),
    set event(uInt32) this.view.setUint32(80, uInt32 ), // 0: none, 1: completed, 2: started, 3: stopped
    set ip_addr(uInt32) this.view.setUint32(84, uInt32), // IP must be converted to integer before using this method.
    set key(uInt32) this.view.setUint32(88, uInt32), // Unknown usage.
    set num_want(uInt32) this.view.setUint32(92, uInt32),
    set port(uInt16) this.view.setUint16(96, uInt16)
});

var ScrapePacket = Class({
    extends: TrackerPacket,
    initialize: function initialize(conn_id, options) {
        var hashes = options.hashes;
        if (!hashes || !hashes.length) throw Error('Hashes parameter must be of type array and non-empty.');
        TrackerPacket.prototype.initialize.call(this, 16+(20*hashes.length));
        this.conn_id = conn_id;
        this.action = 2; /* Action: scrape */
        for (var i = 0; i < hashes.length; i++) {
            if (hashes[i].length !== 40) throw Error('Invalid Info Hash string passed to Scrape packet constructor.');
            this.data.set(hashes[i].match(/../g).map(function (hex) {
                return parseInt(hex, 16);
            }), 16+(20*i));
        }
    }
});

exports.TrackerRequest = Class({
    initialize: function initialize(aPort) {
        if (this.server.listener.defaultListener) {
            this.server.listener = {
                onStartListening: (function (aSocket) {
                    this.listening = true;
                    while (pendingRequests.length) pendingRequests.shift()(); // Ensure that the server is listening to the socket before sending requests.
                }).bind(this),
                onStopListening: function (aSocket, aStatus) {
                    pendingRequests = [];
                },
                onPacketReceived: function (aSocket, aMessage) {
                    TrackerRequest.prototype.onResponse(aMessage);
                }
            };
        }
        if (this.server.closed) this.server.listen(aPort);
        else this.listening = true;
    },
    server: new UDPServer(),
    send: function (action, host, port, options) {
        if (!options.onload || (typeof options.onload !== 'function'))
            throw Error('Callback option is unset in UDP tracker request.');
        if (action !== 'announce' && action !== 'scrape') throw Error('Invalid UDP tracker action request.');
        var packet = new ConnectPacket();
        requests[packet.id] = {host: host, port: port, options: options, action: action, sender: this};
        if (!this.listening) {
            pendingRequests.push(this.server.send.bind(this.server, host, port, packet.data));
        } else {
            this.server.send(host, port, packet.data);
        }
    },
    announce: function (aHost, aPort, options) {
        this.send.call(this, 'announce', aHost, aPort, options);
    },
    scrape: function (aHost, aPort, options) {
        this.send.call(this, 'scrape', aHost, aPort, options);
    },
    onResponse: function (aMessage) {
        if (aMessage.data.length >= 8) {
            var data = new Uint8Array(aMessage.data.length);
            data.set(aMessage.data.split('').map(function (c) {
                return String.charCodeAt(c);
            }));
            var view = new DataView(data.buffer);
            var action = view.getUint32(0); /* Action ID */
            var id = view.getUint32(4); /* Transaction ID */
            var conn_id = data.subarray(8); /* Connection ID */
            var packet, request = requests[id], reportErrors, error;
            if (request) {
                delete requests[id];
                var server = request.sender.server;
                if (typeof request.options.onerror === 'function') reportErrors = true;
                switch (action) {
                    case 0: /* Connect Response */
                        if (request.action === 'announce') packet = new AnnouncePacket(conn_id, request.options);
                        else if (request.action === 'scrape') packet = new ScrapePacket(conn_id, request.options);
                        if (packet) {
                            requests[packet.id] = request;
                            if (!request.sender.listening) {
                                pendingRequests.push(server.send.bind(server, request.host, request.port, packet.data));
                            } else {
                                server.send(request.host, request.port, packet.data);
                            }
                        }
                        break;
                    case 1: /* Announce Response */
                        if (request.action === 'announce') {
                            if (data.length >= 20) {
                                var response = {
                                    interval: view.getUint32(8),
                                    leechers: view.getUint32(12),
                                    seeders: view.getUint32(16),
                                    peers: []
                                };
                                var peers = (data.length-20)/6;
                                if (peers && !(peers&1)) {
                                    for (var i = 0; i < peers; i++) {
                                        response.peers.push({
                                            address: inet_ntoa(view.getUint32(20+(6*i))),
                                            port: view.getUint16(24+(6*i))
                                        });
                                    }
                                }
                                request.options.onload(response);
                            } else if (reportErrors) {
                                error = {
                                    message: 'Tracker has not seen this torrent.',
                                    code: 1
                                };
                            }
                        } else if (reportErrors) {
                            error = {
                                message: 'Tracker responded with an invalid action ID.',
                                code: 2
                            };
                        }
                        break;
                    case 2: /* Scrape Response */
                        if (request.action === 'scrape') {
                            if (data.length >= 8) {
                                var stats = [], sets = (data.length-8)/12;
                                if (sets && !(sets&1)) {
                                    for (var i = 0; i < sets; i++) {
                                        stats.push({
                                           seeders: view.getUint32(8+(12*i)),
                                           completed: view.getUint32(12+(12*i)),
                                           leechers: view.getUint32(16+(12*i))
                                        });
                                    }
                                }
                                if (stats.length) request.options.onload(stats);
                                else if (reportErrors) {
                                    error = {
                                        message: 'Tracker response did not contain stats.',
                                        code: 3
                                    };
                                }
                            } else if (reportErrors) {
                                error = {
                                    message: 'Tracker has not seen this torrent.',
                                    code: 1
                                }
                            }
                        } else if (reportErrors) {
                            error = {
                                message: 'Tracker responded with an invalid action ID.',
                                code: 2
                            };
                        }
                        break;
                    case 3: /* Error Response */
                        if (reportErrors) {
                            error = {
                                message: aMessage.data.substr(8),
                                code: 4
                            };
                        }
                }
                if (error) request.options.onerror(error);
            }
        }
    }
});

/*
var request = new TrackerRequest();

request.announce('31.172.63.253', 80, {
    hash: '52130B24D31AC58A3D277B85245B0672EBC9A578',
    onload: function (response) {
        console.error('Interval: ' + response.interval);
        console.error('Leechers: ' + response.leechers);
        console.error('Seeders: ' + response.seeders);
        for (var i = 0; i < response.peers.length; i++) {
            console.error(response.peers[i].address + ' :: ' + response.peers[i].port);
        }
    },
    onerror: function (error) {
        console.error(error.message);
    },
    peers: 50,
    event: 2
});

request.scrape('31.172.63.253', 80, {
    hashes: ['52130B24D31AC58A3D277B85245B0672EBC9A578'],
    onload: function (stats) {
        var torrent;
        for (var i = 0; i < stats.length; i++) {
            torrent = stats[i];
            console.error('Seeders: ' + torrent.seeders);
            console.error('Leechers: ' + torrent.leechers);
            console.error('Completed: ' + torrent.completed);
        }
    },
    onerror: function (error) {
        console.error(error.message);
    }
});
*/
