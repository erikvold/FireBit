
    updateBinary = function (torrent) {
        try {
            var binary = {},
                fileName;
            for (property in torrent) {
                if (property !== 'location' && property !== 'binary' && property !== 'size' && property !== 'hash' && property !== 'magnet' && property !== 'fileName') {
                    binary[property] = torrent[property];
                }
            }
            if (torrent.hasOwnProperty('fileName')) fileName = torrent.fileName;
            if (!torrent.hasOwnProperty('location')) torrent.location = '';
            torrent = parseTorrent(bencode(binary), null, torrent.location, true);
            torrent.fileName = fileName;
            cache[torrent.hash] = torrent;
            return torrent;
        } catch (error) {
            error(error);
        } // Catch and log any errors
    };

    saveTorrent = function (fileName, binary) {
        var window = windowUtils.getMostRecentBrowserWindow();
        picker.init(window, 'TorrentPlus - Save as', Ci.nsIFilePicker.modeSave);
        picker.appendFilter('Torrent (*.TORRENT)', '*.torrent');
        picker.defaultExtension = 'torrent';
        picker.defaultString = fileName;
        var ret = picker.show();
        if (ret === Ci.nsIFilePicker.returnOK || ret === Ci.nsIFilePicker.returnReplace) {
            var path = picker.file.path;
            ioTorrent(path, binary);
            /*Cu.import('resource://gre/modules/Downloads.jsm');
            var URI = 'data:application\/x-bittorrent;base64,'
            + base64.encode(binary);
            createDownload(URI, picker.file).then(download => {
                download.start();
            });*/
            
        }
    };

    geoLocate = function (request, worker, recursive) {
        if (!recursive) {
            Request({
                url: 'http://freegeoip.net/json/' + request.id.split('-').slice(0, 4).join('.'),
                onComplete: function (response) {
                    request.response = response.text;
                    geoLocate(request, worker, true);
                }
            }).get(); // Send the request
        } else {
            try {
                request.response = JSON.parse(request.response);
            } catch (e) {}
            if (worker.hasOwnProperty('exists') && worker.exists) worker.port.emit('geolocate', request);
        }

    };
