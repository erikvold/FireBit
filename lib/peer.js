const { Class } = require('sdk/core/heritage');
const { Addr } = require('./addr');

// Stripped of all the unnecessary code

exports.Peer = Class({
    extends: Addr,
    initialize: function initialize(...args) {
        Addr.prototype.initialize.apply(this, args);
    },
    requiresHandShake: true,
    choked: true,
    interested: false
});




