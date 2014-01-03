const { XMLHttpRequest } = require('./request');
const { defer } = require('sdk/core/promise');
const { select } = require('./utils/helper');
const { TORRENT, BINARY } = require('./literals');

exports.dumpSearch = function (hash) {
    var deferred = defer();
    var url, site = select('Torrent Dump: ', TORRENT.DUMPS);
    if (site !== undefined) url = TORRENT.DUMPS[site] + '.gz';
    else {
        deferred.reject(Error('User aborted.'));
        return deferred.promise;
    }
    var torrents, segment, properties;
    var limit = (50 * BINARY.UNIT.MB);
    var xhr = new XMLHttpRequest();
    xhr.mozBackgroundRequest = true;
    xhr.convertType = {from: 'gzip', to: 'uncompressed'};
    xhr.ondata = function (stream, offset, count) {
        this.preventDefault();
        torrents = (segment + stream.read(count)).split('\n'); segment = ''; stream.close();
        if (torrents.length) {
            for (var index = 0; index < torrents.length; index++) {
                properties = torrents[index].split('|');
                if (properties.length === 5) {
                    if (properties[0] === hash) {
                        deferred.resolve({
                            hash: properties[0],
                            name: properties[1],
                            category: properties[2],
                            page: properties[3],
                            download: properties[4]
                        });
                        this.cancel(0);
                        break;
                    }
                } else if (index === torrents.length-1) {
                    segment += torrents.slice(index).join('\n');
                    break;
                }
            }
        }
        torrents = properties = 0;
        if (offset > limit) this.cancel();
    };
    xhr.open('GET', url);
    xhr.onloadend = deferred.reject.bind(deferred, Error(xhr.responseText + ': Torrent not found.'));
    xhr.send();
    return deferred.promise;
};