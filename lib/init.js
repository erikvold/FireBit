/*
 * @desc: This is the intialization module of the FireBit Add-on
 * @author: Rodney Teal
 * @file: init.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// Exports: { initialize }

const { cMenuListener } = require('./listen');

// SDK Modules
var cMenu = require('sdk/context-menu');
var { PageMod } = require('sdk/page-mod');
var self = require('sdk/self');

// Initialize the TorrentPlus Addon
exports.initialize = function (TorrentPlus) {
    try {

        // Global PageMod - works on all documents loaded into the browser

        PageMod({
            include: '*',
            contentScriptFile: [
                self.data.url('jquery.js'), self.data.url('jquery-ui.js'), self.data.url('toolbar.js'),
                self.data.url('jquery.simplePagination.js')
            ],
            contentStyleFile: [
                self.data.url('jquery-ui.css'), self.data.url('toolbar.css'),
                self.data.url('simplePagination.css')
            ],
            contentScriptWhen: 'start',
            attachTo: ["existing", "top"],
            onAttach: function (worker) { //// Worker is an EventEmitter
                worker.port.on('Download Torrent', TorrentPlus.openTorrent);
                worker.port.on('Download Magnet', TorrentPlus.openMagnet);
                worker.port.on('Edit Torrent', TorrentPlus.editTorrent);
                worker.port.on('Shrink Magnet', TorrentPlus.shrinkMagnet);
                worker.port.on('Torrent > TinyURL', TorrentPlus.tinyTorrent);
                var xscom = {
                    'worker': worker,
                    'bgWorker': null,
                    'active': false,
                    'listen': function () {
                        if (!xscom.active) {
                            xscom.active = true;
                            worker.port.once('xscom-page', function (options) {
                                xscom.active = false; xscom.listen();
                                if (xscom.bgWorker) xscom.bgWorker.port.emit('page', options);
                            });
                        }
                    }
                };
                worker.port.on('Show Comments', function (tUrl) {
                    TorrentPlus.showComments(tUrl, xscom); xscom.listen();
                    worker.port.once('xscom-abort', function (destroy) {
                        if (xscom.bgWorker) xscom.bgWorker.port.emit('abort');
                        if (destroy) { worker.destroy(); console.error('Destroyed toolbar.js worker.'); }
                    });
                });
            }
        });

        cMenu.Menu({
            label: 'TorrentPlus',
            context: cMenu.SelectorContext('a'),
            items: [
            cMenu.Item({
                label: 'Magnet Short-URL',
                context: cMenu.SelectorContext('a'),
                contentScript: cMenuListener,
                onMessage: TorrentPlus.shrinkMagnet
            })
            ]
        });

    } catch (error) {
        TorrentPlus.error(error);
    }
};

