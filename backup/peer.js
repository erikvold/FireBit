(function () {
    
    try {

        if (!Object.prototype.hasOwnProperty.call(this, 'TorrentPlus')) {
            throw new Error('The TorrentPlus object does not exist!\nThe peer module cannot be loaded!\n');
        }

    } catch (error) {

        console.error(error.message, error.fileName, error.lineNumber);
        return undefined;

    }

    try {

        TorrentPlus.peerRequest = function () {
            try {
                if (TorrentPlus.hasOwnProperty('request') && TorrentPlus.queue.active && TorrentPlus.request.length) {
                    var request = TorrentPlus.request.shift();
                    if (!request.hasOwnProperty('counter')) {
                        request.counter = 0;
                    }
                    if (request.process && !TorrentPlus.queue[TorrentPlus.queue.recent][request.id].hasOwnProperty('port') && (request.counter < 2)) {
                        TorrentPlus.queue[TorrentPlus.queue.recent][request.id].port = true;
                        request.counter += 1;
                        self.port.emit('geolocate', request);
                    } else if (TorrentPlus.request.length) {
                            TorrentPlus.peerRequest();
                    }
                }
            } catch (error) {
                TorrentPlus.error(error);
            }

        };

        TorrentPlus.peerResponse = function (request) {
            try {
                if (request && (typeof request === 'object') && request.hasOwnProperty('id') && request.id && (typeof request.id === 'string')) {
                    if (TorrentPlus.hasOwnProperty('queue') && (typeof TorrentPlus.queue === 'object') && TorrentPlus.queue[TorrentPlus.queue.recent].hasOwnProperty(request.id)) {
                        if ((typeof TorrentPlus.queue[TorrentPlus.queue.recent][request.id] === 'object')) {
                            if (TorrentPlus.queue[TorrentPlus.queue.recent][request.id].hasOwnProperty('port')) {
                                delete TorrentPlus.queue[TorrentPlus.queue.recent][request.id].port;
                                try {
                                    if (request.hasOwnProperty('response') && (typeof request.response === 'object') && request.response) {
                                        TorrentPlus.peerUpdate(request);
                                    }
                                    TorrentPlus.peerRequest();
                                } catch (error) {
                                    TorrentPlus.error(error);
                                }
                            } else {
                                throw new Error('The peer request has no port property!\n');
                            }
                        } else {
                            throw new Error('The queued peer request is not a valid object!\n');
                        }
                    } else {
                        throw new Error('The peer request queue does not contain "' + request.id + '"!\n');
                    }
                } else {
                    throw new Error('The peer request object is invalid!\n');
                }
            } catch (error) {
                TorrentPlus.error(error);
            }
        };

        TorrentPlus.peerUpdate = function (request) {
            try {
                if (request && (typeof request === 'object') && request.hasOwnProperty('response') && (typeof request.response === 'object')) {
                    request.process = false;
                    if (request.response.hasOwnProperty('country_code') && request.response['country_code']) {
                        if (request.hasOwnProperty('id') && request.id && (typeof request.id === 'string')) {
                            if (TorrentPlus.queue.active) {
                                TorrentPlus.queue[TorrentPlus.queue.recent][request.id] = request;
                                var peer = document.getElementById(request.id);
                                if (peer) {
                                    var IP = peer.innerHTML,
                                            country = '';
                                    if (request.response.hasOwnProperty('country_name'))
                                        country = request.response['country_name'];
                                    peer.innerHTML = '<img src="' + TorrentPlus.locate("images/flags/" + request.response['country_code'].toLowerCase() + ".png") + '" title="' + country + '" style="float:left;margin-right:3px;margin-left:5px;"/>&nbsp;' + IP + '&nbsp;';
                                    var img = document.createElement('img');
                                    img.setAttribute('src', TorrentPlus.locate("images/info.png"));
                                    img.setAttribute('style', 'float:right;');
                                    img.setAttribute('title', 'Show Details');
                                    img.setAttribute('class', 'peerimg');
                                    peer.addEventListener('mouseover', function() {
                                        img.setAttribute('style', 'float:right;display:block;cursor:pointer;');
                                    });
                                    peer.addEventListener('mouseout', function() {
                                        img.setAttribute('style', 'display:none;');
                                    });
                                    peer.appendChild(img);
                                }
                            } else {
                                //throw new Error('Cannot update the peer table when the queue is inactive!\n');
                            }
                        } else {
                            throw new Error('The following request ID is invalid!\nID: ' + request.id + '\n');
                        }
                    }
                }
            } catch (error) {
                TorrentPlus.error(error);
            }
        };

        TorrentPlus.peerDisplay = function (tracker) {
            try {
                if (tracker && (typeof tracker === 'object')) {
                    if (tracker.hasOwnProperty('peers') && tracker.peers && (typeof tracker.peers === 'object')) {
                        if (!TorrentPlus.hasOwnProperty('queue'))
                            TorrentPlus.queue = {};
                        TorrentPlus.queue.active = tracker.id;
                        TorrentPlus.queue.recent = tracker.id;
                        var table = document.createElement('table');
                        table.setAttribute('class', 'peertable');
                        var tr = document.createElement('tr');
                        var td = document.createElement('td');
                        td.setAttribute('style', 'border:1px solid rgb(0,102,0);color:black;background-color:white;');
                        var element, row, id;
                        row = tr.cloneNode(true);
                        for (var i = 0; i < tracker.peers.length; i++) {
                            row = tr.cloneNode(true);
                            element = td.cloneNode(true);
                            element.innerHTML = tracker.peers[i];
                            id = tracker.peers[i].replace(/\.|\:/gi, '-');
                            element.setAttribute('id', id);
                            if (!TorrentPlus.queue.hasOwnProperty(tracker.id)) TorrentPlus.queue[tracker.id] = {};
                            if (!TorrentPlus.queue[tracker.id].hasOwnProperty(id)) {
                                TorrentPlus.queue[tracker.id][id] = {
                                    process: true,
                                    id: id
                                };
                            }
                            row.appendChild(element);
                            table.appendChild(row);
                        }
                        var modal = document.getElementById('modal');
                        if (modal) {
                            var div = document.getElementById('peers');
                            if (div) {
                                div.innerHTML = '';
                                div.appendChild(table);
                                TorrentPlus.peerProcess();
                                div = document.getElementById('peerdiv');
                                if (div) {
                                    try {
                                        modal.addEventListener('click', function() {
                                            modal.setAttribute('style', 'display:none;');
                                            div.setAttribute('style', 'display:none;');
                                            TorrentPlus.queue.active = false;
                                            if (TorrentPlus.hasOwnProperty('request')) delete TorrentPlus.request;
                                            return false;
                                        }, false);
                                        modal.setAttribute('style', 'display:block;');
                                        div.setAttribute('style', 'display:block;');
                                    } catch (error) {
                                        TorrentPlus.error(error);
                                    }
                                } else {
                                    throw new Error('The peers parent division does not exist!\nCannot display peers!\n');
                                }
                            } else {
                                throw new Error('The peers division does not exist!\nCannot insert peer table!\n');
                            }
                        } else {
                            throw new Error('The modal division does not exist!\n');
                        }
                    } else {
                        throw new Error('The tracker\'s peer property is invalid!\nCannot display peers!\n');
                    }
                } else {
                    throw new Error('The tracker object is invalid!\nCannot display peers!\n');
                }
            } catch (error) {
                TorrentPlus.error(error);
            }

        };

        TorrentPlus.peerProcess = function () {
            try {
                if (!TorrentPlus.hasOwnProperty('request') || !TorrentPlus.request)
                    TorrentPlus.request = [];
                var recent = TorrentPlus.queue.recent;
                if (TorrentPlus.queue.active) {
                    for (var id in TorrentPlus.queue[recent]) {
                        if (TorrentPlus.queue[recent][id].hasOwnProperty('process')) {
                            if (TorrentPlus.queue[recent][id].process) {
                                TorrentPlus.request.push(TorrentPlus.queue[recent][id]);
                            } else {
                                TorrentPlus.peerUpdate(TorrentPlus.queue[recent][id]);
                            }
                        } else {
                            if (id !== 'active' && id !== 'recent') throw new Error('The queued peer request has no "process" property!\nID: ' + id);
                        }
                    }
                    TorrentPlus.peerRequest();
                }
            } catch (error) {
                TorrentPlus.error(error);
            }
        };

    } catch (error) {
        console.error(error.message, error.fileName, error.lineNumber);
    }

    console.log('The TorrentPlus Peer Module has been loaded!\n');

    return undefined;

})();