var toolbar, data = null, cdiv, cdiv_visible, cdiv_active = false, 
        torrent = new RegExp('\.torrent$|([a-f0-9]{40}|[a-z2-7]{32})', 'i'),
        cdiv_hash, ctabs, ctablist, ctabtitle, ctabhash, 
        imgpath = 'resource://firefox-at-torrentplus-dot-com/torrentplus/data/images';



function xsEmit(event) {
    console.error('Toolbar.js > xsEmit > ' + data);
    if (event === 'Show Comments') xsAbort(true); self.port.emit(event, data);
}

function xsAbort(hide) {
    if (hide) { if (cdiv) cdiv.hide(); cdiv_visible = false; cdiv_active = true; }
    self.port.emit('xscom-abort', !hide);
}

function xsToolbar() {
    if (torrent.test(this.href)) {
        $(this).on('mouseover', function (event) {
            var anchor = $(event.target); data = this.href;
            toolbar.css({
                display: 'block',
                left: (anchor.offset().left - 8.5) + 'px',
                top: (anchor.offset().top - 40) + 'px'
            });
            event.preventDefault();
        });
    }
}

$(document).on('DOMNodeInserted', function(event) { if (event.target.tagName == 'A') xsToolbar.call(event.target); });
$(document).ready(function () {
    $(document.links).each(xsToolbar);
    var button = function (title, src) {
        return $('<a/>').prop({href:'#', title:title, class:'tp-emit'}).append($('<img/>')
            .prop('src', imgpath + '/' + src))
            .click(function (event) { event.preventDefault(); xsEmit(title); });
    };
    
    $('#sky-right, #sky-banner, .ad, iframe').remove();
    
    toolbar = $('<div/>', {'class':'torrentplus-toolbar jq-toolbar-tip', style:'display:none;'})
            .append( button('Download Magnet', 'icon16.png') )
            .append( button('Download Torrent', 'torrent.png') )
            .append( button('Edit Torrent', 'editor.png') )
            .append( button('Shrink Magnet', 'mgnet.me16.gif') )
            .append( button('Torrent > TinyURL', 'link.png') )
            .append( button('Show Comments', 'comment.png') )
        .append( $('<div/>', {'class':'toolbar-tip'} ));
    toolbar.appendTo('body');
});
$(document).on('click', function(){ $('.torrentplus-toolbar').hide(); });
$(window).unload(xsAbort);

function xsPagination(tab, holder, pagination, options) {
    return $('<div/>', {class:'pagination'})
        .pagination({
            currentPage: pagination.page ? pagination.page : pagination.pages,
            pages: pagination.pages,
            displayedPages: 5,
            edges: 0,
            cssStyle: 'dark-theme',
            selectOnClick: false,
            onPageClick: function (page, event) {
                event.preventDefault();
                if (options.host === 'thepiratebay') options.url = pagination.url.replace('{page}', page);
                else if (options.host === 'kickass') options.body = 'ajax=1&page='+page;
                holder.html('<h1>Loading...</h1>'); tab.scrollTop(0);
                self.port.emit('xscom-page', options);
            }
        });
}

self.port.on('comments', function (xscom) {
    var comments = '';
    for (var comment, i = 0; comment = xscom.comments[i]; i++) {
        if (comment) {
            comments += '<div class=\'torrentplus-comment-user\'>'+comment.user;
            comments += '<span class=\'torrentplus-comment-date\'>&nbsp;&nbsp;'+comment.date+'</span></div>';
            comments += '<p class=\'torrentplus-comment-text\'>'+comment.text+'</p>';
        } else comments += '\nInvalid comment returned from ' + xscom.host;
    }
    if (comments.length) {
        if (!cdiv) {
            cdiv_hash = xscom.hash; ctablist = $('<ul/>');
            ctabs = $('<div/>', {id:'torrentplus-ctabs'}).append( ctablist ).tabs({collapsible: true});
            cdiv = $('<div/>', {id:'torrentplus-comments'})
                .append( ctabs ); cdiv.appendTo(document.body);
            cdiv.draggable({handle:'.ui-tabs-nav', cancel:'.ui-tabs-anchor'});
        }
        if (cdiv_hash !== xscom.hash) {
            cdiv_hash = xscom.hash; ctablist.html(''); ctabs.html('').append( ctablist );
        }
        var page, tab = ctabs.find('div#tabs-'+xscom.host + ' .comments-holder');
        if (tab.length) {
            tab.html(comments);
            if (xscom.pagination) {
                page = $('div#tabs-'+xscom.host).scrollTop(0).find('.pagination');
                //if (page.length) page.pagination('updateItems', xscom.pagination.pages)
                  //  .pagination('drawPage', xscom.pagination.page ? xscom.pagination.page : xscom.pagination.pages);
            }
        } else {
            var title = $('<a/>', {href:'#tabs-'+xscom.host} ).text(xscom.host); var holder;
            ctabs.find('ul').append( $('<li/>').append( title ) );
            ctabs.append( tab = $('<div/>', {id:'tabs-'+xscom.host}).append( holder = $('<div/>', {class:'comments-holder'}).html(comments) )
                    .append( $('<div/>', {class:'spacer'}) ) );
            ctabs.tabs('refresh');
            if (xscom.pagination) {
                page; tab.append( page = xsPagination(tab, holder, xscom.pagination, xscom) );
                tab.scroll(function () { page.css('top', tab.scrollTop()+236); });
                page.on('tab-added', function () { page.pagination('redraw') });
            }
        }
        $('.pagination').trigger('tab-added');
        if (!cdiv_visible && cdiv_active) {
            cdiv.show(); cdiv_visible = true; 
        }
    }
});