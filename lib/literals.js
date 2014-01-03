/*
 * @desc: This is the literals module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: literals.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// Exports: { BINARY, MAGNET, TORRENT, CHARS }

const literals = {

    BINARY: {
        IO: {
            MIMETYPE: 'text\/plain; charset=x-user-defined',
            READ: 'br',
            WRITE: 'bw'
        },
        UNIT: {
            KB: 1024,
            MB: 1048576
        }
    },
    MAGNET: {
        SCHEME: 'magnet:',
        XT: '?xt=urn:btih:',
        DN: '&dn=',
        XL: '&xl=',
        TR: '&tr=',
        RE: /^magnet:\?/i,
        HASH: /xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})/i
    },
    TORRENT: {
        URL: '\.torrent$|([a-f0-9]{40}|[a-z2-7]{32})', //RE
        MIRRORS: ['http://istoretor.com', 'http://torcache.net', 'http://torrage.com', 'http://zoink.it', 'http://torrentproject.com', 'http://reflektor.karmorra.info', 'http://thehashden.org', 'http://torage.co/'],
        DUMPS: ['http://kickass.to/hourlydump.txt', 'http://kickass.to/dailydump.txt', 'http://www.monova.org/torrentz', 'http://ext.bitsnoop.com/export/b3_verified.txt']
    },
    CHARS: {
        HEX: /.{2}/gi,
        ASCII: /[0-9]|[A-Z]|[\.\-\_\~]/i
    }

};

for (var name in literals) exports[name] = literals[name];
