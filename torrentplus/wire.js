const { Class } = require('sdk/core/heritage');
const { Packet } = require('./packet');

require('./bytes').define(String);

const HANDSHAKE_BYTES = 68, PROTOCOL_NAME = 'BitTorrent protocol'.bytes, NAME_LENGTH = PROTOCOL_NAME.length;
const FIRST_OFFSET = 1, RESERVED_BYTES = 8, HASH_OFFSET = FIRST_OFFSET + NAME_LENGTH + RESERVED_BYTES;
const HASH_LENGTH = 20, PEER_ID_LENGTH = 20, PEER_ID_OFFSET = HASH_OFFSET + HASH_LENGTH;


const Datagram = Class({
    extends: Packet,
    initialize: function initialize(bytes) {
        Packet.prototype.initialize.call(this, bytes)
        this.bytes = this.data;
    },
    bytes: null
});

exports.HandShake = Class({
    initialize: function initialize(peer_id)  {
        Datagram.prototype.initialize.call(this, HANDSHAKE_BYTES);
        var bytes = this.bytes;
        bytes[0] = NAME_LENGTH;
        bytes.set(PROTOCOL_NAME, FIRST_OFFSET);
        Object.defineProperty(this, 'id', {
            set: function (id) {
                bytes.set(id.bytes, PEER_ID_OFFSET);
            }
        });
        // If an instance sets the ID property it will have the effect of modifying the __proto__ object for all instances.
        // All instances should share the same peer ID, unless overwritten.
        this.id = peer_id;
    },
    instantiate: function instantiate(hash) {
        var datagram = Object.create(this);
        datagram.bytes.set(hash.bytes, HASH_OFFSET);
        return datagram;
    },
    id: null
});