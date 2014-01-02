const { Hex } = require('./bytes').define(String);

var test = 'WTF';
console.log(test);
/*
var { Peer } = require('./peer');
var { HandShake } = require('./wire');

var peer = new Peer(this.id, {
    address: '127.0.0.1',
    port: 46776,
    addrType: 'dotted',
});

var hash = new Hex('1114D93F199030DD353913922F7D062FA4A3FC13');
var handshake = new HandShake(peer_id);

function shakeHandsWith(peer, hash) {
    peer.handshake = handshake.instantiate(hash);
    this.send(peer, peer.handshake);
}

peerServer.shakeHandsWith(peer, hash);
*/