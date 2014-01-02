/*
 * @desc: This is the basex module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: basex.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// Exports: { base64, base32, base16 }

this.Nibbler = require('./nibbler').Nibbler;

this.basex = {
    base64: require('sdk/base64'),
    // Used to convert base 32 encoded torrent info hashes into the standard format
    base32: new Nibbler({
        dataBits: 8,
        codeBits: 5,
        keyString: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
        pad: '='
    }),
    // Used in conjunction with the base32 function
    base16: new Nibbler({
        dataBits: 8,
        codeBits: 4,
        keyString: '0123456789ABCDEF'
    })
};

for (var name in this.basex) exports[name] = this.basex[name];
delete this.basex;
delete this.Nibbler;