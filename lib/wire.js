const { Class } = require('sdk/core/heritage');
const { Packet } = require('./packet');

require('./bytes').define(String);

// see: https://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29

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

// The HandShake class should only ever be constructed once after which the instantiate method will be available
// new instances should only be created once on a per hash basis after which the datagram instance
// can be cached and reused again and again.

exports.HandShake = Class({
    initialize: function initialize()  {
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
        // All instances should share the same peer ID. i.e. handshake.id = ourPeerId;
    },
    instantiate: function instantiate(hash) {
        var datagram = Object.create(this);
        datagram.bytes.set(hash.bytes, HASH_OFFSET);
        return datagram;
    }
});