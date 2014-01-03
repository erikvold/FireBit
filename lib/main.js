/*
 * @desc: This is the primary module of the FireBit Add-on
 * @file: main.js
 */

exports.main = function (options) {
    // Imports
    const { timeout, errLog, filePicker, worker } = require('./utils/helper');
    const { readTorrent, parseTorrent, isMagnet, convertMagnet, shortMagnet, tinyTorrent, convertHash } = require('./torrent');
    const { readAnnounce } = require('./tracker');
    const { createTorrent } = require('./creator');
    const { dumpSearch } = require('./dump');

    var notifications = require('sdk/notifications');
    var tabs = require('sdk/tabs');
    var self = require('sdk/self');
    var cBoard = require('sdk/clipboard');

    //Debug~!
    //tabs.activeTab.url = "http://thepiratebay.sx/browse/201/0/7/0"; //Debug~!
    //tabs.open("http://kickass.to/percy-jackson-sea-of-monsters-2013-720p-brrip-x264-yify-t8190514.html"); //Debug~!

    // TorrentPlus's primary functions
    TorrentPlus = {

        withTorrent: function (tUrl, callback, override) {
            var abort = false;
            var intercept = function (error) {
                abort = true;
                if (error.message !== 'User aborted') {
                    errLog(error);
                }
            };
            var proceed = function (binary) {
                if (!abort) parseTorrent(binary).then(callback, errLog);
            };

            if (!override && isMagnet(tUrl)) var torrent = convertMagnet(tUrl).then(readTorrent, intercept);
            else var torrent = readTorrent(tUrl, intercept);

            timeout(torrent, 3000, Error('Torrent request timed out')).then(proceed, errLog);
        },

        withMagnet: function (tUrl, callback) {
            if (isMagnet(tUrl)) callback(tUrl);
            else {
                TorrentPlus.withTorrent(tUrl, function (torrent) {
                    callback(torrent.magnet);
                }, true);
            }
        },

        withHash : function (tUrl, callback) {

            if (isMagnet(tUrl)) callback(convertHash(tUrl));
            else {
                TorrentPlus.withTorrent(tUrl, function (torrent) {
                    callback(convertHash(torrent.magnet));
                }, true);
            }
        },

        worker: worker({
            include: self.data.url('interface.html'),
            contentStyleFile: [
                self.data.url('interface.css'),
                self.data.url('jquery-ui.css')
            ],
            contentScriptFile: [
                self.data.url('jquery.js'),
                self.data.url('jquery-ui.js'),
                self.data.url('interface.js')
            ],
            onAttach: function (worker) {
                worker.port.on('announce', function (tracker) {
                    readAnnounce(tracker).then(function(results){
                       if (worker.exists) worker.port.emit('announce', results);
                    }, errLog);
                });
                worker.port.on('filePicker', function (event) {
                    filePicker('TorrentPlus - ' + event.desc, event.id, function (fp, OK) {
                        if (OK && worker.exists) worker.port.emit(event.id, fp.file.path);
                        else worker.port.emit(event.id, null);
                    });
                });
                var process = {};
                worker.port.on('create', function (pid, torrent, outfile) {
                    var progress = function (read, total, file) {
                        worker.port.emit('progress', {value:read, max:total, file:file, pid:pid});
                    };
                    process[pid] = createTorrent(torrent, progress, outfile);
                });
                worker.port.on('process', function (event) {
                    var control = process[event.id];
                    if (typeof control !== 'undefined') {
                        if (event.desc === 'Suspend') control.suspend();
                        else if (event.desc === 'Abort') { process[event.id] = undefined; control.abort(); }
                        else control.resume();
                    }
                });
            },
            error: errLog
        }),

        openTorrent: function (tUrl) {
            if (isMagnet(tUrl)) convertMagnet(tUrl)
                .then(function(tUrl){if(tUrl)tabs.activeTab.url = tUrl;}, errLog);
            else tabs.activeTab.url = tUrl;
        },

        openMagnet: function (tUrl) {
            TorrentPlus.withMagnet(tUrl, function (magnet) {
                tabs.activeTab.url = magnet;
            });
        },

        shrinkMagnet: function (tUrl) {
            TorrentPlus.withMagnet(tUrl, function (magnet) {
                shortMagnet(magnet).then(function(mgnet) {
                    if (mgnet.me.state === 'success') {
                        cBoard.set(mgnet.me.shorturl);
                        notifications.notify({
                            title: 'Magnet.me',
                            data: mgnet.me.shorturl,
                            text: 'Short URL copied to clipboard.',
                            iconURL: self.data.url('images/mgnet.me.png'),
                            onClick: tabs.open
                        });
                    } else {
                        errLog(Error(mgnet.me.message));
                    }
                });
            });
        },

        tinyTorrent: function (tUrl) {
            TorrentPlus.withTorrent(tUrl, function (torrent) {
                tinyTorrent(torrent).then(function (tUrl) {
                    cBoard.set(tUrl);
                    notifications.notify({
                       title: 'TinyURL',
                       data: tUrl,
                       text: 'Torrent TinyURL copied to clipboard.',
                       iconURL: self.data.url('images/link32.png'),
                       onClick: tabs.open
                    });
                }, errLog);
            });
        },

        editTorrent: function (tUrl) {
            //Debug~!
            TorrentPlus.worker.open('editor', tUrl); return; //Debug~!

            TorrentPlus.withTorrent(tUrl, function(torrent) {
                    TorrentPlus.worker.open('editor', torrent);
            });
        },

        makeTorrent: function () {
            TorrentPlus.worker.open('creator');
        },

        showComments: function (tUrl, xscom) {
            TorrentPlus.withHash(tUrl, function(hash) {
                if (hash.length !== 40) return errLog(Error('Unable to display torrent comments: Invalid hash length'));
                xscom.bgWorker = require('sdk/content/worker').Worker({
                    window: require('sdk/window/utils').getMostRecentBrowserWindow(),
                    contentScriptFile: self.data.url('xscom.js')
                });
                xscom.bgWorker.port.emit('init', hash);
                xscom.bgWorker.port.on('comments', function (xscoms) {
                    xscom.worker.port.emit('comments', xscoms);
                });
                xscom.bgWorker.port.on('destroy', xscom.bgWorker.destroy);
            });
        }

    };

    // Intialization
    //require('./init').initialize(TorrentPlus);

    //require('./burnbit.js').burn('http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/17.0.11esr-candidates/build1/jsshell-linux-i686.zip')

    //Debug~!
    //var torrent = parseTorrent(require('file').open('C:\\V.torrent', 'br').read()).then(TorrentPlus.editTorrent, errLog); //Debug~!

    //TorrentPlus.makeTorrent();
    
   //require('./xscom').test();
   
   /*!EXPERIMENTAL!*/
   /*
   dumpSearch('FD99D220BA1F3E393052CD1D060E7CCF1B77176D').then(function (properties) {
       tabs.open(properties.page);
   }, errLog);
   */

  var net = require('./net');
};