// The alleged author of these functions is Aadit M Shah @ stackoverflow.com
// Modified by: Rodney Teal

/*
    -9007199254740990 to 9007199254740990
*/

function isInt(n) {
    return ((n === +n) && (n === (n|0)));
}

function isUint(n, bits) {
    return (isInt(n) && (n < Math.pow(2, bits)) && (n >= 0));
}

function bytesRequired(n) {
    var bits = n.toString(2).length;
    var bytes = (bits/8);
    if (bits&1) bytes += 1;
    if (!bytes) bytes = 1;
    else bytes = abs(bytes);
    return bytes;
}

function abs(n) {
    var mask; return ((n ^ (mask = (n >> 31))) - mask);
}

/*
    -128 to 127
*/

function isInt8(n) {
    return isInt(n) && n < 0x80 && n >= -0x80;
}

/*
    -32768 to 32767
*/

function isInt16(n) {
    return isInt(n) && n < 0x8000 && n >= -0x8000;
}

/*
    -2147483648 to 2147483647
*/

function isInt32(n) {
    return isInt(n) && n < 0x80000000 && n >= -0x80000000;
}

/*
    0 to 9007199254740990
*/


/*
    Any number including Infinity and -Infinity but not NaN
*/

function isFloat(n) {
    return ((n === +n) && (n !== (n|0)));
}

/*
    Any number from -3.4028234e+38 to 3.4028234e+38 (Single-precision floating-point format)
*/

function isFloat32(n) {
    return isFloat(n) && Math.abs(n) <= 3.4028234e+38;
}

/*
    Any number excluding Infinity and -Infinity and NaN (Number.MAX_VALUE = 1.7976931348623157e+308)
*/

function isFloat64(n) {
    return isFloat(n) && Math.abs(n) <= 1.7976931348623157e+308;
}



let UDPTP = Class({
    extends: UDP,
    initialize: function initialize() {
        // Define Setters and/or Getters for working with the collected UDPTP properties as Uint8Arrays
        ['downloaded', 'left', 'uploaded'].map(function (stat) {
            this.defineBuffer(stat, 64);
        }, this);
        ['none', 'completed', 'started', 'stopped'].map(function (event, index) {
            Object.defineProperty(this.events, event, this.Uint32Desc(index));
        }, this);
        this.defineBuffer('hash', 20/*bytes*/, true);
        this.defineBuffer('port', 16);
        ['ip_addr', 'key', 'num_want'].map(function (prop) {
            this.defineBuffer(prop, 32);
        }, this);
    },
    actions: {}, buffer: {}, events: {},
    Uint32Desc: function (integer) {
        var THIS = this;
        return {
            __proto__: null,
            get: function () {
                return uIntByteArray(integer, 32);
            },
            set: function () {}
        };
    },
    defineBuffer: function (property, bytes, lengthIsBytes, parse) {
        Object.defineProperty(this, property, {
            __proto__: null,
            set: function (value) {
                this.buffer[property] = uIntByteArray(value, bytes, lengthIsBytes, parse);
            },
            get: function () {
                return this.buffer[property] ? this.buffer[property] : uIntByteArray(0, bytes, lengthIsBytes, parse);
            }
        });
    },
    get peer_id() {
        return /*byte[]*/new Array(20).map(function () {
            return parseInt(Math.random() * 0xFF);
        }});
    },
    get conn_id() uIntByteArray(0x41727101980, 64),
    get tran_id() {
        var bytes = uIntByteArray(parseInt(Math.random() * (0xFFFFFFFF - 1)), 32);
        return {
            bytes: bytes,
            integer: ((bytes[0] & 0xFF) << 24) + ((bytes[1] & 0xFF) << 16) + ((bytes[2] & 0xFF) << 8) + (bytes[3] & 0xFF)
        };
    },
    connect: function () {
        var tran_id = this.tran_id;
        var packet = Array.prototype.concat(this.conn_id, [0, 0, 0, 0], tran_id.bytes);
        if (packet.length !== 16) throw Error('Invalid connect packet size.');
        requests[tran_id.integer] = this;
        this.socket.send(packet, packet.length);
    },
    announce: function (conn_id) {
        var tran_id = this.tran_id;
        var packet = Array.prototype.concat(conn_id, [0, 0, 0, 1], tran_id.bytes,
                this.hash, this.peer_id, this.downloaded, this.left, this.uploaded,
                this.events.started, this.ip_addr, this.key, this.num_want, this.port);
        if (packet.length !== 98) throw Error('Invalid announce packet size.');
        requests[tran_id.integer] = this;
        this.socket.send(packet, packet.length);
    },
    response: function (packet) {
        if (packet.length < 8 || packet.length&1) throw Error('Invalid response packet size.');
        var tran_id = readUInt32(packet, 4);
        var requestor = requests[tran_id];
        if (requestor) {
            delete requests[tran_id];
            switch (packet.charCodeAt(3)) {
                case 0/*connect*/:
                    if (packet.length !== 16) throw Error('Invalid connect response packet size.') ;
                    this.announce(packet.substr(8).split('').map(function (char) {
                        return String.charCodeAt(char);
                    }));
                    break;
                case 1/*announce*/:
                    if (packet.length < 20) throw Error('Invalid announce response packet size.');
                    var response = {
                        interval:  readUInt32(packet, 8),
                        leechers:  readUInt32(packet, 12),
                        seeders:  readUInt32(packet, 16),
                        peers: []
                    };
                    var peers = packet.slice(20);
                    if (peers.length && !(peers.length%6)) {
                        var length = peers.length/6;
                        for (var i = 0; i < length; i++) {
                            response.peers.push({
                                ip_addr: inet_ntoa(readUInt32(peers, i)),
                                port: readUInt16(peers, i+4)
                            });
                        }
                    }
                    requestor.onload(response);
                    break;
                case 3/*error*/:
                    if (typeof requestor.onerror === 'function')
                        requestor.onerror({ message: packet.substr(8) });
                default:
                    throw Error('Invalid action code in response.');
            }
        }
    },
    onPacketReceived: function (aServ, aMessage) {
        this.response(aMessage.data);
    }
});
/*
var query = new UDPTP();

var packet = query.scrape(query.conn_id).tran_id;
//query.hash = '19';
//console.error(query.hash);
console.error(packet.length);
//console.error(query.verify(packet, 98));
*/


/*

        //ip = ip.split('.');
        //for (var i = 0; i < 4; i++) ip[i] = parseInt(ip[i]);
        //this.ip_addr = uIntByteArray(((ip[0] * 0x1000000) + (ip[1] * 0x10000) + (ip[2] * 0x100) + (ip[3])), 32);

var TrackerRequest = Class({
    extends: UDPTP,
    initialize: function initialize(options) {
        TrackerQuery.prototype.initialize.call(this);
        this.addr = options.addr;
        this.port = options.port ? options.port : 80;
        this.hash = options.hash ? options.hash : '';
        this.peer = (options.peer && options.peer.length === 20/*bytes*///) ? options.peer : 'ABCDEFGHIJKLMNOPQRST';
/*
        this.numwant = options.numwant ? options.numwant : 10;
        this.buffer.map(function () {})
    }
});

var req = new TrackerRequest({
    addr: '31.172.63.253',
    hash: '245208A05454D88D2E44D4D07F58C362A21721D7'
});

*/
var lock;
var request = new UDPTP();
let udpServer = {
  _server: null,
  init: function() {
    this._server = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket);
    this._server.init(49941, false);
    request.hash = '52130B24D31AC58A3D277B85245B0672EBC9A578';
    request.num_want = 50;
    var data = request.connect();
    requests[data.tran_id] = request;
    console.error('Transaction ID is ' + data.tran_id);
    console.error('Sent: ' + data.packet.toString() + '\nLength: ' + data.packet.length);
    this._server.send('31.172.63.253', '80', data.packet, data.packet.length);
    this._server.asyncListen(this);
  },
  uninit: function() {
    this._server.close();
  },
  onStopListening: function(aServ, aStatus) { console.error('STOPPED.'); },
  onPacketReceived: function(aServ, aMessage) {
        UDPTP.prototype.response(aMessage.data);
};
peer_id() {
        
    },
    get tran_id() {
        var bytes = uIntByteArray(parseInt(Math.random() * (0xFFFFFFFF - 1)), 32);
        return {
            bytes: bytes,
            integer: ((bytes[0] & 0xFF) << 24) + ((bytes[1] & 0xFF) << 16) + ((bytes[2] & 0xFF) << 8) + (bytes[3] & 0xFF)
        };
    },
    connect: function () {
        var tran_id = this.tran_id;
        var packet = Array.prototype.concat(this.conn_id, [0, 0, 0, 0], tran_id.bytes);
        if (packet.length !== 16) throw Error('Invalid connect packet size.');
        requests[tran_id.integer] = this;
        this.socket.send(packet, packet.length);
    },
    announce: function (conn_id) {
        var tran_id = this.tran_id;
        var packet = Array.prototype.concat(conn_id, [0, 0, 0, 1], tran_id.bytes,
                this.hash, this.peer_id, this.downloaded, this.left, this.uploaded,
                this.events.started, this.ip_addr, this.key, this.num_want, this.port);
        if (packet.length !== 98) throw Error('Invalid announce packet size.');
        requests[tran_id.integer] = this;
        this.socket.send(packet, packet.length);
    },
    response: function (packet) {
        if (packet.length < 8 || packet.length&1) throw Error('Invalid response packet size.');
        var tran_id = readUInt32(packet, 4);
        var requestor = requests[tran_id];
        if (requestor) {
            delete requests[tran_id];
            switch (packet.charCodeAt(3)) {
                case 0/*connect*/:
                    if (packet.length !== 16) throw Error('Invalid connect response packet size.') ;
                    this.announce(packet.substr(8).split('').map(function (char) {
                        return String.charCodeAt(char);
                    }));
                    break;
                case 1/*announce*/:
                    if (packet.length < 20) throw Error('Invalid announce response packet size.');
                    var response = {
                        interval:  readUInt32(packet, 8),
                        leechers:  readUInt32(packet, 12),
                        seeders:  readUInt32(packet, 16),
                        peers: []
                    };
                    var peers = packet.slice(20);
                    if (peers.length && !(peers.length%6)) {
                        var length = peers.length/6;
                        for (var i = 0; i < length; i++) {
                            response.peers.push({
                                ip_addr: inet_ntoa(readUInt32(peers, i)),
                                port: readUInt16(peers, i+4)
                            });
                        }
                    }
                    requestor.onload(response);
                    break;
                case 3/*error*/:
                    if (typeof requestor.onerror === 'function')
                        requestor.onerror({ message: packet.substr(8) });
                default:
                    throw Error('Invalid action code in response.');
            }
        }
    }



var packet = new ConnectPacket();
requests[packet.id] = // ...
send(host, port, packet.data)



    function StrungUint8Array(str) {
        var uIntArr = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++)
            uIntArr[i] = (String.charCodeAt(str[i]) & 0xFF);
        return uIntArr;
    }

