const { Cc, Ci } = require('chrome');
const { Class } = require('sdk/core/heritage');
var { merge } = require("sdk/util/object");
const { Addr } = require('./addr');

var prototype = {
    send: function (addr, packet) {
        UDPServer.prototype.call(this, addr.address, addr.port, packet.data);
    },
    onPacketReceived: function (aSocket, aMessage) {
        aMessage.data.bytes
        peers[aMessage.fromAddr.address];
        var peer = peers.get(id);
        if (!peer) peer = peers.set(id);
        peer.processMessage(aMessage);
    }
};

var server = new UDPServer(prototype);
var id = new Hash(randomID(), Hash.prototype.STRING_TYPE).bytes;



exports.Peer = Class({
    extends: Addr,
    initialize: function initialize(options) {
        merge(this, options);
        Addr.prototype.initialize.call(this, this.address, this.port, this.addrType);
    },
    requiresHandShake: true,
    choked: true,
    interested: false
});




        



function randomID() {
    var randomString = Array.apply(null, Array(20)).map(function () {
        return String.fromCharCode(parseInt(Math.random() * 0xFF));
    }).join('');
    return randomString;
}
var once = true;
var prototype = {
    port: 6881,
    onStopListening: function (socket, status) {

    },
    onPacketReceived: function (socket, message) {
        var data = message.data.split('').map(function (c) {
            return String.charCodeAt(c);
        });
        var arr = new Uint8Array(68);
        arr.set(data);
        console.error(data);
        if (once) {
            once = false;
            this.send('127.0.0.1', 46776, [0, 0, 0, 1, 2]);
            var MessageLength = 4, MessageID = 1, Payload = 12;
            var RequestMessageLength = MessageLength+MessageID+Payload;
            var packet = new Packet(RequestMessageLength);
            var messageLength = 12;
            packet.view.setUint32(0, messageLength);
            var messageID = 6;
            packet.data[4] = messageID;
            var offset = 5+4+4;
            var pieceSize = 524288;
            var blockSize = Math.pow(2, 16)-1;
            console.error(blockSize);
            packet.view.setUint32(13, blockSize);
            console.error(packet.data);
            this.send('127.0.0.1', 46776, packet.data);
        }
    },
    init: function () {
        this.socket.asyncListen(this);
    }
};

var server = new UDPServer(prototype);
server.init();






