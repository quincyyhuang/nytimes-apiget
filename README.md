# nytimes-apiget
A NYTimes Read &amp; Search Tool.

App is runing on heroku. https://nytimes-apiget.herokuapp.com/

## Prerequisites
* Node.js >= v4.4.7
* Accessible to nytimes

## Dependencies
**No need to manually install them, check Installation part.**
* async
* cheerio
* ejs
* express
* express-helpers
* phantom
* request

## Installation
`npm install` will set everything up.

## Deployment
Simply run `node server.js`. Default port is **8000** on localhost. Use web server to proxy to this port.

PM2 Manager is recommended for production.

## Notes
An API key will be required to retrieve data.

Get one on [nytimes dev center](https://developer.nytimes.com/).

*This version of source code is slightly different from what is actually running on heroku for safety reasons.*

## Copyrights
App is licensed with [WTFPL](http://www.wtfpl.net/txt/COPYING/).

**This site(https://nytimes-apiget.herokuapp.com/) DOES NOT hold any form of content from New York Times, it only DISPLAYS the search responses. Copyrights of the search results and the articles are of The New York Times Company.**

**I recommend you not to save any data from the search results.**
