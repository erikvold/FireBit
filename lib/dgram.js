const { Cc, Ci } = require('chrome'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/chrome.html
const { Class } = require('sdk/core/heritage'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/core/heritage.html
let { EventTarget } = require("sdk/event/target"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/event/target.html
let { emit } = require("sdk/event/core"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/event/core.html

// This module implements http://nodejs.org/api/dgram.html with the following differences:

/*
 * socket.bind does not accept an address argument instead you can specify boolean aLoopbackOnly
 * Any socket close event listeners will be called with a status argument of type Number
 * Socket does not implement any of the methods listed below
 * socket.setBroadcast(flag)
 * socket.setTTL(ttl)
 * socket.setMulticastTTL(ttl)
 * socket.setMulticastLoopback(flag)
 * socket.addMembership(multicastAddress, [multicastInterface])
 * socket.dropMembership(multicastAddress, [multicastInterface])
 * socket.unref()
 * socket.ref()
 */

const SocketListener = Class({
    onStopListening: function (_, aStatus) { // nsIUDPSocketListener
        emit(this, 'close', aStatus)
    },
    onPacketReceived: function (_, aMessage) {
        emit(this, 'message', aMessage.data, aMessage.fromAddr);
    }
});

const Socket = Class({
    extends: EventTarget,
    implements: [SocketListener],
    initialize: function initialize(port, aLoopbackOnly, callback) {
        this.socket = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket); // See: http://dxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsIUDPSocket.idl
    },
    send: function (bytes, offset, length, port, address, callback) {
        var data = offset ? bytes : bytes.slice(offset);
        var byteCount = this.socket.send(address, port, data, (length ? length : data.length));
        var error = byteCount ? null : (new Error('No bytes were written to the socket.'));
        if (error) emit(this, 'error', error);
        if (typeof callback === 'function') {
            callback(error, byteCount);
        }
    },
    bind: function (port, aLoopbackOnly, callback) {
        var callable = false;
        if (typeof aLoopbackOnly === 'function') {
            ([callback, aLoopbackOnly]) = [aLoopbackOnly, callback];
            callable = true;
        } else if (typeof callback === 'function') {
            callable = true;
        }
        try {
            if (port > 0xFFFF) {
                throw new RangeError('Port number is out of range.');
            }
            this.socket.init(((+aPort) ? aPort : -1), aLoopbackOnly);
            this.socket.ayncListen(this);
        } catch (error) {
            emit(this, 'error', error);
            return;
        }
        emit(this, 'listening');
        if (callable) callback();
    },
    close: function () {
        this.socket.close();
    },
    address: function () {
        return {port: this.port, address: null};
    },
    get port() this.socket.port
});

exports.Socket = Socket;

function createSocket(type, callback) {
    var callable = false;
    var socket = new Socket();
    if (typeof type === 'function') {
        ([type, callback]) = [callback, type];
    } else if (typeof callback === 'function') {
        callable = true;
    }
    if (callable) {
        socket.on('message', callback);
    }
    return socket;
};

exports.createSocket = createSocket





