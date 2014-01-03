const { Peer } = require('./peer');

const COMPACT_NODE_LENGTH = 26, COMPACT_PEER_LENGTH = 6;
const NODE_ID_LENGTH = COMPACT_NODE_LENGTH - COMPACT_PEER_LENGTH;

const Node = Class({
    extends: Peer,
    initialize: function initialize(id, failures, address, port, type) {
        if (id.length === COMPACT_NODE_LENGTH) Peer.prototype.initialize.call(this, id, null, 'compact');
        this.id = id;
        this.failures = (failures === +failures) ? failures : -1;
        this.address = address || this.address;
        this.port = port || this.port;
    },
    id: null,
    failures: null,
    bucket: null,
    stamp: function () {
        this.timestamp = Date.now();
    },
    timestamp: null
});

exports.Node = Node;