#Introduction
Firebit will be a Javascript based BitTorrent implementation for Mozilla Firefox. The fact that FireBit is written using only JS and Mozilla interfaces allows for easy integration into the web browser, better cross platform compatibility, and the ability to install without restarting the browser. This means that it can be installed on multiple platforms in seconds without interrupting the users work. FireBit aims to remove the need to understand BitTorrent entirely making services like those provided by [burnbit.com](https://burnbit.com) a preferred way to provide content to users.

#Project History
Firebit was previously named TorrentPlus an extension whose only goal was to make finding and downloading torrents a more convenient process with some neat additional functionality. During the development process it was realized that TorrentPlus could completely implement BitTorrent and surpass that goal thus the name change. Before the development plan/goals changed, TorrentPlus had already achieved the following features.

* Torrent Creation interface (Simultaneous)
* Torrent Editor interface (Internal file viewing and HTTP tracker scrapping support)
* Peers could be displayed in the Torrent Editor with their country flag and optional geolocation information.
* Torrent file to Magnet URI conversion
* Magnet URI to Torrent file conversion using any one of 10+ online torrent storage services
* Site comment aggregator(In page floating toolbar) which displayed torrent comments from the top 10+ most popular torrent sites.
*  Torrent Shrinker - Data URI manipulation
*  Magnet URI Shortener VIA [mgnet.me](http://mgnet.me) or TinyURL
* In page (JQuery UI powered) toolbar which would allow users access to the above features in a highly convenient manor.
* Context and Tools menu options.
* BurnBit API
* Some other features omitted intentionally...

#Stepping forward
FireBit will be a complete BitTorrent implementation meaning the only thing needed to download files from any web site will be the click of a link. FireBit will use Firefox's download manager meaning downloads will appear to be standard HTTP downloads with an optional advanced UI for power users to track progress and manage their torrents. Don't worry the TorrentPlus features will be available too. FireBit like many other popular torrent clients will of course support Web seeds. We haven't forgot about other Mozilla products such as ThunderBird and applications that use the Mozilla platform, if they share the same interfaces and support [bootstrapped extensions](https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions) then compatibility won't be hard to add if not already existent.

#Bringing BitTorrent to the Web
We fully encourage sites like [download.com](http://download.com), [filehippo.com](http://filehippo.com), [softpedia.com](http://softpedia.com), and others to take advantage of emerging services like [BurnBit](http://burnbit.com) to allow for fast community powered downloads provided by P2P BitTorrent technology. This will allow for faster downloads and decrease your server load. FireBit will have a feature to create torrents from HTTP links similar to BurnBit so users will be able to participate in new ways.

#Project Status
######The current project development priorities are as follows(unordered):
* Optimizing UDP server operations and underlying libraries.
* Looking for programmers who would like to contribute the project.
* Adding documentation to already written libraries and code.
* Setting up this GitHub repository and documentation.
* Providing a way for people to donate to the project.

#FireBit Vs BitTorrent, Inc.
[BitTorrent Surf](http://labs.bittorrent.com/experiments/surf.html) has brought the torrent downloading feature to a few major browsers in its Beta form but requires multiple extensions and a browser restart to complete the installation. Its download UI looks cool but functionality wise theres stuff missing. BitTorrent is headed in the right direction but a little competition will only help the community. FireBit will *always* be unrestrictively free to the community. If BitTorrent throws a plus on the end of their surf title to demand payment like they've done with uTorrent then we'll gladly take any users they've got ;).

#Development
FireBit's user interfaces utilizes JQuery and JQuery UI and are not considered stable at this time. UIs aren't the current priority as BitTorrent and other features are being implemented. Most libraries are under construction but an operational version is expected to be available here in a reasonable time frame. So stay tuned.

##How can you contribute?
Join the [IRC channel](irc://irc.mozilla.org/firebit) / ([mibbit](http://mibbit.com/?url=irc%3A%2F%2Firc.mozilla.org%2Ffirebit)) and just ask.

###Quick Links
*Will be here shortly :)*
####Similar Projects

* [BitTorrent Surf](http://labs.bittorrent.com/experiments/surf.html)
* [WebTorrent](https://github.com/feross/webtorrent)

