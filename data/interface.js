window.editor = {};
window.creator = {};
window.bridge = {};

bridge.destroy = function () {
    delete window.editor;
    delete window.creator;
    delete window.bridge;
};

bridge.errors = 0;
bridge.debug = true;

bridge.errlog = function (error) {
    if ((++bridge.errors) < 3) self.port.emit('error', { message: error.message, fileName: error.fileName, lineNumber: error.lineNumber });
    else if (bridge.debug)
        console.error('\n' + error.message + '\n\n', 'filename: ' + error.fileName + '\n\n', 'linenumber: ' + error.lineNumber + '\n');
};

bridge.sizeBytes = function (bytes, number) {
    try {
        var units = {GB:1073741824,MB:1048576,KB:1024,B:1};
        bytes = new Number(bytes);
        if (bytes === NaN) bytes = 1;
        for (var size in units) {
            if (bytes >= units[size]) {
                if (number) return {bytes:(bytes / units[size]).toFixed(2), unit:size};
                return ((bytes / units[size]).toFixed(2) - 1 + 1) + ' ' + size;
            }
        }
    } catch (error) {
        bridge.errlog(error);
    }
};

bridge.emitEvent = function(event, cancel) {
    event.preventDefault();
    var target = $(event.target); event = {id:target.attr('id'), desc:target.attr('title'), type:event.type};
    if (!cancel) self.port.once(event.id, creator[event.id]); self.port.emit(target.attr('emit'), event);
};

// Data resource URI generator analogous to require('sdk/self').data.url().
editor.url = function (relPath) {
    return 'resource://firefox-at-torrentplus-dot-com/torrentplus/data/' + relPath;
};

editor.initialize = function (torrent) {
    try {
        if (!torrent) {
            $('#loader').text('Oops!');
            throw Error('The torrent editor must be initialized with a torrent file!')
        } else {
            editor.torrent = torrent;
            $('#info_hash').html(editor.torrent.hash.toUpperCase().match(/.{8}/gi).join('&nbsp;'));
            $('#file_name').prop('value', editor.torrent.info.name + '.torrent');
            $('#torrent').on('submit', function (event) {
                event.preventDefault();
            });
            $('#download').click(editor.downloadTorrent);
            self.port.on('announce', editor.updateTracker);
            editor.display();
        }
    } catch (error) {
        bridge.errlog(error);
    }
};

editor.display = function () {
    try {
        if (editor.torrent.hasOwnProperty('announce-list')) {
            for (var tracker of editor.torrent["announce-list"]) if (tracker) editor.createTracker(tracker);
        }
        var appendTracker = function(){$('#new_tracker').val(function(){if(this.value)editor.createTracker(this.value);});};
        $('#new_tracker').on('blur', appendTracker);
        $('#add_tracker').prop('src', editor.url('images/add.png')).click(appendTracker);
        editor.createMeta('Directory*:', 'name', 'info');
        editor.createMeta('Created On:', 'creation date', null, editor.parseDate);
        editor.createMeta('Created By:', 'created by');
        editor.createMeta('Comment:', 'comment');
        editor.createMeta('Piece Length*:', 'piece length', 'info', bridge.sizeBytes);
        $('[name="piece length"]').prop('class', 'text disabled').prop('readonly', 'readonly');
    } catch (error) {
        bridge.errlog(error);
    }
    $('#loader').remove(); $('.editor').show();
};

editor.createTracker = function (tracker) {
    try {
        if (!editor.hasOwnProperty('index')) editor.index = 0;
        else editor.index++;
        tracker = editor.parseTracker(tracker);
        var status = {http:'Connecting...', udp:'Unable to connect to UDP based trackers'}, style='';
        if (status.hasOwnProperty(tracker.protocol)) {
            if (tracker.protocol === 'udp') style = 'background-color:#C6C6C6;';
            else self.port.emit('announce', { id: 'scrape_' + editor.index, url: tracker, hash: editor.torrent.hash });
            $('<div/>', {class:'tracker_row'}).append($('<input/>', {class:'url',type:'text',value:tracker.source,style:style}))
                .append($('<img/>', {src:editor.url('images/delete.png'),class:'tracker_button'})
                .click(function(){$(this.parentNode).remove();}))
                .append($('<div/>', {id:'scrape_'+editor.index,class:'scrape'}).text(status[tracker.protocol])).appendTo('#trackers');
        } else throw Error('Poorly formatted tracker URL!');
    } catch (error) {
        bridge.errlog(error);
    }
};

editor.parseTracker = function (tracker) {
    // Unknown author - edited for clarity of use // Original name - parseURL
    var a = document.createElement('a'); a.href = tracker;
    return {
        source: tracker, protocol: a.protocol.replace(':', ''), host: a.hostname, port: a.port, query: a.search,
        params: (function () {
            var ret = {}, seg = a.search.replace(/^\?/, '').split('&'), len = seg.length, i = 0, s;
            for (; i < len; i++) {
                if (!seg[i]) continue;
                s = seg[i].split('=');
                ret[s[0]] = s[1];
            }
            return ret;
        })(),
        file: (a.pathname.match(/\/([^\/?#]+)$/i) || [, ''])[1],
        hash: a.hash.replace('#', ''),
        path: a.pathname.replace(/^([^\/])/, '/$1'),
        relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [, ''])[1],
        segments: a.pathname.replace(/^\//, '').split('/')
    };
};

editor.updateTracker = function (tracker) {
    try {
        var scrape = $('#'+tracker.id);
        if (scrape) {
            if (tracker.stats) scrape.html(tracker.stats + '&nbsp;&nbsp;&nbsp;&nbsp;');
            else {
                scrape.text(tracker.statusText);
                $(scrape.siblings('input')[0]).prop('style', 'background-color:#FF4545;');
            }
            if (tracker.hasOwnProperty('peers')) $('<a/>', {href:'#',style:'font-weight:bold;color:#005C00;'}).text('Show Peers')
                .click(function(event){event.preventDefault(); alert('Show Peers');}).appendTo(scrape);
        }
    } catch (error) {
        bridge.errlog(error);
    }
};

editor.createMeta = function (label, name, scope, value) {
    try {
        if (scope) scope = editor.torrent[scope];
        else scope = editor.torrent;
        if (scope.hasOwnProperty(name)) {
            if (value instanceof Function) value = value(scope[name]);
            else value = scope[name]; $('<div/>',{class:'row'})
            .append($('<div/>', {class:'label'}).text(label)).append($('<div/>', {class:'content'})
            .append($('<input/>', {class:'text',type:'text',name:name,value:value}))).appendTo('#meta_data');
        }
    } catch (error) {
        bridge.errlog(error);
    }
};

editor.parseDate = function () {
    try {
        if (editor.torrent.hasOwnProperty('creation date')) {
            var tdate, d = new Date(editor.torrent['creation date'] * 1000);
            tdate = d.getMonth()+1 + '/' + d.getDate() + '/' + d.getFullYear() + ' ';
            var hour = d.getHours(); if (hour > 12) hour -= 12;
            tdate += hour + ':' + d.getMinutes() + ':' + d.getSeconds() + ' ';
            if (d.getHours() > 12) tdate += 'PM';
            else tdate += 'AM'; return tdate;
        }
    } catch (error) {
        bridge.errlog(error);
    }
};

editor.downloadTorrent = function () {
    try {
        var trackers = [];
        $("#torrent :input[id^='tracker']").val(function (index, value) { trackers.push([value]); return value; });
        if (trackers.length) {
            editor.torrent['announce-list'] = trackers;
            editor.torrent.announce = trackers[0];
        } else {
            delete editor.torrent['announce-list'];
            delete editor.torrent.announce;
        }
        $("#torrent :input[id^='file']").val(function (index, value) { editor.torrent.info.files[index].path = value.split('/'); return value; });
        var torrent = $('#torrent');
        if (Object.prototype.hasOwnProperty.call(torrent, 'file_name')) editor.torrent.fileName = torrent['file_name'].value;
        if (Object.prototype.hasOwnProperty.call(torrent, 'name')) editor.torrent.info.name = torrent['name'].value;
        if (Object.prototype.hasOwnProperty.call(torrent, 'comment')) editor.torrent.comment = torrent['comment'].value;
        if (Object.prototype.hasOwnProperty.call(torrent, 'creation_date')) editor.torrent['creation date'] = Date.parse(torrent['creation_date'].value) / 1000;
        if (Object.prototype.hasOwnProperty.call(torrent, 'created_by')) editor.torrent['created by'] = torrent['created_by'].value;
        if (Object.prototype.hasOwnProperty.call(torrent, 'private') && torrent['private'].value !== '2') {
            editor.torrent.info['private'] = torrent['private'].value;
        }
        else delete editor.torrent.info['private'];
        //self.port.emit('download', editor.torrent);
    } catch (error) {
        bridge.errlog(error);
    }

};

//---------------------------------------------------------------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------//
                                                //CREATOR//
//---------------------------------------------------------------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------//


creator.initialize = function () {
    creator.torrent = {
        announce:'',
        'announce-list':[],
        info:{
            files:''
        }
    };
    creator.display();
    self.port.on('progress', creator.updateProgress);
};

creator.updateProgress = function (stats) {
    $('.process#'+stats.pid).find( '.progress' ).progressbar( 'option', { value: stats.value, max: stats.max } );
    if (stats.file.name.length > 40) {
        stats.file.name = stats.file.name.slice(0,40) + '...';
    }
    $('.process#'+stats.pid).find('.left-stat').text(stats.file.name);
    if (stats.file.read !== stats.file.size) {
        var stat = bridge.sizeBytes(stats.file.read, true);
        stat = stat.bytes + '&nbsp;' + stat.unit;
    } else var stat = bridge.sizeBytes(stats.file.read);
    $('.process#'+stats.pid).find('.right-stat').html( stat + '&nbsp;of&nbsp;'
            + bridge.sizeBytes(stats.file.size));
    if (stats.value === stats.max) {
        $('.process#'+stats.pid).find('.left-stat').text('Torrent created.');
        $('.process#'+stats.pid).find('.right-stat').text('');
        //$('.process#'+stats.pid).find('.progress').progressbar('option', 'value', false);
    };
};

creator.pid = -1;

creator.processControl = function (name, pid) {
    return $('<a/>', {href:'#', emit:'process', id:pid, title:name}).text(name)
        .click(function(event){bridge.emitEvent(event, true);});
};

creator.showProgress = function (pid) {
    $('<div/>', {class:'process',id:pid})
        .append(creator.processControl('Suspend', pid)).append( $('<span/>').text('|'))
        .append(creator.processControl('Resume', pid)).append( $('<span/>').text('|'))
        .append(creator.processControl('Remove', pid))
        .append( $('<div/>', {class:'progress'}).progressbar({value: false})
            .append( $('<div/>', {class:'label left-stat'}))
            .append( $('<div/>', {class:'label right-stat'})))
        .appendTo('.process-controls');
    return pid;
};

creator.modeOpen = function (path) {
    if (path) creator.torrent.info.files = [path];
};

creator.modeGetFolder = function (path) {
    if (path) creator.torrent.info.files = [path];
};

creator.modeSave = function (path) {
    alert(path);
    if (path && creator.torrent.info.files)
        self.port.emit('create', creator.showProgress(++creator.pid), creator.torrent, path);
};

creator.showPicker = function (id, title, text) {
    $('<button/>', {class:'select-file', emit:'filePicker', id:id, title:title})
            .text(text).click(bridge.emitEvent).button().appendTo('.creator .box');
};

creator.display = function () {
    try {
        creator.showPicker('modeOpen', 'Select File', 'File');
        creator.showPicker('modeGetFolder', 'Select Directory', 'Directory');
        creator.showPicker('modeSave', 'Save .torrent file', 'Create');
        $('<div/>', {class:'process-controls'}).appendTo('.creator .box');
    } catch (error) {
        bridge.errlog(error);
    }
    $('#loader').remove(); $('.creator').show();
};


// Listen for initialization
self.port.once('editor', editor.initialize);
self.port.once('creator', creator.initialize);
// Listen for destruction
self.on('detach', bridge.destroy);