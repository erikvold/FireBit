const { Cc, Cu, Ci } = require('chrome');
Cu.import('resource://firefox-at-torrentplus-dot-com/torrentplus/lib/request.js');

var xsRequests = [],
xsRejects = [
    'seedpeer',
    'eztv',
    'yourbittorrent',
    'torrentdownloads',
    'fulldls',
    'torrentzap'
],
xsAlive = true, xsDebug = true;

var xsMatrix = {
    'torrentz': {
        selector: '.comment',
        aggregator: function (comment) {
            try {
                return {
                    user: comment.querySelector('a[href^="/users/"]').textContent.trim(),
                    date: comment.querySelector('span[title]').title.trim(),
                    text: comment.querySelector('.com').textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        },
        getter: function (options) {
            try {
                return {
                    url: options.url ? options.url : 'http://torrentz.eu/' + options.hash.toLowerCase(),
                    onload: function (options) {
                        Array.prototype.slice.call(options.document.querySelectorAll('.download a')).map(function (anchor) {
                                var settings = xsOptions({hash:options.hash, anchor:anchor});
                                if (xsValid(settings)) xsRequest(settings);
                        });
                        xsMatrix['defaults'].getter().onload(options);
                    },
                    onerror: options.onerror ? options.onerror : function (reg, options) {
                        if (!options.recurse) {
                            options.url = 'http://torrentz-proxy' + options.hash.toLowerCase();
                            options.onerror = xsMatrix['defaults'].getter().onerror;
                            options.recurse = true;
                            if (xsValid(options)) xsRequest(options);
                        }
                    },
                    timeout: 2000,
                    recurse: options.recurse
                };
            } catch (error) {
                xsLog('xsInit: ' + error.message, error.fileName, error.lineNumber, true);
            }
        }
    },
    'thepiratebay': {
        selector: '.comment',
        aggregator: function (comment) {
            try {
                var div = comment.parentNode.querySelector('p'), link = div.querySelector('a'),
                user = link.textContent.trim(); div.removeChild(link);
                return {
                    user: user,
                    date: xsDate(div.textContent.replace(/at|CET:|[^\000-\177]/gi, '').replace(/-/g, '/')),
                    text: comment.textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        },
        pagination: function (options) {
            try {
                var element = options.document.querySelector('.browse-coms');
                if (element) {
                    var args = element.innerHTML.match(/\(.*?\)/).toString().replace(/[\(\)'")\s]/g, '').split(',');
                    if (args.length) {
                        options.pagination = {
                            url: 'http://thepiratebay.sx/ajax_details_comments.php?id='+args[3]+'&page={page}&pages='+args[1]+'&crc='+args[2],
                            pages: args[1]
                        };
                    }
                }
            } catch (error) {xsLog(options.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    '1337x': {
        selector: '#comments li .commBoxInner',
        aggregator: function (comment) {
            try {
                var div = comment.querySelector('.trial'); try { div.removeChild(div.querySelector('sup')); } catch (ghost) { return; }
                return {
                    user: div.textContent.trim(),
                    date: '???',
                    text: comment.querySelector('p').textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'kickass': {
        selector: '.commentThread .commentcontent',
        aggregator: function (comment) {
            try {
                var user = comment.querySelector('.badgeInline a'), text = '', rates;
                if (!user) user = 'anonymous'; else user = user.textContent.trim();
                try {
                    rates = comment.querySelectorAll('.commentAVRate span');
                    for (var i = 0, elem; elem = rates[i]; i++) text += elem.textContent + ' ';
                    if (text) text += '\n\n';
                } catch (ghost) {}
                text += comment.querySelector('.commentText').textContent.replace(/\s*Last edited by.*/g, '');
                return {
                    user: user,
                    date: xsDate(comment.querySelector('.lightgrey').textContent.replace(/[^\000-\177]/g, '').trim()),
                    text: text.trim()
                };
            } catch (error) {xsLog('kickass: error: ' + error.message, error.fileName, error.lineNumber, true);}
        },
        pagination: function (options) {
            try {
                var element = options.document.querySelector('a[id^=showmore_]');
                if (element) {
                    var args = decodeURIComponent(element.href).match(/\(.*?\)/).toString().replace(/[\(\)'")\s]/g, '').split(',');
                    if (args.length) {
                        options.pagination = {
                            url: 'http://kickass.to/comments/index/torrent/'+args[1] + '/',
                            pages: 100,
                            page: 1
                        };
                    }
                }
            } catch (error) {xsLog('kickass: error: ' + error.message, error.fileName, error.lineNumber, true);}
        },
        getter: function (options) {
            try {
                if (options.anchor) {
                    options.url = options.url.match(/t\d*\.html$/).toString().replace(/[^\d]/g, '');
                    options.url = options.anchor.origin + '/comments/index/torrent/' + options.url + '/'
                }
            } catch (error) {}
            return {
                url: options.url,
                method: 'POST',
                body: 'ajax=1&page=1',
                type: 'json',
                mimetype: 'application/json',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                onload: function (options) {
                    try {
                        var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
                        //parser.init(null, this.request.URI);
                        console.error('TYPEOF options.document: ' + typeof options.document);
                        for (var x in options.document) console.error(x + ' = ' + options.document[x]);
                        console.error('HTML: ' + options.document.html);
                        options.document = parser.parseFromString(options.document.html, "text/html");
                        console.error('TYPEOF options.document: ' + typeof options.document);
                        xsMatrix['defaults'].getter().onload(options);
                    } catch (error) {
                        xsLog(error.message, error.fileName, error.lineNumber, true);
                    }
                }
            };
        }
    },
    'extratorrent': {
        selector: 'a[name^="comment"] + table',
        aggregator: function (comment) {
            try {
                var td = comment.querySelectorAll('td[class^="tabledata"]:not([class="tabledata_num"])'),
                div = td[0].querySelector('div.usr'); try { div.removeChild(div.querySelector('div')); } catch (ghost) {}
                var user = td[0].querySelector('a[href^="/profile"]').textContent.trim();
                div.parentNode.removeChild(div); div = td[0].querySelector('table tbody tr td');
                return {
                    user: user,
                    date: xsDate(div.textContent.replace(/posted by|\(|\)/g, '').replace(/-/g, '/').trim()),
                    text: td[2].textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'torlock': {
        selector: '#tblhd + div > table tbody tr',
        aggregator: function (comment) {
            try {
                var paragraph = comment.querySelectorAll('#ca, #cb')[1].querySelectorAll('p');
                var date = paragraph[0].textContent.match(/.*/), user;
                try { user = paragraph[0].querySelector('a[href^="user/"]'); } catch (ghost) {}
                if (user) user = user.textContent.trim(); else user = 'Banned user';
                return {
                    user: user,
                    date: xsDate(date.toString().replace(/.*?\.| at|by.*/gi, '').replace(/-/g, '/').trim()),
                    text: paragraph[1].textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'rarbg': {
        selector: '.ncomments_thread',
        aggregator: function (comment) {
            try {
                return {
                    user: comment.querySelector('.ncomments_user').textContent.trim(),
                    date: comment.querySelector('.ncomments_date').textContent.trim(),
                    text: xsDate(comment.querySelector('.ncomments_body').textContent.replace(/-/g, '/').trim())
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'torrentfunk': {
        selector: '.bubble > p',
        aggregator: function (comment) {
            try {
                var div = comment; while (div) {div = div.nextSibling; if (div.tagName !== 'BR') break;};
                if (!div) throw ''; var user = comment.querySelector('a[href^="/user/"]'); comment.removeChild(user);
                return {
                    user: user.textContent.trim(),
                    date: xsDate(comment.textContent.replace(/posted by|on|at /gi, '').replace(/-/g, '/').trim()),
                    text: div.textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'torrents': {
        selector: '.comments-list .text-box',
        aggregator: function (comment) {
            try {
                return {
                    user: comment.querySelector('.text-heading a[href^="user/"]').textContent.trim(),
                    date: xsDate(comment.querySelector('.text-heading > span').textContent.replace('- posted', '').replace(/-/g, '/').trim()),
                    text: comment.querySelector('p').textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'fenopy': {
        selector: '.comments > [id^="comment_row"]',
        aggregator: function (comment) {
            try {
                var div = comment.querySelector('.r1'), user = div.textContent.match(/\s*?\w*/i);
                comment = comment.querySelector('.r2'); try {comment.removeChild(comment.querySelector('.reply'));} catch (ghost) {}
                try {comment.removeChild(comment.querySelector('.rate'));} catch (ghost) {}
                return {
                    user: user.toString().trim(),
                    date: xsDate(div.textContent.replace(user, '').trim()),
                    text: comment.textContent.replace(/REPLY/, '').trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        },
        getter: function (options) {
            return {
                url: options.url + '/comments'
            };
        }
    },
    'torrenthound': {
        selector: '#pcontent > .c',
        aggregator: function (comment) {
            try {
                try {var spooky = comment.querySelector('.middle > #reply'); if (spooky) throw 'scary';}
                catch (ghost) {if (ghost === 'scary') return;}
                var div = comment.querySelector('.top');
                try {div.querySelector('p').removeChild(div.querySelector('span'));} catch (ghost) {}
                return {
                    user: 'anonymous',
                    date: xsDate(div.textContent.replace(/posted/i, '').replace(/-/g, '/').trim()),
                    text: comment.querySelector('.middle').textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        },
        getter: function (options) {
            return {
                url: options.anchor.origin + '/hash/' + options.hash + '/comments'
            };
        }
    },
    'publichd': {
        selector: 'a[name="comments"] ~ table[id="newss"] > tbody',
        aggregator: function (comment) {
            try {
                var td = comment.querySelectorAll('.floock td'); if (!td.length) return;
                return {
                    user: td[0].textContent.trim(),
                    date: xsDate(td[1].textContent.trim()),
                    text: comment.querySelector('.listc').textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'torrentcrazy': {
        selector: '.comments > li',
        aggregator: function (comment) {
            try {
                var user = comment.querySelector('b'), date = comment.querySelector('span');
                try { comment.removeChild(comment.querySelector('[id^="commentrate"]')); } catch (ghost) {}
                try { comment.removeChild(user); comment.removeChild(date);} catch (ghost) { return; }
                return {
                    user: user.textContent.trim(),
                    date: xsDate(date.textContent.trim()),
                    text: comment.textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'bitsnoop': {
        selector: '#comments > .cmntH',
        aggregator: function (comment) {
            try {
                var div = comment; while (div) {div = div.nextSibling; if (div.tagName) break;};
                var date = comment.querySelectorAll('span')[1]; comment.removeChild(date);
                return {
                    user: comment.textContent.replace(/^\s?\d+\./, '').trim(),
                    date: xsDate(date.textContent.replace(/[^:\.\-\d\w\s]/g, '').trim()),
                    text: div.textContent.trim()
                };
            } catch (error) {xsLog(this.document.URL + ': error: ' + error.message,error.fileName,error.lineNumber, true);}
        }
    },
    'newtorrents': {
        selector: '.userdetails',
        aggregator: function (comment) {
            var div = comment.parentNode.querySelector('.comment');
            var date = div.querySelector('div'); div.removeChild(date);
            return {
                user: comment.querySelector('b').textContent.trim(),
                date: xsDate(date.textContent.replace('.', ' ').trim()),
                text: div.textContent.trim()
            };
        },
        getter: function (options) {
            return {
                url: options.anchor.origin + options.anchor.pathname.replace(/\/torrent\//g, '/comments/')
            };
        }
    },
    'monova': {
        selector: 'fieldset:first-of-type div',
        aggregator: function (comment) {
            var elem = comment.querySelector('i'); try { comment.removeChild(elem); } catch (ghost) { return; }
            var block = comment.querySelector('blockquote'); comment.removeChild(block);
            return {
                date: xsDate(comment.textContent.replace(/posted by|-/gi, '').trim(), true),
                user: elem.textContent.trim(),
                text: block.textContent.trim()
            };
        },
        getter: function (options) {
            return {
                url: options.anchor.origin + options.anchor.pathname.replace(/\/torrent\//g, '/torrent/comments/')
            };
        }
    },
    'limetorrents': {
        selector: '.comment',
        aggregator: function (comment) {
            return {
                user: comment.querySelector('.commentuser').textContent.trim(),
                date: xsDate(comment.querySelector('.commentsmall').textContent.trim()),
                text: comment.querySelector('.thecomment').textContent.trim()
            };
        }
    },
    'torrentbit': {
        selector: '.comments_list .item',
        aggregator: function (comment) {
            var div = comment.querySelector('.author'), user = div.querySelector('strong');
            try { div.removeChild(user); } catch (ghost) {}
            return {
                user: user.textContent.trim(),
                date: xsDate(div.textContent.replace('|', '').trim()),
                text: comment.querySelector('.text').textContent.trim()
            };
        }
    },
    'torrentreactor': {
        selector: '.comments .media-body',
        aggregator: function (comment) {
            var head = comment.querySelector('.media-heading');
            comment.removeChild(head);
            return {
                user: head.querySelector('a[href^="/user/"]').textContent.trim(),
                date: xsDate(head.querySelector('small').textContent.replace(/-/g, ' ').trim()),
                text: comment.textContent.trim()
            };
        }
    },
    'vertor': {
        selector: '.comments li',
        aggregator: function (comment) {
            var user = comment.querySelector('b');
            var text = comment.querySelector('p');
            comment.removeChild(user); comment.removeChild(text);
            return {
                user: user.querySelector('span').textContent.trim(),
                date: xsDate(comment.textContent.replace(/-/g, '/').trim()),
                text: text.textContent.trim()
            };
        }
    },
    'bt-chat': {
        selector: 'table.c600 tbody',
        aggregator: function (comment) {
            var user; try { user = comment.querySelector('a[href^="users.php"]').textContent.trim(); } catch (ghost) { return; }
            return {
                user: user,
                date: xsDate(comment.querySelectorAll('.bottom')[1].textContent.replace(/posted|at:?/gi, '').replace(/-/g, '/').trim()),
                text: comment.querySelector('.aLeft').textContent.replace(/^:/, '').trim()
            };
        }
    },
    'defaults': {
        getter: function (options) {
            if (!options) options = {};
            if (options.anchor) {
                options.url = options.anchor.href;
                options.host = options.anchor.host.replace(/^www\.|\.[^\.]*?$/gi, '');
            }
            return {
                host: options.host,
                url: options.url,
                hash: options.hash,
                method: 'GET',
                body: null,
                type: 'document',
                onload: function (options) {
                    options = xsComments(options);
                    console.error('--------------------------HOST: ' + options.host);
                    for (var index in options.comments) {
                        console.error('User: ' + options.comments[index].user);
                    }
                },
                onerror: function (reg, options) {
                    console.error('Request failed for ' + options.host + '. ');
                },
                timeout: 5000,
                headers: null,
                send: function (reg, options) {
                    if ((xsRequests.length < 20) || options.pagination) {
                        if (!options.pagination) xsRequests.push(options.host);
                        if (xsAlive) reg.send(options.body);
                    }
                },
                set: function (property, value) {
                    this[property] = value;
                    return this;
                },
                get: function () {},
                pagination: null,
                format: function (comment) {
                    for (var prop in comment) {
                        try { comment[prop] = comment[prop].trim(); } catch (wr_obj_type) {}
                    }
                }
            };
        }
    }
};

function xsJunk(comment) { return !!comment; }

Date.prototype.reduce = function(secs) {
   this.setTime(this.getTime() - secs*1000); return this;
};

var xsTime = [{t:'month',v:2629739.52}, {t:'week',v:604800}, {t:'day',v:86400},
    {t:'hour',v:3600}, {t:'min',v:60}, {t:'sec',v:1}, {t:'now',v:0}];

function xsConv(result, date, ignore) {
    var value = date.replace(/[^\d]/g, '');
    for (var unit in xsTime) {
        if ((new RegExp(xsTime[unit].t, 'i')).test(date))
            try { return result.reduce(value*xsTime[unit].v); break; } catch (error) {}
    }
    if (ignore) return result;
}

function xsDate(date, multi) {
    try {
        var value = new Date();
        if (multi) { var dates = date.match(/\d\s\w*/g); for (var time in dates) value = xsConv(value, dates[time], true); }
        else value = xsConv(value, date); date = value ? value : date;
        var d = new Date(date); return isNaN(d.valueOf()) ? date : d.toDateString() + ' ' + d.toLocaleTimeString();
    } catch (error) { xsLog('xsDATE ERROR: ' + date + '\n' + error.message, error.lineNumber); return '???'; };
}

function xsComments(options) {
    try {
        var comments = [], element = xsMatrix[options.host];
        if (element) {
            comments = Array.prototype.slice.call(options.document.querySelectorAll(element.selector))
                .map(element.aggregator, options).filter(xsJunk);
            if (element.pagination) element.pagination(options);
        }
        return xsEmit(options.set('comments', comments));
    } catch (error) {
        xsLog(options.host + ': ' + error.message, error.fileName, error.lineNumber, true);
        return xsEmit(options.set('comments', []));
    }
}

function xsLog(message, fileName, lineNumber, normal) {
    if (!fileName) fileName = ''; if (!lineNumber) lineNumber = '';
    if (xsDebug || normal) console.error(message, fileName, lineNumber);
}

function xsEmit(options) {
    return { 
        comments: options.comments,
        host: options.host,
        url: options.url, 
        hash: options.hash,
        pagination: options.pagination
    };
}

function xsRequest(options) {
    if (options.host !== 'torrentz' && options.host !== 'kickass') return;
    try {
        var reg = new XMLHttpRequest();
        console.error('Requesting: ' + options.url + ' as ' + options.type);
        ///if (options.timeout) reg.timeout = options.timeout;
        reg.onload = function (response) { options.onload(options.set('document', response)); };
        //reg.onerror = function () { options.onerror(reg, options); };
        if (options.mimetype) reg.overrideMimeType(options.mimetype);
        if (options.type) reg.responseType = options.type;
        reg.onStateChange = function (state) {
            console.error(state + '\n@' + options.host);
            if (state.message === 'REQUEST_ERROR') {
                console.error(this.getAllResponseHeaders());
            }
        };
        reg.open(options.method, options.url, true);
        if (options.headers) {
            for (var name in options.headers) reg.setRequestHeader(name, options.headers[name]);
        }
        options.send(reg, options);
    } catch (error) {
        xsLog('xsRequest: ' + error.message, error.fileName, error.lineNumber, true);
    }
}

function xsOptions (settings) {
    var options = xsMatrix['defaults'].getter(settings);
    if (xsMatrix[settings.host]) {
         if (xsMatrix[settings.host].getter) {
             settings = xsMatrix[settings.host].getter(settings);
             for (var opt in settings) options[opt] = settings[opt];
         }
        return options;
    }
}

function xsValid(options) {
    return (options && (xsRequests.indexOf(options.host) === -1 || options.pagination) && options.host.indexOf('mirror') === -1);
}

function xsInit(hash) {
    var options = xsOptions({host: 'torrentz', url: null, hash: hash});
    if (xsValid(options)) xsRequest(options);
}

function xsPage(settings) {
    var options = xsOptions(settings);
    //if (xsValid(options)) {
        for (var opt in settings) options[opt] = settings[opt];
        xsRequest(options);
    //}
}

function xsAbort() {
    xsAlive = false;
    //self.port.emit('destroy');
}

exports.test = function () {
    xsInit('C99FAD4C019D4DF97F692A31095D7797E72C3794');
};
