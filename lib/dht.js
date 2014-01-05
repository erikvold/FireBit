///*
var { UDPServer } = require('./utils/udp');
const { Class } = require('sdk/core/heritage'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/core/heritage.html
const { SHA1 } = require('./utils/crypto');
const { Addr } = require('./addr');
const { Peer } = require('./peer');
const { Node } = require('./node');
const { Cc, Ci } = require('chrome'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/chrome.html
var { EventTarget } = require("sdk/event/target"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/event/target.html
var { emit } = require("sdk/event/core"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/event/core.html
var { merge } = require("sdk/util/object"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/util/object.html
var { setTimeout, clearTimeout, setInterval } = require('sdk/timers'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/timers.html
var { user } = require('./user');
let { ns } = require('sdk/core/namespace'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/core/namespace.html
var events = require("sdk/system/events"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/system/events.html
var ss = require("sdk/simple-storage"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/simple-storage.html
//*/

var DHT = ns();

const { FindNode, GetPeers, Ping, Pong, GiveNodes, GivePeers, GiveError, RPC } = require('./rpc');

///*
const K = 8, MAXIMUM_FAILURES = 3, FAKE_NODE = {id: -1}, REFRESH_INTERVAL = 900000; /* 15 mins */
const RECHECK_INTERVAL = 120000; /* 2 mins */
const MAXIMUM_REQUESTS = 16, MAXIMUM_REQUESTS_UACTIVE = 8, MAXIMUM_PIPELINE = 168;
const REQUEST_TIMEOUT = 5000 /* 5 secs */, BLACKLIST_TIMEOUT = 90000; /* 90 secs */
const MAXIMUM_BLACKLIST = 100;
const INVALID_ARGS = 'Invalid arguments passed to function.';
const MAXIMUM_BUCKETS = 160, COMPACT_NODE_LENGTH = 26, COMPACT_PEER_LENGTH = 6;
const COMPACT_PEERS = new RegExp('.{' + COMPACT_PEER_LENGTH + '}', 'g');
const COMPACT_NODES = new RegExp('.{' + COMPACT_NODE_LENGTH + '}', 'g');
const NODE_ID_LENGTH = COMPACT_NODE_LENGTH - COMPACT_PEER_LENGTH;
const BOOTSTRAP_TIMEOUT = 20000;
//*/

// K - Each bucket can only hold K nodes, currently eight, before becoming "full."
// MAXIMUM_FAILURES - maximum request failures before a node will be removed from the routing table
// FAKE_NODE - an object that simply has an 'id' property
// REFRESH_INTERVAL - the amount of time that may pass without hearing from a node before a refresh should occur
// MAXIMUM_REQUEST - maximum amount of simultaneous requests before requests/response will be put in a queue
// MAXIMUM_REQUEST_UACTIVE - same purpose as MAXIMUM_REQUESTS but when the user is active
// MAXIMUM_PIPELINE - maximum number of queued requests/responses allowed before refusal/dismisal occurs
// REQUEST_TIMEOUT - the amount of time a node has to respond to our queries
// BLACKLIST_TIMEOUT - when a node is blacklisted we won't add it to the table for this amount of time
// MAXIMUM_BLACKLIST - maximum amount of nodes to maintain in the blacklist
// *PEERQUERIED* - removed, its purpose was to maitain a list of nodes that has already been asked for peers
// but that seperate list is probably unnecessary as a second timestamp could be maintained for this purposes.

/*
 * Bucket is ArrayLike but does not inherit from Array meaning also that (Bucket instanceof Array) === false
 * The length property is maintained by Array.prototype methods push and splice which correnspond to Bucket.push and Bucket.pull respectively
 */
var Bucket = Class({ // See: http://www.bittorrent.org/beps/bep_0005.html#routing-table // third paragraph
    initialize: function initialize(table, index) { // index is the table index
        if (!(table instanceof Array)) throw TypeError(INVALID_ARGS);
        this.table = table;
        this.table.splice(index, 0, this); // insert this bucket into the table at index
        if (!index) this.persist = true; // persist is a boolean which determines whether or not to remove the bucket from the table when in becomes empty
        this.stamp(); // Set the intial timestamp and length
        this.length = 0;
    },
    indexOf: function (node) { // return the index of the node in this bucket if and only if node is in this bucket otherwise return -1
        var i = this.length;
        while (i--) {
            if (this[i].id === node.id) return i;
        }
        return -1;
    },
    get replaceableIndex() { // currently this method will return the index of the node with the most failures or -1 if none of the nodes have failed to respond to our queries
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
        this.push(node, true, true); // assign the node's bucket property to equal (this) and force(add it even if the length will exceed K(8))
        this.sortBy(dht); // sort the nodes where the first index is closet to our own node and the last is the furthest away.
        var bucket = new Bucket(this.table, this.index+1), length = this.length, node; // create a new bucket and insert that bucket into the table at the current table index + 1
        while (node = this.pull(4)) // get/remove the node at index #4 aka the 5th while there is one
            bucket.push(node); // hand it to the new bucket, this will always leave at least the first 4 nodes in the old bucket
    },
    concat: function (...buckets) { // return an array with all the nodes of the specified buckets
        var collection = [], i = this.length;
        while (i--) collection.push(this[i]);
        var bucket, n = buckets.length;
        while (bucket = buckets[n--]) {
            i = bucket.length;
            while (i--) collection.push(bucket[i]);
        }
        return collection;
    },
    pull: function (index) { // remove and return a node from this bucket at (index)
        // I know that the syntax used with apply seems unnecessary but otherwise a bug arises
        var node = Array.prototype.splice.apply(this, [index, 1])[0];
        if (!this.length && !this.persist) this.table.splice(this.index, 1); // The splice method returns the bucket but we don't need it anymore obviously
        if (node) node.bucket = null; // make sure we can tell if the node is currently in a bucket(keep things consistent)
        return node;
    },
    push: function (node, force, assign, oldStamp) {
        if (!(node instanceof Node)) throw TypeError(INVALID_ARGS);
        if (this.length < K || force) { // The force option allows us to bypass the length limit
            if (!oldStamp) node.stamp(); this.stamp(); // The oldStamp option is used when restoring our persistent routing table after a restart
            var length = Array.prototype.push.call(this, node); // Add the node to the bucket
            if (length && (!force || assign)) node.bucket = this; // If we forced that node to be put in this bucket then unless we specified assign don't do so
            return length; // Keeping things ArrayLike
        }
    },
    sortBy: function (node) {
        var cache = {}; // The cache object prevents recaculating the same distance
        return Array.prototype.sort.call(this, function (prev, next) { // We call the array sort method on this bucket, prev is initally the first node
            var a = cache[prev.id] || (cache[prev.id] = node.distance(prev)); // calc or return the already calculated distance for the specified node argument which is usually our DHT node
            var b = cache[next.id] || (cache[next.id] = node.distance(next));
            return (a - b); // The diff allows the sort and its consistent to tests meaning it works
        });
    },
    get index() { // return the table index of this bucket
        return this.table.indexOf(this);
    },
    stamp: function () {
        this.timestamp = Date.now();
    },
    timestamp: null,
    length: null
});

var RoutingTable = Class({
    extends: EventTarget,
    initialize: function initialize(node) { // node is this DHT node
        this.node = node;
        this.table = [];
        new Bucket(this.table, 0); // the bucket is reponsible for inserting itself into the table
        if (ss.storage.table && ss.storage.table.length) // if the persistent table storage contains minified buckets.
            this.initWithStorage();
        //var observer = {'observe': this.toStorage.bind(this)}; // Commented out because it was throwing an exception but it was working as is before, its reponsible for saving the table when a user exits firefox
        //Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher). // See: https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIWindowWatcher
        //        registerNotification(observer);
        this.inited = true; // the inited boolean tells whether or not the routing table has been loaded from storage
        if (!this.length) this.setBucketTimer(); // checkBuckets calls setBucketTimer but its not really necessary if there isn't any nodes in the table yet so its conditional
        else this.checkBuckets();
    },
    setBucketTimer: function () {
        var timestamp = this.oldestTimestamp, time = Date.now();
        if (timestamp < (time-REFRESH_INTERVAL)) return this.checkBuckets(); // If the oldest timestamp in the table is older than what REFRESH_INTERVAL allows then call checkBuckets and return, the value returned isn't used.
        setTimeout(this.checkBuckets.bind(this), REFRESH_INTERVAL-(time-timestamp)); // otherwise tell checkBuckets to run when the above expression would've evaluated to true.
    },
    checkBuckets: function () {
        try {
            if (this.inited) { // If the table has been loaded from storage
                var node, time = (Date.now()-REFRESH_INTERVAL), bucket, n = this.table.length, randomNode, i;
                while (bucket = this.table[n--]) { // loop through the buckets
                    if (bucket.timestamp <= time && (i = bucket.length)) { // If the bucket's timestamp is REFRESH_INTERVAL old or older and there is nodes in the bucket then
                        this.updating = true; // We are going to update the bucket
                        bucket.timestamp += RECHECK_INTERVAL; /* causes timestamp to appear more recent to prevent rechecking to often */
                        emit(this, 'buckettimeout', bucket, i); // A bucket has timed out meaning its time to refresh it so emit the event. The DHTServer class should listen for this event. The listener should accept (bucket, tableIndex) arguments
                        while (node = bucket[i--]) { // loop through the nodes
                            if (node.timestamp <= time) { // If the node's timestamp is REFRESH_INTERVAL old or older emit the nodetimeout event, careful that we don't update the same node because of emitting buckettimeout and nodetimeout timeouts
                                node.timestamp += RECHECK_INTERVAL;
                                emit(this, 'nodetimeout', node);
                            }
                        }

                    }
                }
            }
        } catch (error) {
            console.exception(error);
        }
        setTimeout(this.setBucketTimer.bind(this), REQUEST_TIMEOUT); /* wait a few seconds before setting the timer again. */
    },
    get oldestTimestamp() { // Loop throught the buckets returning the bucket with the oldest timestamp
        var timestamp = Date.now(), bucket, table = this.table, i = table.length;
        while(bucket = table[i--]) {
            if ((bucket.timestamp === +bucket.timestamp) && bucket.timestamp <= timestamp)
                timestamp = bucket.timestamp;
        }
        return timestamp;
    },
    toStorage: function (aSubject, aTopic, aData) { // nsIObserver // We can't store functions so minify the table, bucket, and nodes in way that may restored at a later time
        if (aTopic === 'domwindowclosed') { // See: https://developer.mozilla.org/en-US/search?q=domwindowclosed
            var minified, overQuota; ss.storage.table = [], n = this.table.length, i, bucket, node;
            ss.on("OverQuota", function () {
                overQuota = true;
                while (ss.quotaUsage > 1) // While overQuota remove buckets from the table until not overQuot although currently a filled table won't be more than the limit
                    ss.storage.table.pop();
            }); // See: https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/simple-storage.html
            while (bucket = this.table[n--]) { // Loop through the buckets, I should mention that you can store functions and that you can't store methods on types like Array
                minified = ({'bucket':[]}); minified.timestamp = bucket.timestamp; i = bucket.length;
                while (node = bucket[i--]) {
                    if (node instanceof Node) { // Sanity check
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
                if (overQuota) break; // If we went overQuota then stop
            }
        }
    },
    initWithStorage: function () { // Here we restored our previously saved table
        var minified, entry, bucket, node, table = ss.storage.table, n = table.length, i;
        while (minified = table[n--]) { // Loop through the buckets in the minified table
            bucket = new Bucket(this.table, n); i = minified.bucket.length; // create a new bucket and insert it into the table
            while (entry = minified.bucket[i--]) { // Loop through the nodes, the minified bucket in a property of minified because we needed to store the bucket timestamp
                node = new Node(entry.id, entry.failures, entry.address, entry.port, Node.prototype.STRING_TYPE);
                node.compact = entry.compact; node.timestamp = entry.timestamp;
                bucket.push(node, null, true, true);  // bucket.push(nodeInstance, force, assign, (don't reset the timestamp))
            }
            bucket.timestamp = minified.timestamp; // reset the bucket's old timestamp
        }
    },
    emptyStorage: function () { // unused
        delete ss.storage.table;
    },
    addEntry: function (node) {
        //if (!node.compact && (!node.address || !node.port)) return; // I'm not sure if this condition check is needed any longer
        var index, bucket = this.getBucket(node); // get the closet bucket
        if (bucket.push(node)) return true; // if the length returned from bucket.push is truthy than we added the node
        if (~(index = bucket.replaceableIndex)) { // get the bucket's replaceable index
            bucket.pull(index); // remove that the node at said index
            if (bucket.push(node)) return true; // try to add the node
        }
        if (bucket.index <= 158 && this.table.length < MAXIMUM_BUCKETS) { // If the bucket is splittable
            bucket.split(this.node, node); // remember this.node is our DHT node and is needed for sorting
            return true;
        }
    },
    getKClosetNodes: function (node/* Node or Hash*/, compact) {
        var bucket = this.getBucket(node), nodes = bucket, length = this.table.length; // get the closest bucket
        if (bucket.length === K) return bucket.sortBy(node); // If the bucket if full then return its nodes sorted by the node argument which will mostly be our DHT node
        var decrement = true, increment = true; // Boolean values to check and see if were decrementing or incrementing, and intially true as only one of the if statements will be executed anyway
        for (var index, i = 1; (i < length && nodes.length < K); i++) { // var i aka the count is one and loop while we can or don't have enough nodes
            if (decrement && (bucket.index-i) >= 0) index = bucket.index-i; // If there is a bucket behind or one index before the current bucket's index then index == that index
            else if (increment && (bucket.index+i) <= (length-1)) index = bucket.index+i; // The opposite
            else break;
            if (decrement && increment) { // The first iteration determines all proceeding arithmetic instructions.
                if (index > bucket.index) decrement = false; // If we incremented
                else if (index < bucket.index) increment = false; // otherwise the table index decremented aka decreased
            }
            if (bucket.index === index) continue; // If somehow we got the same bucket as the last iteration run the loop again
            if (!compact) { // Is boolean value we tells whether or not to only return nodes who have a (node.compact) property
                nodes = nodes.concat(this.table[index]); // nodes is the original bucket and after concatenation, nodes is still a Bucket
            } else {
                nodes = nodes.concat(this.table[index].filter(function (node) { // filter nodes that don't have a compact property from the collection
                    return !!node.compact;
                }));
            }
        }
        return Bucket.prototype.sortBy.call(nodes.slice(0, K), node); // sort only the first 8 nodes if somehow we got more and return them or the amount that we got
    },
    getCompactNode: function (node) { // This method is probably going to be removed so I wouldn't give it my attention
        var bucket = getBucket(node);
        var index = bucket.indexOf(node);
        if (~index) {
            node = bucket[index];
            if (node.compact) return node;
        }
    },
    getBucket: function (node) {
        // We calculate the distance which is (0-160) and if that value aka index is non existent return the tables last index
        var index = this.node.distance(node), length = this.table.length; /* Index is >= 0-Closest <= MAXIMUM_BUCKETS-Farthest */
        if (index <= (length-1) || (index = (length-1)) !== -1)
            return this.table[index];
    },
    get length() { // return the amount of nodes in the table !!This isn't working properly!!
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

/* // This needs to be called when a node fails to respond to a query or the request times out.
    setNodeFailure: function (node) {
        node.failures++;
        var bucket = node.bucket;
        if (bucket) {
            if (node.failures === MAXIMUM_FAILURES)
                bucket.pull(bucket.indexOf(node));
        } 
    }
*/


var Pipeline = Class({
    initialize: function initialize() {
        this.pipe = []; // store requests/response up to MAXIMUM_PIPELINE while this.length is greater than this.maxRequests
        this.delayedPipe = []; // A secondary pipe to resolve when the first pipe becomes empty
        this.requests = {}; // Object to store requests
        this.length = 0; // The number of requests
    },
    push: function (request, id) {
        if (!(request instanceof Request)) throw TypeError(INVALID_ARGS); // Sanity check
        if (this.pipe.length < MAXIMUM_PIPELINE) { // If not over the max
            if (this.sending && this.length < this.maxRequests) { // If not over the request limit
                //if (response) return request.send(); // The pipeline class is unstable at the moment feel free to work on it
                this.add(request, id); // add the request
            } else this.pipe.push(this.push.bind(this, request, id)); // If we reached the maximum amount of simultaneous requests than bind this method with the original arguments and put that into the pipe
        }
    },
    pump: function () {
        if (this.sending) { // If start has been called and the pipe's stop method hasn't been then
            if (this.pipe.length) this.pipe.shift()(); //If theres a binded push function in the pipe call that function
            else if (this.delayedPipe.length) this.delayedPipe.shift()(); // otherwise the pipe is empty so check the delayed pipe and do the same
            else if (!this.length) this.updating = false; // last but not least if there are no active requests and all pipes are empty then no requests are being made thus updating == false
        }
    },
    add: function (request, id) {
        if (!Object.prototype.hasOwnProperty.call(this.requests, id)) { // if the request object doesn't already contain a property with said ID
            this.length++; // Increment the number of requests
            this.requests[id] = request; // store the request object
            request.timer = setTimeout(this.remove.bind(this, id, true), REQUEST_TIMEOUT); // set the timer to remove the request if it times out
            request.attempts++; // the request object can maintain the number of times we've sent that request
            this.server.send(request.node.address, request.node.port, request.packet.data); // You'll notice here what properties the request object should have
        }
    },
    remove: function (id, failure) { // only the setTimeout method should call this function with a second argument thus it serves as a boolean check
        if (Object.prototype.hasOwnProperty.call(this.requests, id)) { // If the requests object is storing a request with that ID which it should always be, so this is a sanity check
            this.length--; // Decrement the number of requests
            request = this.requests[id]; // get the request object
            delete this.requests[id]; // remove the request from the Pipeline.requests object
            clearTimeout(request.timer); // remove the timer
            if (failure) {
                if (request.packet.type === 'ping' && request.attempts < 2) { // if we sent a ping then give the node a second chance after we've emptied the pipe
                    this.delay(this.push.bind(this, request, id));
                } else this.setNodeFailure(request.node); // this method is non existent and probably should be handled by the DHTServer class's onAction methods
            } else this.setNodeSuccess(request.node); // this method is non existent and probably should be handled by the DHTServer class's onAction methods
        }
        this.pump(); // keep it going
    },
    delay: function (request) {
        if (!this.pipe.length) request(); // If the pipe is empty then execute the argument which should be a function
        else this.delayedPipe.push(request); // otherwise add it to the delayedPipe
    },
    start: function () {
        this.sending = true;
        var request, pipe = this.pipe, i = 0;
        while (request = pipe[i++]) request(); // While there is binded push functions in the pipe execute them, if they can't be sent they will be requeued
    },
    stop: function () {
        this.sending = false;
        this.initialize(); // This will reset all storage variables
    },
    requests: null,
    pipe: null,
    delayedPipe: null,
    sending: false,
    get maxRequests() { // depends on user activity
        return user.active ? MAXIMUM_REQUESTS_UACTIVE : MAXIMUM_REQUESTS;
    }
});

var Transaction = Class({ // A request or response is a transaction, this is what should be the Pipeline.push methods first argument, the second an ID
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
        var nodes = [ // This hasn't been updated to work with the new Addr class
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
    try { // Need a traceback? then catch an exception...
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