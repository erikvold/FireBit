


var Store = Class({ /* <-- Pipeline <- DHTServer */ 
    initialize: function initialize(type) {
        this.type = type;
    },
    toArray: function () {
        var array = [];
        for (var object in this) {
            array.push(this[object]);
        }
        return array;
    },
    add: function (object, name) {
        if (!this[name])
            return !!(this[name] = object);
    },
    remove: function (name) {
        if (this[name])
            return delete this[name];
    },
    type: Object
});

var PeerStore = Class({ /* <-- PeerTable <- DHTServer */
    extends: Store,
    initialize: function initialize(table) {
        Store.prototype.initialize.call(this, Peer);
        this.table = table || {length: 0};
    },
    add: function (peer) {
        if (!peer.compact) return 0;
        var result = ~~Store.prototype.add.call(this, peer, peer.compact.hex);
        this.length += result; this.table.length += result;
        return result;
    },
    remove: function (peer) {
        var result = ~~Store.prototype.remove.call(this, peer.compact.hex);
        this.length -= result; this.table.length -= result;
        return result;
    },
    length: 0,
    table: null,
    closetNode: FAKE_NODE
});

var PeerTable = Class({ /* <- DHTServer */
    addStore: function (hash, peer) {
        var id = hash.hex;
        return this[id] ? this[id].add(peer) : (this[id] = new PeerStore(this)).add(peer);
    },
    getList: function (hash) {
        var id = hash.hex;
        return this[id] ? this[id].toArray() : [];
    },
    addList: function (hash, peers) {
        for (var peer of peers)
            this.addStore(hash, peer);
    },
    removeStore: function (hash) {
        var id = hash.hex;
        if (this[id]) {
            this.length -= (+this[id].length);
            return delete this[id];
        }
    },
    emptyTable: function () {
        for (var id in this) {
            if (this[id] instanceof PeerStore)
                this.removeStore({hex: id});
        }
    },
    getClosetNode: function (hash) {
        var id = hash.hex;
        if (!this[id]) this.addStore(hash, {});
        return this[id] ? this[id].closetNode : FAKE_NODE;
    },
    setClosetNode: function (hash, node) {
        var id = hash.hex;
        if (this[id] && node instanceof Node)
            this[id].closetNode = node;
    },
    length: 0
});







/*
var table = new PeerTable();
var hash = new Hash('4E3BD45A99C744E69B32C66DF309BAF65ACDAE80');
var node = new Node("abcdefghijklmnopqrst", 0, "127.0.0.1", 58312);

console.error(table);
for (var i = 0; i < 100; i++) {
    var randomString = Array.apply(null, Array(6)).map(function () {
            return String.fromCharCode(parseInt(Math.random() * 0xFF));
        }).join('');
        table.addStore(hash, new Peer(randomString));
}
console.error(table.getClosetNode(hash));
table.setClosetNode(hash, node);
console.error(table.getClosetNode(hash));
console.error(table.getList(hash));
console.error(table);
//table.emptyTable();
//console.error(table);
*/
///*
//delete ss.storage.table;
var server = new DHTServer();

var hash = new Hash('9CC100C1C0D708CE2696537C86226181250341A3');
server.track(hash);
//*/