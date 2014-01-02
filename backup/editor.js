

        


    }
    if (torrent.info.hasOwnProperty('private')) {
        metaData.push(new MetaDataObj('private', torrent.info['private'], 'Private*:'));
    } else {
        metaData.push(new MetaDataObj('private', 2, 'Private*:'));
    }

    for (var i = 0; i < metaData.length; i++) {
        newRow = row.cloneNode(true);
        newLabel = TorrentPlus.createElement([label, "innerHTML=" + metaData[i].label], true);
        newRow.appendChild(newLabel);

        } else {
            var select = TorrentPlus.createElement(["select", "name=private"]);
            var values = ["Off - Set", "On - Set", "Off - Unset"];
            for (var value = 0; value < 3; value++) {
                if (metaData[i].value === value) {
                    option = TorrentPlus.createElement(["option", "value=" + value, "innerHTML=" + values[value], "selected=selected"]);
                } else {
                    option = TorrentPlus.createElement(["option", "value=" + value, "innerHTML=" + values[value]]);
                }
                select.appendChild(option);
            }
            newRow.appendChild(select);
        }
        section.appendChild(newRow);
    }
};

TorrentPlus.listFiles = function (torrent) {
    var section = document.getElementById('section_3');
    section.appendChild(TorrentPlus.createElement(['h2', 'innerHTML=Files']));

    var row = TorrentPlus.createElement(['div', 'class=row']);
    var input = TorrentPlus.createElement(['input', 'class=text']);
    var inputSmall = TorrentPlus.createElement(['input', 'class=text disabled small', 'readonly=readonly']);

    var newRow = row.cloneNode(true);
    newRow.appendChild(TorrentPlus.createElement(['div', 'class=long', 'innerHTML=Filename*']));
    newRow.appendChild(TorrentPlus.createElement(['div', 'class=small', 'innerHTML=File Size*']));
    section.appendChild(newRow);

    var newInput, file, value;

    for (var i = 0; i < torrent.info.files.length; i++) {
        file = torrent.info.files[i];
        newRow = row.cloneNode(true);
        newInput = TorrentPlus.createElement([input, 'name=file_' + i, 'value=' + file.path.join('/')], true);
        newRow.appendChild(newInput);
        newInput = TorrentPlus.createElement([inputSmall, 'value=' + TorrentPlus.byteSize(file.length)], true);
        newRow.appendChild(newInput);
        section.appendChild(newRow);
    }
};



TorrentPlus.debug = function (torrent, name) {
    for (var property in torrent) {
        console.log(property + ' = ' + torrent[property] + ' in ' + name);
        if (typeof torrent[property] === 'object') TorrentPlus.debug(torrent[property], property);
    }
};

TorrentPlus.error = function (error) {
    console.error('Message: ' + error.message, '\nFileName: ' + error.fileName, '\nLineNumber: ' + error.lineNumber);
};

TorrentPlus.hasOwn = function (obj, prop) {
    return (obj, prop);
};

TorrentPlus.setFavicon = function (image) {
    var favicon = document.createElement('link');
    favicon.type = 'image/png';
    favicon.rel = 'shortcut icon';
    favicon.href = TorrentPlus.locate('images/' + image);
    document.getElementsByTagName('head')[0].appendChild(favicon);
};




// Check the Prereqs...
if (!Object.prototype.hasOwnProperty.call(GLOBAL_OBJECT, 'self')) {
    throw new Error("Critical Error: GLOBAL_OBJECT.self === undefined");
}
} catch (error) {
    try {
        console.error(error.message, error.fileName, error.lineNumber);
        delete GLOBAL_OBJECT.TorrentPlus;
    } catch (e) {}
    return undefined; // Abort script execution.
}

})();