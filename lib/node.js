//const { Peer } = require('./peer');

/*
 * compact node length is the length of a 20 byte node id with the 6 byte compact address/port info appended onto the end.
 * compact peer length is the length of compact address/port info
 */

const COMPACT_NODE_LENGTH = 26, COMPACT_PEER_LENGTH = 6;
const NODE_ID_LENGTH = COMPACT_NODE_LENGTH - COMPACT_PEER_LENGTH;

const Node = Class({
    extends: Addr,
    initialize: function initialize(id, failures, address, port, type) {
        if (id.length === COMPACT_NODE_LENGTH) {
            // We can pass the entire ID to the Addr constructor which will use the last 6 bytes of the (string||bytes)
            Addr.prototype.initialize.call(this, id, null, 'compact');
        } else {
            Addr.prototype.initialize.call(this, address, port, type);
        }
        this.id = id;
        // Ensure that failure is an integer otherwise return -1
        this.failures = (failures === +failures) ? failures : -1;
    },
    id: null,
    failures: null, // reset to 0 upon responding to one of our queries
    bucket: null, // the table bucket in which this node resides
    stamp: function () {
        this.timestamp = Date.now();
    },
    timestamp: null
});

exports.Node = Node;