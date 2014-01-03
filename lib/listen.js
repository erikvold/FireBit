/*
 * @desc: This is the listeners module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: listen.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// Exports: { linkListener, cBoardListener, cBoardMonitor, cMenuListener }

this.deletable = function () {

    var cBoard = require('sdk/clipboard');

    exports.cBoardMonitor = function () {
        console.log('Data copied to clipboard!');
        var contents = cBoard.get();
        console.log(contents);
    };

    // The page mod content script that exports all the matching links in a document
    exports.linkListener = '(' + (function () {
        //// This function isn't executed until the page is ready and we send the 'get-links' message
        // The URL param is the TORRENT.URL regular expression as a (STRING)
        self.port.on('get-links', function (url) {
            var links = []; // Create the list
            url = new RegExp(url, 'i'); // Dynamically create the RE object
            for (var i = 0; i < document.links.length; i++) { //// Iterate through all links
                if (i >= 50) break; // Set a limit
                if (url.test(document.links[i])) { //// If its a torrent url
                    $(document.links[i]).toolbar('.torrentplus-tools');
                }
            }
            self.port.emit('got-links', links); // Here we export the list of torrent urls
        });

    }).toString() + ')();';

    exports.cBoardListener = '(' + (function () {

        window.addEventListener('copy', function () {
            self.port.emit('copy');
        }, false);

    }).toString() + ')();';

    // The context menu content script used to export the link thats been selected
    exports.cMenuListener = '(' + (function () {

        self.on('click', function (anchor) {
            self.postMessage(anchor.href);
        });

    }).toString() + ')();';

};

deletable();
delete this.deletable();
