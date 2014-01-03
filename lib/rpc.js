const { Class } = require('sdk/core/heritage');
const { Packet } = require('./utils/udp');
const { defer } = require('sdk/core/promise');
const { bencode, bdecode } = require('./utils/bencode');
require('./bytes').define(String);

// see: http://www.bittorrent.org/beps/bep_0005.html

const TID = 't', REQ = 'q', RSP = 'r', TYP = 'y', ARG = 'a', ERR = 'e';

const COMPACT_NODE_LENGTH = 26, COMPACT_PEER_LENGTH = 6;
const NODE_ID_LENGTH = COMPACT_NODE_LENGTH - COMPACT_PEER_LENGTH;

var Promise = Class({
    initialize: function initialize() {
        this.deferred = defer();
    },
    deferred: null,
    resolve: function (result) {
        this.deferred.resolve(result);
    },
    reject: function (result) {
        this.deferred.reject(result);
    },
    then: function (resolve, reject) {
        this.deferred.promise.then(resolve, reject);
    },
});

var RPC = Class({
    extends: Packet,
    initialize: function initialize(/* Response */id) {
        if (!id) { // Random bytes for the transaction ID
            var codePoints = [parseInt(Math.random() * 0xFF)+1, parseInt(Math.random() * 0xFF)+1]
            this.id = codePoints.join('');
            // I convert the points to string because I need to bencode RPC's internalObject
            // I'm sure this could be optimized.
            id = String.fromCharCode.apply(null, codePoints);
        }
        // If we didn't generate the id then the id is the transaction id of the query we're responding to.
        this.internalObject = {t: id, y:''};
    },
    id: '', // The transaction ID
    set: function (obj) {
        // copy the properties from "obj" to the internalObject
        for (var property in obj)
            this.internalObject[property] = obj[property];

        // bencode the result
        this.bencoded = bencode(this.internalObject);
        // pass the bytes to the Packet constructor
        Packet.prototype.initialize.call(this, this.bencoded.bytes);
        return this; // Nothing else to return here so return this
    },
    setQuery: function (type, arguments) {
        // query type and arguments are the variants in a DHT query
        return this.set({y: 'q', q: type, a: arguments});
    },
    setResponse: function (arguments) {
        return this.set({y: 'r', r: arguments});
    },
    setError: function (error) {
        return this.set({y: 'e', e: error});
    },
    validLength: function (obj, length) {
        return (obj && obj.length && (obj.length === +obj.length) && !(obj.length%length));
    },
    bencoded: '',
    parse: function (message) {
        message.rawData = message.data;
        var data, arguments;
        try {
            data = bdecode(message.rawData);
        } catch (error) {
            return message;
        }
        message.data = data || {};
        message.sender = {address: message.fromAddr.address, port: message.fromAddr.port};
        if (data[TID]) {
            if (data[TYP] === RSP) {
                message.id = data[TID].split('').map(function (c) {
                    return String.charCodeAt(c);
                }).join('');
                if (arguments = data[RSP]) {
                    var values = arguments.values, nodes = arguments.nodes;
                    if (RPC.prototype.validLength(values, COMPACT_PEER_LENGTH)) {
                        message.values = values;
                    } else if (RPC.prototype.validLength(nodes, COMPACT_NODE_LENGTH)) {
                        message.nodes = nodes;
                    }
                }
                message.type = 'response';
            } else if (data[TYP] === REQ) {
                message.id = data[TID];
                if (arguments = data[ARG])
                    arguments.type = data[REQ];
                message.type = 'query'
            } else if (data[TYP] === ERR) {
                message.id = data[TID];
                message.error = data[ERR] ? data[ERR] : [];
                message.type = 'error';
            }
            if (arguments && arguments.id && arguments.id.length === NODE_ID_LENGTH)
                message.sender.id = arguments.id;
            message.arguments = arguments;
        } 
        return message;
    },
    internalObject: null
});

exports.RPC = RPC;

var Query = Class({
    extends: RPC,
    implements: [Promise],
    initialize: function initialize(type, arguments) {
        Promise.prototype.initialize.call(this);
        RPC.prototype.initialize.call(this);
        // Store type and arguments for later
        this.type = type; this.arguments = arguments;
        this.setQuery(type, arguments);
    }
});

var Response = Class({
    extends: RPC,
    initialize: function initialize(id, arguments, error) {
        RPC.prototype.initialize.call(this, id);
        if (error) this.setError(error);
        else this.setResponse(arguments);
    }
});

// DHT is node

exports.FindNode = Class({
    extends: Query,
    initialize: function initialize(dht, node) {
        Query.prototype.initialize.call(this, 'find_node', {id: dht.id, target: node.id});
    }
});

exports.GetPeers = Class({
    extends: Query,
    initialize: function initialize(dht, hash) {
        Query.prototype.initialize.call(this, 'get_peers', {id: dht.id, info_hash: hash});
    }
});

exports.Ping = Class({
    extends: Query,
    initialize: function initialize(dht) {
        Query.prototype.initialize.call(this, 'ping', {id: dht.id});
    }
});

exports.Pong = Class({
    extends: Response,
    initialize: function initialize(dht, id) {
        Response.prototype.initialize.call(this, id, {id: dht.id})
    }
});

exports.GiveNodes = Class({
    extends: Response,
    initialize: function initialize(dht, id, nodes) {
        Response.prototype.initialize.call(this, id, {id: dht.id, nodes: nodes})
    }
});

exports.GivePeers = Class({
    extends: Response,
    initialize: function initialize(dht, id, values) {
        Response.prototype.initialize.call(this, id, {id: dht.id, values: values})
    }
});

exports.GiveError = Class({
    extends: Response,
    initialize: function initialize(id, error) {
        Response.prototype.initialize.call(this, id, null, error)
    }
});