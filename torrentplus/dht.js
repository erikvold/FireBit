///*
var { UDPServer } = require('./utils/udp');
const { Class } = require('sdk/core/heritage');
const { SHA1 } = require('./utils/crypto');
const { Addr } = require('./addr');
const { Peer } = require('./peer');
const { Node } = require('./node');
const { Cc, Ci } = require('chrome');
var { EventTarget } = require("sdk/event/target");
var { emit } = require("sdk/event/core");
var { merge } = require("sdk/util/object");
var { setTimeout, clearTimeout, setInterval } = require('sdk/timers');
let { ns } = require('sdk/core/namespace');
var events = require("sdk/system/events");
var ss = require("sdk/simple-storage");
//*/

var DHT = ns();

const { FindNode, GetPeers, Ping, Pong, GiveNodes, GivePeers, GiveError, RPC } = require('./krpc');

var user_active = false;

events.on('user-interaction-active', function () {
    user_active = true;
});

events.on('user-interaction-inactive', function () {
    user_active = false;
});

///*
const K = 8, MAXIMUM_FAILURES = 3, FAKE_NODE = {id: -1}, REFRESH_INTERVAL = 900000; /* 15 mins */
const RECHECK_INTERVAL = 120000; /* 2 mins */
const MAXIMUM_REQUESTS = 16, MAXIMUM_REQUESTS_UACTIVE = 8, MAXIMUM_PIPELINE = 168;
const REQUEST_TIMEOUT = 5000 /* 5 secs */, BLACKLIST_TIMEOUT = 90000; /* 90 secs */
const MAXIMUM_BLACKLIST = 100, MAXIMUM_PEERQUERIED = 500, PEERQUERIED_TIMEOUT = RECHECK_INTERVAL;
const CHECK_PEERQUERIED = 60000; /* 1 min */
const INVALID_ARGS = 'Invalid arguments passed to function.';
const MAXIMUM_BUCKETS = 160, COMPACT_NODE_LENGTH = 26, COMPACT_PEER_LENGTH = 6;
const COMPACT_PEERS = new RegExp('.{' + COMPACT_PEER_LENGTH + '}', 'g');
const COMPACT_NODES = new RegExp('.{' + COMPACT_NODE_LENGTH + '}', 'g');
const NODE_ID_LENGTH = COMPACT_NODE_LENGTH - COMPACT_PEER_LENGTH;
const BOOTSTRAP_TIMEOUT = 20000;
//*/



var Bucket = Class({
    implements: [Timer],
    initialize: function initialize(table, index) {
        if (!(table instanceof Array)) throw TypeError(INVALID_ARGS);
        this.table = table;
        this.table.splice(index, 0, this);
        if (!index) this.persist = true;
        this.stamp();
        this.length = 0;
    },
    indexOf: function (node) {
        var i = this.length;
        while (i--) {
            if (this[i].equals(node)) return i;
        }
        return -1;
    },
    get replaceableIndex() {
        var index = -1, failures = 0; i = this.length;
        while (i--) {
            if (this[i].failures > failures) {
                index = i;
                failures = this[i].failures;
            }
        }
        return index;
    },
    split: function (dht, node) {
        if (!(dht instanceof Node)) throw TypeError(INVALID_ARGS);
        this.push(node, true, true);
        this.sortBy(dht);
        var bucket = new Bucket(this.table, this.index+1), length = this.length, node;
        while (node = this.pull(4))
            bucket.push(node);
    },
    concat: function () {
        var collection = [], i = this.length;
        while (i--) collection.push(this[i]);
        var bucket, n = arguments.length;
        while (bucket = arguments[n--]) {
            i = bucket.length;
            while (i--) collection.push(bucket[i]);
        }
        return collection;
    },
    pull: function (index) {
        var node = Array.prototype.splice.apply(this, [index, 1])[0];
        if (!this.length && !this.persist) this.table.splice(this.index, 1);
        if (node) node.bucket = null;
        return node;
    },
    push: function (node, force, assign, oldStamp) {
        if (!(node instanceof Node)) throw TypeError(INVALID_ARGS);
        if (this.length < K || force) {
            if (!oldStamp) node.stamp(); this.stamp();
            var length = Array.prototype.push.call(this, node);
            if (length && (!force || assign)) node.bucket = this;
            return length;
        }
    },
    sortBy: function (node) {
        var cache = {};
        return Array.prototype.sort.call(this, function (prev, next) {
            var a = cache[prev.id] || (cache[prev.id] = node.distance(prev));
            var b = cache[next.id] || (cache[next.id] = node.distance(next));
            return (a - b);
        });
    },
    get index() {
        return this.table.indexOf(this);
    },
    length: null
});

var RoutingTable = Class({
    extends: EventTarget,
    initialize: function initialize(node) {
        this.node = node;
        this.table = [];
        new Bucket(this.table, 0);
        if (ss.storage.table && ss.storage.table.length)
            this.initWithStorage();
        //var observer = {'observe': this.toStorage.bind(this)};
        //Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher).
        //        registerNotification(observer);
        this.inited = true;
        if (!this.length) this.setBucketTimer();
        else this.checkBuckets();
    },
    setBucketTimer: function () {
        var timestamp = this.oldestTimestamp, time = Date.now();
        if (timestamp < (time-REFRESH_INTERVAL)) return this.checkBuckets();
        setTimeout(this.checkBuckets.bind(this), REFRESH_INTERVAL-(time-timestamp));
    },
    checkBuckets: function () {
        try {
            if (this.inited) {
                var node, time = (Date.now()-REFRESH_INTERVAL), bucket, n = this.table.length, randomNode, i;
                while (bucket = this.table[n--]) {
                    if (bucket.timestamp <= time && (i = bucket.length)) {
                        this.updating = true;
                        bucket.timestamp += RECHECK_INTERVAL; /* causes timestamp to appear more recent to prevent rechecking to often */
                        emit(this, 'buckettimeout', bucket, i);
                        while (node = bucket[i--]) {
                            if (node.timestamp <= time) {
                                if (node.equals(randomNode)) continue;
                                node.timestamp += RECHECK_INTERVAL;
                                emit(this, 'timeout', node);
                            }
                        }

                    }
                }
            }
        } catch (error) {
            console.exception(error);
        }
        setTimeout(this.setBucketTimer.bind(this), REQUEST_TIMEOUT); /* prevent possible indirect synchronous recursion by waiting a few seconds before setting the timer again. */
    },
    get oldestTimestamp() {
        var timestamp = Date.now(), bucket, table = this.table, i = table.length;
        while(bucket = table[i--]) {
            if ((bucket.timestamp === +bucket.timestamp) && bucket.timestamp <= timestamp)
                timestamp = bucket.timestamp;
        }
        return timestamp;
    },
    toStorage: function (aSubject, aTopic, aData) { // nsIObserver
        if (aTopic === 'domwindowclosed') {
            var minified, overQuota; ss.storage.table = [], n = this.table.length, i, bucket, node;
            ss.on("OverQuota", function () {
                overQuota = true;
                while (ss.quotaUsage > 1)
                    ss.storage.table.pop();
            });
            while (bucket = this.table[n--]) {
                minified = ({'bucket':[]}); minified.timestamp = bucket.timestamp; i = bucket.length;
                while (node = bucket[i--]) {
                    if (node instanceof Node) {
                        minified.bucket.push({
                           id: node.id,
                           address: node.address,
                           port: node.port,
                           compact: node.compact,
                           failures: node.failures,
                           timestamp: node.timestamp
                        });
                    }
                }
                ss.storage.table.push(minified);
                if (overQuota) break;
            }
        }
    },
    initWithStorage: function () {
        var minified, entry, bucket, node, table = ss.storage.table, n = table.length, i;
        while (minified = table[n--]) {
            bucket = new Bucket(this.table, n); i = minified.bucket.length;
            while (entry = minified.bucket[i--]) {
                node = new Node(entry.id, entry.failures, entry.address, entry.port, Node.prototype.STRING_TYPE);
                node.compact = entry.compact; node.timestamp = entry.timestamp;
                bucket.push(node, null, true, true);
            }
            bucket.timestamp = minified.timestamp;
        }
    },
    emptyStorage: function () {
        delete ss.storage.table;
    },
    addEntry: function (node) {
        //if (!node.compact && (!node.address || !node.port)) return;
        var index, bucket = this.getBucket(node);
        if (bucket.push(node)) return true;
        if (~(index = bucket.replaceableIndex)) {
            bucket.pull(index);
            if (bucket.push(node)) return true;
        }
        if (bucket.index <= 158 && this.table.length < MAXIMUM_BUCKETS) {
            bucket.split(this.node, node);
            return true;
        }
    },
    getKClosetNodes: function (node/* Node or Hash*/, compact) {
        var bucket = this.getBucket(node), nodes = bucket, length = this.table.length;
        if (bucket.length === K) return bucket.sortBy(node);
        var decrement = true, increment = true;
        for (var index, i = 1; (i < length && nodes.length < K); i++) {
            if (decrement && (bucket.index-i) >= 0) index = bucket.index-i;
            else if (increment && (bucket.index+i) <= (length-1)) index = bucket.index+i;
            else break;
            if (decrement && increment) { // The first iteration determines all proceeding arithmetic instructions.
                if (index > bucket.index) decrement = false;
                else if (index < bucket.index) increment = false;
            }
            if (bucket.index === index) continue;
            if (!compact) {
                nodes = nodes.concat(this.table[index]);
            } else {
                nodes = nodes.concat(this.table[index].filter(function (node) {
                    return !!node.compact;
                }));
            }
        }
        return Bucket.prototype.sortBy.call(nodes.slice(0, K), node);
    },
    getCompactNode: function (node) {
        var bucket = getBucket(node);
        var index = bucket.indexOf(node);
        if (~index) {
            node = bucket[index];
            if (node.compact) return node;
        }
    },
    getBucket: function (node) {
        var index = this.node.distance(node), length = this.table.length; /* Index is >= 0-Closest <= MAXIMUM_BUCKETS-Farthest */
        if (index <= (length-1) || (index = (length-1)) !== -1)
            return this.table[index];
    },
    get length() {
        var table = this.table, i = table.length, total = 0, length;
        while (i--) {
            length = table[i].length;
            if (+length) total += length;
        }
        return total;
    },
    get extendable() {
        return this.table.length !== MAXIMUM_BUCKETS;
    },
    inited: false
});

var DHTTable = Class({
    extends: RoutingTable,
    initialize: function initialize() {
        RoutingTable.prototype.initialize.call(this);

    },
,
    setNodeFailure: function (node) {
        node.failures++;
        var bucket = node.bucket;
        if (bucket) {
            if (node.failures === MAXIMUM_FAILURES)
                bucket.pull(bucket.indexOf(node));
        } 
    },
    updating: false
});



var Pipeline = Class({
    initialize: function initialize() {
        this.pipe = [];
        this.delayedPipe = [];
        this.requests = {};
        this.length = 0;
    },
    push: function (request, id) {
        if (!(request instanceof Request)) throw TypeError(INVALID_ARGS);
        if (this.pipe.length < MAXIMUM_PIPELINE) {
            if (this.sending && this.length < this.maxRequests) {
                //if (response) return request.send();
                this.add(request, id);
            } else this.pipe.push(this.push.bind(this, request, id));
        }
    },
    pump: function () {
        if (this.sending) {
            if (this.pipe.length) this.pipe.shift()();
            else if (this.delayedPipe.length) this.delayedPipe.shift()();
            else if (!this.length) this.updating = false;
        }
    },
    add: function (request, id) {
        if (!Object.prototype.hasOwnProperty.call(this.requests, id)) {
            this.length++;
            this.requests[id] = request;
            request.timer = setTimeout(this.remove.bind(this, id, true), REQUEST_TIMEOUT);
            request.attempts++;
            this.server.send(request.node.address, request.node.port, request.packet.data);
        }
    },
    remove: function (id, failure) {
        if (Object.prototype.hasOwnProperty.call(this.requests, id)) {
            this.length--;
            request = this.requests[id];
            delete this.requests[id];
            clearTimeout(request.timer);
            if (failure) {
                if (request.packet.type === 'ping' && request.attempts < 2) {
                    this.delay(this.push.bind(this, request, id));
                } else this.setNodeFailure(request.node);
            } else this.setNodeSuccess(request.node);
        }
        this.pump();
    },
    delay: function (request) {
        if (!this.pipe.length) request();
        else this.delayedPipe.push(request);
    },
    start: function () {
        this.sending = true;
        var request, pipe = this.pipe, i = 0;
        while (request = pipe[i++]) request();
    },
    stop: function () {
        this.sending = false;
        this.initialize();
    },
    requests: null,
    pipe: null,
    delayedPipe: null,
    sending: false,
    get maxRequests() {
        return user_active ? MAXIMUM_REQUESTS_UACTIVE : MAXIMUM_REQUESTS;
    }
});

var Transaction = Class({
    initialize: function initialize(node, packet) {
        this.node = node;
        this.packet = packet;
        this.attempts = 0;
    },
    attempts: null,
    packet: null,
    node: null,
});

var DHTServer = Class({
    extends: UDPServer,
    implements: [Node],
    initialize: function initialize(options) {
        merge(this, options);
        UDPServer.prototype.initialize.call(this, this.port);
        Node.prototype.initialize.call(this, this.randomID, -1, null, this.port, Node.prototype.STRING_TYPE);
        DHT(this).queries = {};
        this.routingTable = new RoutingTable(this);
        this.routingTable.on('buckettimeout', this.refreshBucket.bind(this));
        this.routingTable.on('nodetimeout', this.refreshNode.bind(this));
        if (!this.length) this.bootstrap();
        else this.bootstrapped = true;
    },
    bootstrap: function () {
        var system = DHT(this), self = this;
        system.bootAttempts = 0;
        var nodes = [
            new Addr('dht.transmissionbt.com', 6881),
            new Addr('router.utorrent.com', 6881),
            new Addr('router.bittorrent.com', 6881)
        ];
        var resolve = function (message) {
            if (!self.bootstrapped) {
                self.bootstrapped = true;
                emit(self, 'bootstrapped');
            }
            self.getNeighbors(message.nodes);
        };
        var reject = function (message) {
            system.bootAttempts--;
            if (!system.bootAttempts && !self.bootstrapped) {
                console.exception(Error('Server was unable to bootstrap properly. Shutting down.'));
                self.stop();
            }
        };
        var i = nodes.length;
        while (i--) {
            system.bootAttempts++;
            this.find(nodes[i], this).then(resolve, reject);
        }
    },
    getNeighbors: function (nodes) {
        console.error('Server is searching for neighbors at ' + nodes.length + ' locations...');
        var system = DHT(this), self = this;
        var neighbor = Bucket.prototype.sortBy.call(nodes, this)[0];
        if (!system.neighbor || system.neighbor.id !== neighbor.id) {
            if (system.neighbor) {
                var distA = system.neighbor.distance(this);
                var distB = neighbor.distance(this);
                if (distB > distA) return; 
            }
            system.neighbor = neighbor;
            var resolve = function (message) {
                self.getNeighbors(message.nodes);
            };
            var i = nodes.length;
            while (i--) {
                this.find(nodes[i], this).then(resolve);
            }
        }
    },
    send: function (addr, packet) {
        UDPServer.prototype.send.call(this, addr.address, addr.port, packet.data);
    },
    sendQuery: function (addr, query) {
        var system = DHT(this), deferred = defer();
        query.then(deferred.resolve, deferred.reject);
        if (addr instanceof Node) query.node = addr;
        system.queries[query.id] = query;
        query.timer = setTimeout(deferred.reject, REQUEST_TIMEOUT, {}, query);
        this.send(addr, query);
        return deferred.promise;
    },
    find: function (node, target) {
        var query = new FindNode(this, target);
        return this.sendQuery(node, query);
    },
    ping: function (node) {
        var query = new Ping(this);
        return this.sendQuery(node, query);
    },
    getPeers: function (node, hash) {
        var query = new GetPeers(this, hash);
        return this.sendQuery(node, query);
    },
    onPacketReceived: function (aSocket, aMessage) {
        var message = RPC.prototype.parse({'fromAddr': aMessage.fromAddr, 'data': aMessage.data});
        this.onMessageReceived(message);
    },
    onMessageReceived: function (message) {
        var system = DHT(this), query;
        if (message.id) {
           query = system.queries[message.id];
            if (query) {
                delete system.queries[message.id];
                if (message.type === 'response') {
                    if (message.sender.id) {
                        this.onResponseReceived(message, query);
                        if (query.type === 'get_peers' || query.type === 'find_node') {
                            if (message.nodes) {
                                this.onNodesReceived(message, query);
                            } else if (message.values) {
                                this.onValuesReceived(message, query);
                            } else {
                                query.reject(message);
                            }
                        } else {
                            query.resolve(message);
                        }
                    } else {
                        query.reject(message);
                    }
                }
            } else if (message.type === 'query' && message.arguments && message.sender.id) {
                this.onQueryReceived(message);
            } else {
                message.error = [203, 'Protocol Error'];
            }
        }
        if (message.error) this.onErrorReceived(message, query);
        else emit(this, 'message', message);
    },
    onResponseReceived: function (message, query) {
        var node = query.node;
        if (node) {
            node.failures = 0;
            node.stamp();
            if (node.bucket) {
                node.bucket.stamp();
            } else {
                this.routingTable.addEntry(node);
            }
        } else {
            var sender = message.sender;
            node = new Node(sender.id, 0, sender.address, sender.port, Node.prototype.STRING_TYPE);
            this.routingTable.addEntry(node);
        }
        emit(this, 'response', message);
    },
    onQueryReceived: function (message) {
        var sender = message.sender, type = message.arguments.type, id = message.id, response;
        if (type === 'ping') {
            response = new Pong(this, id);
        } else if (type === 'get_peers') {
            response = new GiveNodes(this, id, '')
        } else if (type === 'find_node') {
            response = new GiveNodes(this, id, '');
        }
        if (response) {
            this.send(sender, response);
        }
        emit(this, 'query', message);
    },
    onNodesReceived: function (message, query) {
        message.nodes = message.nodes.match(COMPACT_NODES).map(function (id) {
            return new Node(id, 0, null, null, Node.prototype.STRING_TYPE);
        });
        this.routingTable.addList(message.nodes);
        query.resolve(message);
        emit(this, 'nodes', message);
    },
    onValuesReceived: function (message, query) {
        message.peers = message.values.map(function (compact) {
            return new Peer(compact);
        });
        query.resolve(message);
        emit(this, 'peers', message);
    },
    onErrorReceived: function (message, query) {
        if (query) {
            query.reject(message);
            //if (message.sender.id) {
                // Node has responded to our query but the response contains errors and we have their ID...
                // Such as an empty response, invalid data, etc... We only send error messages to complain about incoming erroneous queries.
                // In this case we could report the error to the node but it wouldn't be accepted.
            //}
        } else {
            var response = new GiveError(message.id, message.error);
            this.send(message.sender, response);
            console.error('Server sent ' + message.error[1] + ' to ' + message.sender.address);
        } //else {
            // The server only knows that it received a message without a transaction id so its ignored.
        //}
        //emit(this, 'error', message);
    },
    resolveQuery: function (message, query) {

    }
    refreshBucket: function (bucket, length) {
        var self = this;
        var resolve = function (message) {};
        var reject = function (message) {
            var length = bucket.length;
            if (length)
                self.refreshBucket(bucket, length);
        };
        var node = bucket[parseInt(Math.random()*length)];
        this.findNode(node, this).then(resolve, reject);
    },
    refreshNode: function (node) {
        this.ping(node).then(function (message) {

        });
    },
    get randomID() {
        var randomString = Array.apply(null, Array(NODE_ID_LENGTH)).map(function () {
            return String.fromCharCode(parseInt(Math.random() * 0xFF));
        }).join('');
        return new SHA1(randomString).digest();
    },
    bootstrapped: null,
});

Object.freeze(DHTServer.prototype);

/*
    queue: function (node, packet) {
        //this.pipeline.push(new Transaction(node, packet), node.hex);
    },
    find: function (node, target) {
        this.send(node, (new RPC()).setQuery('find_node', {id: this.node.id, target: target.id}));
    },
    ping: function (node) {
        this.send(node, (new RPC()).setQuery('ping', {id: this.node.id}));
    },
    track: function (hash) {
        var nodes = this.getKClosetNodes(hash);
        if (nodes.length) {
            var closetNode = this.peerTable.getClosetNode(hash);
            if (nodes[0].id !== closetNode.id) {
                this.peerTable.setClosetNode(hash, nodes[0]);
                for (var node, i = 0; node = nodes[i]; i++) {
                    this.getPeers(node, hash)
                }
            }
        }
    },
    getPeers: function (node, hash) {
        if (node.timestamp < (Date.now()-RECHECK_INTERVAL) && !~this.queriedForPeers.indexOf(node)) {
            if (!node.bucket && this.queriedForPeers.length < MAXIMUM_PEERQUERIED)
                this.queriedForPeers.push(node, true);
            console.error('Get Peers!');
            //if (this.pipe.length > 100) {
              //  this.delay(this.send.bind(this, node, (new RPC()).setQuery('get_peers', {id: this.node.id, info_hash: hash.string}), ({'hash': hash})));
            this.send(node, (new RPC()).setQuery('get_peers', {id: this.node.id, info_hash: hash.string}), ({'hash': hash}));
        }
    },



*/
delete ss.storage.table;

var server = new DHTServer({
    port: 6881
});

server.on('bootstrapped', function () {
    console.error('Server is bootstrapped.');
});

server.on('stop', function (status) {
    try { // Need a traceback? Catch an exception...
        throw new Error('WTF did the server stop listening?', status);
    } catch (error) {
        console.exception(error);
    }
});

/*
 *
 * i = nodes.length;
                                while (i--) {
                                    if (this.addEntry(nodes[i]) && this.extendable && this.bootstrapped) {
                                        this.find(nodes[i], this.node);
                                    } else if (!this.updating) this.ping(nodes[i]);
                                }
 
var RoutingTable = Class({
    initialize: function initialize() {

        //this.blacklist = new Bucket(this.table, true);
        //this.queriedForPeers = new Bucket(this.table, true);
        //setInterval(this.checkQFP.bind(this), CHECK_PEERQUERIED);

        //this.inited = true;

        //setInterval(this.refreshBlacklist.bind(this), BLACKLIST_TIMEOUT);
        
        self = this; this.nodeCount = 0;
        setInterval(function () {
            var nodes = 0;
            for (var bucket of self.table) {
                nodes += bucket.length;
            }
            if (self.nodeCount !== nodes) {
                self.nodeCount = nodes;
            console.error('Storing a total of ' + nodes + ' nodes.');
            console.error(self.pipe.length + ' requests in pipe.')
            console.error(self.delayedPipe.length + ' on pipe empty requests.')
            }
            //console.error(self.table);
        }, 5000);
        
    },
    
    checkQFP: function () {
        var time = Date.now()-PEERQUERIED_TIMEOUT;
        for (var i = 0; node = this.queriedForPeers[i]; i++) {
            if (node.timestamp < time)
                this.queriedForPeers.splice(i, 1);
        }
    },
      setNodeFailure: function (node) {
        node.failures++;
        var bucket = node.bucket;
        if (bucket) {
            if (node.failures >= MAXIMUM_FAILURES || (!node.timestamp && this.loaded)) {
                //if (this.blacklist.length < MAXIMUM_BLACKLIST) this.blacklist.push(bucket.pull(bucket.indexOf(node)), true);
                bucket.pull(bucket.indexOf(node))
            }
        } //else if (this.blacklist.length < MAXIMUM_BLACKLIST) this.blacklist.push(node);
    },
,
    addEntry: function (server, node, hash) { // SEPERATE CLASSES!!! Rewrite this function, there should not be any references to server.
//        if (~this.blacklist.indexOf(node)) return; // ensure that we don't add our own node during the addList method
        
        if (!recurse) {
            if (hash) this.getPeers(node, hash);
            else if (result && !this.loaded) this.find(node, this.node);
        }
        return result;
        
    },
    inited: false,
    shutdown: false,
    refreshBlacklist: function () {
        var time = (Date.now()-BLACKLIST_TIMEOUT);
        for (var i = 0; node = this.blacklist[i]; i++) {
            if (node.timestamp < time)
                this.blacklist.splice(i, 1);
        }
    },
    blacklist: null
});
                case 'q--': /* Query 
                    switch (data.q) {
                        case 'ping':
                            try {
                                var packet = (new RPC(data.t)).setResponse({id: this.node.id});
                                this.send(new Node(data.a.id, 0, aMessage.fromAddr.address, aMessage.fromAddr.port, 'string'), packet);
                            } catch (error) { /* ignore  }
                            break;
                        case 'find_node':
                            try {
                                if (data.a.target) {
                                    var targetNode = new Node(data.a.target, 0, aMessage.fromAddr.address, aMessage.fromAddr.port, 'string');
                                    var nodes = this.getCompactNode(targetNode).id;
                                    if (!nodes) {
                                        nodes = this.getKClosetNodes(targetNode, true).map(function (node) {
                                            return node.id;
                                        }).join('');
                                    }
                                    if (nodes.length) {
                                        var packet = (new RPC(data.t)).setResponse({id: this.node.id, nodes: nodes});
                                        this.send(new Node(data.a.id, 0, aMessage.fromAddr.address, aMessage.fromAddr.port, 'string'), packet);
                                    }
                                }
                            } catch (error) { /* ignore  }
                    }
                    break;
 *
 **/