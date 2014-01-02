// This is the site dynamic TorrentPlus content script.
if (typeof TorrentPlus === 'undefined') {

    var TorrentPlus = {};

};

// Constants
TorrentPlus.SELECTOR_TORRENT = {
    SEARCH: '.results dt > :first-child',
    DOWNLOAD: '.download dt > :first-child'
};
TorrentPlus.PAGE_TYPE = null;

TorrentPlus.SELECTOR_TRACKER = '.trackers dt a';
TorrentPlus.SELECTOR_SIZE = '.s';
TorrentPlus.MAGNET_PROTOCOL = 'magnet:';
TorrentPlus.MAGNET_XT = '?xt=urn:btih:';
TorrentPlus.MAGNET_DN = '&dn=';
TorrentPlus.MAGNET_XL = '&xl=';
TorrentPlus.MAGNET_TR = '&tr=';
TorrentPlus.UNIT_MEGABYTE = 1048576;
TorrentPlus.UNIT_KILOBYTE = 1024;
TorrentPlus.PATTERN_SIZE = /(\d+)\s(MB|GB)/;
TorrentPlus.PATTERN_BTIH = /xt=urn:btih:((?:[a-f0-9]{2}){20})/i;

// Inherited Properties
TorrentPlus.error = null;
TorrentPlus.id = null;
TorrentPlus.emit = null;

// Tracker Request Queue
TorrentPlus.queue = {};

// Icon Click Event Handler
TorrentPlus.click = function() {
    try {
        if (TorrentPlus.PAGE_TYPE == 'SEARCH') {

            TorrentPlus.queue[this.className] = this;

            /*
                  self.port.emit(
                                'tracker-request',
                                {
                                    url : this.href,
                                    id  : this.className
                                } 
                              );
                */
        } else {
            TorrentPlus.tracker(this, document);
            this.removeEventListener('click', TorrentPlus.click, false);
        }
    } catch (error) {
        TorrentPlus.error(error);
    }
};

TorrentPlus.handler = function(data) {
    try {

        var image = TorrentPlus.queue[data.id];
        delete TorrentPlus.queue[data.id];
        image.removeEventListener('click', TorrentPlus.click, false);
        console.log("test 13 " + data.xml);
        TorrentPlus.tracker(image, data.xml);

    } catch (error) {
        TorrentPlus.error(error);
    }
};

// reformat size
TorrentPlus.format = function(match, size, unit) {
    try {

        size = parseInt(size, 10) * TorrentPlus.UNIT_MEGABYTE;
        if (unit === 'GB') size *= TorrentPlus.UNIT_KILOBYTE;
        return size;

    } catch (error) {
        TorrentPlus.error(error);
    }
};

// torrent request callback
TorrentPlus.tracker = function(image, downloadPage) {
    try {
        return function() {
            try {

                console.log("test 7");

                var element = downloadPage.querySelectorAll(TorrentPlus.SELECTOR_TRACKER),
                    list = [];

                for (var i = 0; i < element.length; i++) {
                    list.push(element[i].textContent);
                }

                image.id += list.join(TorrentPlus.MAGNET_TR);

                window.open(image.id);

            } catch (error) {
                TorrentPlus.error(error);
            }
        };
    } catch (error) {
        TorrentPlus.error(error);
    }
};

// create icons
TorrentPlus.init = function(icon) {
    try {
        if (/search|verified|any/i.test(document.URL)) {

            TorrentPlus.PAGE_TYPE = 'SEARCH';
            console.log('Detected a search page');

        } else if (/\/\w{40}/i.test(document.URL)) {

            TorrentPlus.PAGE_TYPE = 'DOWNLOAD';
            console.log('Its a download page.');

        } else if (!TorrentPlus.PAGE_TYPE) {

            console.log("Not a search or download page!");
            return null;

        }

        var torrent = document.querySelectorAll(TorrentPlus.SELECTOR_TORRENT[TorrentPlus.PAGE_TYPE]);

        if (TorrentPlus.PAGE_TYPE == 'SEARCH') {

            var image = document.createElement('img');
            image.src = icon;

            var span = document.createElement("span");
            span.setAttribute("style", "float:left;width:24px;padding-right:5px;margin-top:-2px;cursor: pointer;");

        }

        for (var index = 0; index < torrent.length; index++) {

            var duplicate = image.cloneNode(true),
                btih = torrent[index].href.substr(20),
                element = torrent[index].parentNode.parentNode.getElementsByTagName('dd')[0],
                size = info_element.querySelector(TorrentPlus.SELECTOR_SIZE),
                info;

            duplicate.href = torrent[index].href;

            duplicate.title = torrent[index].innerHTML;

            duplicate.setAttribute('class', TorrentPlus.id + ' image ' + index).

            setAttribute("id", TorrentPlus.MAGNET_PROTOCOL + TorrentPlus.MAGNET_XT + btih + encodeURIComponent(TorrentPlus.MAGNET_DN) + torrent[i].textContent + (size ? TorrentPlus.MAGNET_XL + size.textContent.replace(TorrentPlus.PATTERN_SIZE, TorrentPlus.format) : '')).

            addEventListener('click', TorrentPlus.click);

            duplicate = span.cloneNode(true).appendChild(duplicate);

            element.style.width = "300px";

            info = element.childNodes[0];

            if (info) {

                if (info.innerHTML == " ") info.setAttribute("style", "background:none !important;");

                element.insertBefore(duplicate, info);

            } else throw "Critical Error!  Unable to parse document!";

        }
    } catch (error) {
        TorrentPlus.error(error);
    }
};


self.port.on('init', TorrentPlus.init);
//self.port.on( 'test', TorrentPlus.test );